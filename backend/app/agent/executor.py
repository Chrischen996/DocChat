from __future__ import annotations

import json
from typing import Any

from llama_index.core import Settings

from app.agent.planner import _format_history_for_intent, _strip_json_markdown, _validate_tool_plan
from app.agent.state import AgentState, QualityLevel
from app.core.asset_store import add_asset
from app.core.config import AgentConfig
from app.services.chat_service import chat_with_assistant
from app.services.image_service import generate_image
from app.services.rag_service import query_documents
from app.tools import format_tools_for_llm, get_tool


def _coerce_quality_level(value: Any) -> QualityLevel:
    if isinstance(value, QualityLevel):
        return value
    try:
        return QualityLevel(str(value))
    except ValueError:
        return QualityLevel.POOR


def _quality_from_score(score: float) -> QualityLevel:
    if score >= 0.8:
        return QualityLevel.EXCELLENT
    if score >= 0.6:
        return QualityLevel.GOOD
    if score >= 0.4:
        return QualityLevel.ACCEPTABLE
    return QualityLevel.POOR


def _llm_evaluate_quality(answer: str, question: str) -> float:
    """Use the configured LLM to score answer quality. Falls back safely."""
    llm = Settings.llm
    if llm is None:
        return 0.7

    prompt = f"""
请评估以下答案的质量（0-1 分）。评分标准：
- 1.0：完美回答，准确、完整、有证据支持
- 0.8：良好回答，基本准确，略有不足
- 0.6：可接受，回答了部分问题
- 0.4：较差，信息不完整或不准确
- 0.2：很差，几乎没有回答问题

问题：{question}
答案：{answer[:500]}

只输出一个 0-1 之间的小数，不要解释：
""".strip()

    try:
        response = llm.complete(prompt)
        score = float(getattr(response, "text", str(response)).strip())
        return max(0.0, min(1.0, score))
    except Exception:
        return 0.7


def _evaluate_search_result(output: dict[str, Any], user_input: str) -> dict[str, Any]:
    """Evaluate document search quality using source coverage and answer completeness."""
    sources = output.get("sources") or []
    answer = str(output.get("answer") or "")
    source_count = len(sources)
    suggestions: list[str] = []

    if source_count == 0:
        score = 0.2
        suggestions.extend(["扩大搜索范围，使用更通用的关键词", "尝试不同的查询表述"])
    elif source_count < 2:
        score = 0.5
        suggestions.append("增加检索数量或补充检索以获取更多证据")
    else:
        score = 0.8

    if len(answer.strip()) < 50:
        score *= 0.8
        suggestions.append("答案过短，可能信息不完整")

    if AgentConfig.ENABLE_SELF_CORRECTION and answer.strip():
        score = (score + _llm_evaluate_quality(answer, user_input)) / 2

    return {
        "quality": _quality_from_score(score),
        "score": score,
        "reason": f"检索到 {source_count} 个来源，答案长度 {len(answer)} 字符",
        "suggestions": suggestions,
    }


def _evaluate_image_result(output: dict[str, Any]) -> dict[str, Any]:
    """Evaluate image generation output quality."""
    image_data = str(output.get("image_data") or "")
    if not image_data:
        return {
            "quality": QualityLevel.POOR,
            "score": 0.0,
            "reason": "图片生成失败或未返回图片数据",
            "suggestions": ["重新生成图片", "调整 prompt 描述"],
        }

    return {"quality": QualityLevel.EXCELLENT, "score": 0.9, "reason": "图片生成成功", "suggestions": []}


def _evaluate_chat_result(output: str, user_input: str, history: list[dict] | None) -> dict[str, Any]:
    """Evaluate assistant chat output quality."""
    if len(output.strip()) < 10:
        return {
            "quality": QualityLevel.POOR,
            "score": 0.3,
            "reason": "回答过短",
            "suggestions": ["重新生成更详细的回答"],
        }

    score = 0.8
    if AgentConfig.ENABLE_SELF_CORRECTION:
        score = (score + _llm_evaluate_quality(output, user_input)) / 2
    return {"quality": _quality_from_score(score), "score": score, "reason": "回答完整", "suggestions": []}


def _evaluate_tool_result(
    tool_name: str,
    result: dict[str, Any],
    user_input: str,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    """Evaluate a tool execution result and return quality feedback."""
    if not result.get("success"):
        return {
            "quality": QualityLevel.POOR,
            "score": 0.0,
            "reason": f"工具执行失败: {result.get('error') or '未知错误'}",
            "suggestions": ["重试相同工具", "尝试替代工具"],
        }

    output = result.get("output")
    if tool_name == "search_documents" and isinstance(output, dict):
        return _evaluate_search_result(output, user_input)
    if tool_name == "generate_image" and isinstance(output, dict):
        return _evaluate_image_result(output)
    if tool_name == "chat":
        return _evaluate_chat_result(str(output or ""), user_input, history)
    if output in (None, ""):
        return {
            "quality": QualityLevel.POOR,
            "score": 0.3,
            "reason": "工具执行成功但没有有效输出",
            "suggestions": ["调整参数后重试", "尝试替代工具"],
        }

    return {"quality": QualityLevel.GOOD, "score": 0.8, "reason": "工具执行成功", "suggestions": []}


def document_node(state: AgentState) -> AgentState:
    state.setdefault("status", []).append({"type": "status", "message": "正在检索文档片段..."})
    result = query_documents(state.get("user_input", ""), history=state.get("messages"))
    state["sources"] = result["sources"]
    state["answer"] = result["answer"]
    state.setdefault("status", []).append({"type": "sources", "sources": state["sources"]})
    return state


def image_node(state: AgentState) -> AgentState:
    state.setdefault("status", []).append({"type": "status", "message": "正在生成图片..."})
    import asyncio

    user_input = state.get("user_input", "")
    result = asyncio.run(generate_image(user_input))
    first_image = result["images"][0]
    state["asset"] = add_asset(
        asset_type="image",
        title=user_input[:80] or "生成图片",
        image_data=first_image.get("b64_json", ""),
        format="png",
        source_template_id=state.get("template_id"),
        source_question=user_input,
    )
    state.setdefault("status", []).append({"type": "asset", "asset": state["asset"]})
    state["answer"] = first_image.get("revised_prompt") or user_input
    return state


def assistant_node(state: AgentState) -> AgentState:
    state.setdefault("status", []).append({"type": "status", "message": "正在生成回答..."})
    state["answer"] = chat_with_assistant(state.get("user_input", ""), history=state.get("messages"))
    return state


def _resolve_tool_params(params: dict[str, Any], previous_result: Any) -> dict[str, Any]:
    resolved = {}
    for key, value in params.items():
        if isinstance(value, str) and "{{previous_result}}" in value:
            resolved[key] = value.replace("{{previous_result}}", json.dumps(previous_result, ensure_ascii=False))
        else:
            resolved[key] = value
    return resolved


def _replan_based_on_feedback(
    original_plan: list[dict],
    executed_steps: list[dict],
    user_input: str,
    history: list[dict] | None,
) -> list[dict]:
    """Ask the configured LLM to revise the tool plan from execution feedback."""
    llm = Settings.llm
    if llm is None:
        return []

    feedback_lines = []
    for index, step in enumerate(executed_steps, start=1):
        evaluation = step.get("evaluation", {})
        quality = _coerce_quality_level(evaluation.get("quality", QualityLevel.POOR)).value
        suggestions = evaluation.get("suggestions") or []
        feedback_lines.append(f"步骤 {index}: {step.get('tool', '')}")
        feedback_lines.append(f"  质量: {quality}")
        feedback_lines.append(f"  分数: {evaluation.get('score', 0.0)}")
        feedback_lines.append(f"  原因: {evaluation.get('reason', '')}")
        if suggestions:
            feedback_lines.append(f"  建议: {'; '.join(str(item) for item in suggestions)}")

    prompt = f"""
你是 DocChat 的任务重规划器。用户任务未达到预期质量，请根据执行反馈调整工具调用计划。

原始用户输入：
{user_input}

最近对话：
{_format_history_for_intent(history)}

当前计划：
{json.dumps(original_plan, ensure_ascii=False, indent=2)}

执行反馈：
{chr(10).join(feedback_lines) or "无"}

可用工具：
{format_tools_for_llm()}

改进策略：
1. 检索结果不足时，改写 query 为更通用或同义表达；如果工具 schema 支持，也可增加检索参数。
2. 工具失败时，优先修正参数；必要时尝试替代工具。
3. 信息不完整时，增加补充检索或总结步骤。
4. 保持计划简洁，最多 {AgentConfig.MAX_CHAIN_STEPS} 步。
5. 只输出有效 JSON，不要 Markdown。

输出格式：
{{
  "plan": [
    {{"tool": "工具名", "params": {{"参数": "值"}}, "reason": "改进原因"}}
  ],
  "change_summary": "本次调整的主要变化"
}}
""".strip()

    try:
        response = llm.complete(prompt)
        data = json.loads(_strip_json_markdown(getattr(response, "text", str(response))))
        print(f"[RE-PLANNER] 调整计划: {data.get('change_summary', '')}")
        return _validate_tool_plan(data.get("plan", []))
    except Exception as exc:
        print(f"[RE-PLANNER] 重规划失败: {exc}")
        return []


def _handle_successful_tool_output(tool_name: str, output: Any, state: AgentState) -> None:
    if tool_name == "search_documents" and isinstance(output, dict):
        state["sources"] = output.get("sources", [])
        state.setdefault("status", []).append({"type": "sources", "sources": state["sources"]})
    elif tool_name == "generate_image" and isinstance(output, dict):
        state["asset"] = add_asset(
            asset_type="image",
            title=state.get("user_input", "")[:80] or "生成图片",
            image_data=output.get("image_data", ""),
            format="png",
            source_template_id=state.get("template_id"),
            source_question=state.get("user_input", ""),
        )
        state.setdefault("status", []).append({"type": "asset", "asset": state["asset"]})


def _set_final_answer_from_steps(state: AgentState, steps: list[dict], correction_count: int = 0) -> AgentState:
    successful_steps = [step for step in steps if step.get("result", {}).get("success")]
    if not successful_steps:
        state["answer"] = "工具链执行失败，请稍后重试。"
        return state

    final_output = successful_steps[-1]["result"]["output"]
    if isinstance(final_output, dict):
        state["answer"] = final_output.get("answer") or final_output.get("revised_prompt") or json.dumps(
            final_output, ensure_ascii=False
        )
    else:
        state["answer"] = str(final_output)

    if correction_count > 0:
        state["answer"] += f"\n\n_（经过 {correction_count} 次自我修正）_"
    return state


def _execute_tool_chain(plan: list[dict], state: AgentState) -> AgentState:
    context = {"previous_result": None, "steps": []}

    for index, step in enumerate(plan[: AgentConfig.MAX_CHAIN_STEPS], start=1):
        tool_name = step.get("tool", "")
        reason = step.get("reason", "执行工具")
        state.setdefault("status", []).append({"type": "status", "message": f"步骤 {index}/{len(plan)}: {reason}..."})

        tool = get_tool(tool_name)
        if tool is None:
            print(f"[EXECUTOR] 工具不存在: {tool_name}")
            continue

        resolved_params = _resolve_tool_params(step.get("params", {}), context["previous_result"])
        if "history" in tool.input_schema and "history" not in resolved_params:
            resolved_params["history"] = state.get("messages", [])

        print(f"[EXECUTOR] 执行: {tool_name}({resolved_params})")
        result = tool.execute(**resolved_params)
        context["steps"].append({"tool": tool_name, "params": resolved_params, "result": result, "reason": reason})

        if not result["success"]:
            print(f"[EXECUTOR] 工具执行失败: {result['error']}")
            state.setdefault("status", []).append(
                {"type": "status", "message": f"工具 {tool_name} 执行失败，继续尝试后续步骤"}
            )
            continue

        output = result["output"]
        context["previous_result"] = output
        _handle_successful_tool_output(tool_name, output, state)

    return _set_final_answer_from_steps(state, context["steps"])


def _execute_single_tool_step(
    step: dict,
    step_index: int,
    plan_size: int,
    state: AgentState,
    previous_result: Any,
) -> tuple[dict | None, Any, bool]:
    tool_name = step.get("tool", "")
    reason = step.get("reason", "执行工具")
    state.setdefault("status", []).append({"type": "status", "message": f"步骤 {step_index}/{plan_size}: {reason}..."})

    tool = get_tool(tool_name)
    if tool is None:
        print(f"[EXECUTOR] 工具不存在: {tool_name}")
        return None, previous_result, True

    resolved_params = _resolve_tool_params(step.get("params", {}), previous_result)
    if "history" in tool.input_schema and "history" not in resolved_params:
        resolved_params["history"] = state.get("messages", [])

    print(f"[EXECUTOR] 执行: {tool_name}({resolved_params})")
    result = tool.execute(**resolved_params)
    evaluation = _evaluate_tool_result(tool_name, result, state.get("user_input", ""), state.get("messages"))
    step_record = {
        "tool": tool_name,
        "params": resolved_params,
        "result": result,
        "evaluation": evaluation,
        "reason": reason,
    }

    if not result.get("success"):
        print(f"[EXECUTOR] 工具执行失败: {result.get('error')}")
        state.setdefault("status", []).append(
            {"type": "status", "message": f"工具 {tool_name} 执行失败，准备评估是否需要修正"}
        )
        return step_record, previous_result, True

    output = result["output"]
    _handle_successful_tool_output(tool_name, output, state)
    return step_record, output, False


def _execute_tool_chain_with_correction(initial_plan: list[dict], state: AgentState) -> AgentState:
    """Execute a tool chain with evaluator-driven replanning and retry loops."""
    current_plan = initial_plan[: AgentConfig.MAX_CHAIN_STEPS]
    correction_count = 0
    last_steps: list[dict] = []

    for loop in range(AgentConfig.MAX_CORRECTION_LOOPS + 1):
        if loop > 0:
            state.setdefault("status", []).append(
                {"type": "status", "message": f"🔄 第 {loop} 次自我修正，重新执行计划..."}
            )

        previous_result = None
        current_steps: list[dict] = []
        should_replan_early = False

        for index, step in enumerate(current_plan, start=1):
            step_record, previous_result, failed = _execute_single_tool_step(
                step, index, len(current_plan), state, previous_result
            )
            if step_record is None:
                continue

            current_steps.append(step_record)
            evaluation = step_record.get("evaluation", {})
            quality = _coerce_quality_level(evaluation.get("quality", QualityLevel.POOR))
            if failed and quality == QualityLevel.POOR and loop < AgentConfig.MAX_CORRECTION_LOOPS:
                should_replan_early = True
                break

        if current_steps:
            last_steps = current_steps
        if not current_steps:
            break

        last_evaluation = current_steps[-1].get("evaluation", {})
        last_score = float(last_evaluation.get("score", 0.0) or 0.0)
        needs_replan = should_replan_early or last_score < AgentConfig.MIN_QUALITY_THRESHOLD

        if needs_replan and loop < AgentConfig.MAX_CORRECTION_LOOPS:
            print(f"[EXECUTOR] 质量不达标 (score={last_score:.2f}), 触发重规划")
            new_plan = _replan_based_on_feedback(
                current_plan,
                current_steps,
                state.get("user_input", ""),
                state.get("messages"),
            )
            if new_plan and new_plan != current_plan:
                correction_count += 1
                current_plan = new_plan
                continue

            print("[EXECUTOR] 重规划失败或计划未变化，停止修正")
            break

        break

    return _set_final_answer_from_steps(state, last_steps, correction_count)


def chain_node(state: AgentState) -> AgentState:
    plan = state.get("tool_plan", [])
    if not plan:
        state["answer"] = "未找到有效的工具调用计划。"
        return state

    state.setdefault("status", []).append({"type": "status", "message": f"开始执行 {len(plan)} 步工具链..."})
    if AgentConfig.ENABLE_SELF_CORRECTION:
        return _execute_tool_chain_with_correction(plan, state)
    return _execute_tool_chain(plan, state)

