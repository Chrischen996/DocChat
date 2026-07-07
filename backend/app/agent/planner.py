from __future__ import annotations

import json
from typing import Any

from llama_index.core import Settings

from app.agent.state import AgentState
from app.core.config import AgentConfig
from app.core.template_store import get_template, list_templates
from app.tools import format_tools_for_llm, get_tool


def _find_template(template_id: str | None, prompt: str) -> dict | None:
    if template_id:
        template = get_template(template_id)
        if template:
            return template

    lowered = prompt.lower()
    for template in list_templates():
        if template["id"] in lowered or template["name"] in prompt:
            return template
    return None


def _format_history_for_intent(history: list[dict] | None) -> str:
    if not history:
        return "无"

    lines = []
    for message in history[-8:]:
        role = message.get("role", "")
        content = message.get("content", "").strip()
        if not content:
            continue
        label = "用户" if role == "user" else "助手"
        lines.append(f"{label}: {content[:500]}")
    return "\n".join(lines) or "无"


def _keyword_intent_fallback(user_input: str) -> tuple[str, str]:
    lowered = user_input.lower()
    document_keywords = (
        "文档",
        "文件",
        "报告",
        "财报",
        "合同",
        "资料",
        "上传",
        "检索",
        "引用",
        "source",
        "pdf",
        "docx",
        "xlsx",
    )
    image_keywords = (
        "生成图片",
        "画一张",
        "配图",
        "海报",
        "插画",
        "图片",
        "image",
        "poster",
        "illustration",
    )

    if any(keyword in lowered for keyword in image_keywords):
        return "image_generation", "规则兜底：命中图片生成关键词"
    if any(keyword in lowered for keyword in document_keywords):
        return "document_query", "规则兜底：命中文档检索关键词"
    return "general_chat", "规则兜底：未命中特定工具关键词"


def _strip_json_markdown(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    return cleaned


def _parse_intent_response(text: str) -> tuple[str, str]:
    cleaned = _strip_json_markdown(text)
    try:
        data = json.loads(cleaned)
        intent = str(data.get("intent", "")).strip()
        reason = str(data.get("reason", "")).strip()
    except json.JSONDecodeError:
        lowered = cleaned.lower()
        if "image_generation" in lowered or "image" in lowered:
            return "image_generation", "LLM 返回文本中包含图片意图"
        if "document_query" in lowered or "document" in lowered:
            return "document_query", "LLM 返回文本中包含文档意图"
        if "general_chat" in lowered or "chat" in lowered or "assistant" in lowered:
            return "general_chat", "LLM 返回文本中包含聊天意图"
        return "", "LLM 返回无法解析"

    allowed = {"document_query", "image_generation", "general_chat"}
    if intent not in allowed:
        return "", reason or "LLM 返回未知意图"
    return intent, reason


def _validate_tool_plan(plan: Any) -> list[dict]:
    """Validate and normalize LLM-generated tool plans."""
    if not isinstance(plan, list):
        return []

    valid_plan = []
    for step in plan[: AgentConfig.MAX_CHAIN_STEPS]:
        if not isinstance(step, dict):
            continue
        tool_name = str(step.get("tool", "")).strip()
        params = step.get("params", {})
        if not tool_name or not get_tool(tool_name) or not isinstance(params, dict):
            continue
        valid_plan.append(
            {
                "tool": tool_name,
                "params": params,
                "reason": str(step.get("reason", "执行工具")).strip()[:40] or "执行工具",
            }
        )

    return valid_plan


def plan_tool_chain(user_input: str, history: list[dict] | None) -> list[dict]:
    """Ask the configured LLM to produce a validated tool invocation plan."""
    if not AgentConfig.ENABLE_TOOL_CHAIN:
        return []

    llm = Settings.llm
    if llm is None:
        return []

    prompt = f"""
你是 DocChat 的任务规划器。请根据用户需求，规划一系列工具调用步骤。

可用工具：
{format_tools_for_llm()}

约束：
1. 如果任务简单（单个工具即可完成），plan 只包含一个步骤。
2. 如果任务复杂（需要多步骤），按逻辑顺序规划，最多 {AgentConfig.MAX_CHAIN_STEPS} 步。
3. 每步的输出可以作为下一步的输入（通过 {{{{previous_result}}}} 引用）。
4. 工具参数必须符合可用工具列表，不要添加未定义工具。
5. 必须输出有效 JSON，不要添加 Markdown 标记。

最近对话：
{_format_history_for_intent(history)}

用户输入：
{user_input}

输出格式：
{{
  "plan": [
    {{
      "tool": "工具名称",
      "params": {{"参数名": "参数值或{{{{previous_result}}}}"}},
      "reason": "为什么需要这个工具（不超过20字）"
    }}
  ],
  "is_complex": true
}}
""".strip()

    try:
        response = llm.complete(prompt)
        data = json.loads(_strip_json_markdown(getattr(response, "text", str(response))))
    except Exception as exc:
        print(f"[PLANNER] 规划失败: {exc}")
        return []

    return _validate_tool_plan(data.get("plan", []))


def intelligent_intent(user_input: str, history: list[dict] | None) -> tuple[str, str]:
    llm = Settings.llm
    if llm is None:
        return _keyword_intent_fallback(user_input)

    prompt = f"""
你是 DocChat 的轻量 Agent 路由器。请根据用户输入和最近对话，选择最合适的单一处理方式。

可选 intent：
1. document_query：需要查询、总结、分析已上传文档/文件/财报/合同/资料，或用户要求基于文档证据回答。
2. image_generation：需要根据文字描述生成图片、海报、插画、配图。
3. general_chat：普通问答、写作、解释、计划、翻译、闲聊，不需要访问上传文档或生成图片。

约束：
- 只能选择一个 intent。
- 如果用户明确说“上传的文档/这份文件/财报/合同/报告/引用来源”，优先 document_query。
- 如果用户明确要求“生成图片/画/海报/插画/配图”，优先 image_generation。
- 不要输出 Markdown，不要解释，只输出 JSON。

最近对话：
{_format_history_for_intent(history)}

用户输入：
{user_input}

输出格式：{{"intent":"document_query|image_generation|general_chat","reason":"不超过20字的原因"}}
""".strip()

    try:
        response = llm.complete(prompt)
        intent, reason = _parse_intent_response(getattr(response, "text", str(response)))
        if intent:
            return intent, reason or "LLM 智能意图识别"
    except Exception:
        pass

    return _keyword_intent_fallback(user_input)


def classify_state(state: AgentState) -> AgentState:
    template = _find_template(state.get("template_id"), state.get("user_input", ""))
    if template:
        state["template_id"] = template["id"]
        state["workflow_id"] = template.get("workflow_id")
        state["intent_reason"] = f"命中模板：{template['name']}"
    elif AgentConfig.ENABLE_TOOL_CHAIN:
        plan = plan_tool_chain(state.get("user_input", ""), state.get("messages"))
        if len(plan) > 1:
            state["mode"] = "chain"
            state["tool_plan"] = plan
            state["workflow_id"] = "tool_chain"
            state["intent_reason"] = f"复杂任务，需要 {len(plan)} 个工具串联"
        elif len(plan) == 1:
            tool_name = plan[0]["tool"]
            if tool_name == "search_documents":
                state["workflow_id"] = "document_summary"
            elif tool_name == "generate_image":
                state["workflow_id"] = "image_generation"
            else:
                state["workflow_id"] = "assistant_plan"
            state["tool_plan"] = plan
            state["intent_reason"] = f"单工具任务：{tool_name}"
        else:
            intent, reason = intelligent_intent(state.get("user_input", ""), state.get("messages"))
            state["intent_reason"] = reason
            if intent == "image_generation":
                state["workflow_id"] = "image_generation"
            elif intent == "document_query":
                state["workflow_id"] = "document_summary"
            else:
                state["workflow_id"] = "assistant_plan"
    else:
        intent, reason = intelligent_intent(state.get("user_input", ""), state.get("messages"))
        state["intent_reason"] = reason
        if intent == "image_generation":
            state["workflow_id"] = "image_generation"
        elif intent == "document_query":
            state["workflow_id"] = "document_summary"
        else:
            state["workflow_id"] = "assistant_plan"

    if state.get("mode") != "chain":
        if state.get("workflow_id") == "image_generation":
            state["mode"] = "image"
        elif state.get("workflow_id") == "document_summary":
            state["mode"] = "document"
        else:
            state["mode"] = "assistant"

    state.setdefault("status", []).append(
        {
            "type": "status",
            "message": f"已进入 {state.get('workflow_id')} 工作流（{state.get('intent_reason')}）",
        }
    )
    return state


__all__ = [
    "_format_history_for_intent",
    "_strip_json_markdown",
    "_validate_tool_plan",
    "classify_state",
    "intelligent_intent",
    "plan_tool_chain",
]
