from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from time import perf_counter
from typing import Any, Callable

from llama_index.core import Settings

from app.core.agnes_client import build_agnes_llm, init_agnes_services
from app.core.agnes_llm import AgnesLLM
from app.core.asset_store import add_asset
from app.core.template_store import get_template
from app.services.image_service import generate_image
from app.services.rag_service import query_documents
from app.services.react_parser import parse_react_output


MAX_REACT_STEPS = 5


@dataclass(frozen=True)
class ReactToolSpec:
    name: str
    description: str
    param: str


REACT_TOOLS: dict[str, ReactToolSpec] = {
    "document_search": ReactToolSpec(
        name="document_search",
        description="在已上传文档中检索相关片段，适合回答需要文档证据的问题。",
        param="查询关键词或自然语言问题",
    ),
    "document_deep_search": ReactToolSpec(
        name="document_deep_search",
        description="在已上传文档中进行更广泛检索，适合复杂分析、跨段落比较或一次检索不足的情况。",
        param="更完整的查询关键词或分析问题",
    ),
    "image_generate": ReactToolSpec(
        name="image_generate",
        description="根据描述生成一张图片资产，适合海报、插图、配图等视觉内容任务。",
        param="图片描述，包含主题、风格、构图和用途",
    ),
    "direct_answer": ReactToolSpec(
        name="direct_answer",
        description="不需要外部工具时直接回答；ACTION_INPUT 必须填写完整最终答案。",
        param="完整最终答案",
    ),
}


def _get_llm(model: str | None = None):
    if model:
        return build_agnes_llm(model)
    if Settings._llm is not None:
        return Settings.llm
    return init_agnes_services()


def _truncate(text: str, limit: int = 1600) -> str:
    normalized = (text or "").strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[:limit].rstrip() + "..."


def _format_history(history: list[dict] | None = None) -> str:
    if not history:
        return "无"

    lines = []
    for message in history[-10:]:
        role = message.get("role", "")
        content = str(message.get("content", "")).strip()
        if not content:
            continue
        label = "用户" if role == "user" else "助手"
        lines.append(f"{label}: {_truncate(content, 900)}")
    return "\n".join(lines) if lines else "无"


def _format_template(template: dict | None) -> str:
    if not template:
        return "无"

    return "\n".join(
        [
            f"模板名称: {template.get('name', '')}",
            f"模板说明: {template.get('description', '')}",
            f"默认任务: {template.get('default_prompt', '')}",
            f"工作流类型: {template.get('workflow_id', '')}",
        ]
    )


def _format_tools() -> str:
    return "\n".join(
        f"- {tool.name}({tool.param}): {tool.description}"
        for tool in REACT_TOOLS.values()
    )


REACT_SYSTEM_PROMPT = (
    "你是 DocChat 的智能文档 Agent，使用纯文本 ReAct 格式分步推理和调用工具。\n\n"
    "可用工具：\n"
    + "\n".join(
        f"- {tool.name}({tool.param}): {tool.description}"
        for tool in REACT_TOOLS.values()
    )
    + "\n\n"
    "工具选择建议：\n"
    "1. 问题涉及上传文档、合同、财报、文件内容或需要引用证据时，优先使用 document_search。\n"
    "2. 需要跨章节、多指标、复杂比较或首次检索不足时，使用 document_deep_search。\n"
    "3. 用户明确要求生成图片、配图、海报、插图时，使用 image_generate。\n"
    "4. 不需要任何外部信息的一般聊天、写作、规划、解释任务，可以直接输出 FINAL_ANSWER，或使用 direct_answer。\n\n"
    "规则：\n"
    "- 每轮只允许选择一个工具；已有足够信息时必须输出 FINAL_ANSWER。\n"
    "- 必须严格按指定格式输出，不要使用 Markdown 代码块包裹。\n"
    "- 不要编造 Observation 中没有的文档事实。\n"
    "- FINAL_ANSWER 使用中文，结构清晰；引用文档事实时使用 Observation 中的来源编号，例如 [1]、[2]。\n"
    "- 如果 Observation 不足以回答文档问题，请明确说明无法从当前文档确定。"
)


def _build_react_user_message(
    user_input: str,
    history: list[dict] | None,
    observations: list[str],
    template: dict | None,
    force_final: bool = False,
) -> str:
    """构建 ReAct 推理的 user 消息内容（不含 system）。"""
    observation_text = "\n\n".join(observations[-8:]) if observations else "无"
    history_text = _format_history(history)
    template_text = _format_template(template)

    tool_names = "|".join(REACT_TOOLS.keys())
    if force_final:
        format_block = "THOUGHT: <你如何基于已有 Observation 得出答案>\nFINAL_ANSWER: <最终答案>"
        extra_rule = "\n【注意】：你已经达到推理步数上限。现在禁止再调用工具，必须只输出 THOUGHT 和 FINAL_ANSWER。\n"
    else:
        format_block = (
            f"THOUGHT: <下一步推理>\nACTION: <{tool_names}>\nACTION_INPUT: <工具输入>\n\n"
            "或：\n"
            "THOUGHT: <为什么已经足够回答>\nFINAL_ANSWER: <最终答案>"
        )
        extra_rule = ""

    return (
        f"当前模板：\n{template_text}\n\n"
        f"最近对话：\n{history_text}\n\n"
        f"已有 Observation：\n{observation_text}\n\n"
        f"{extra_rule}"
        f"当前用户问题：\n{user_input}\n\n"
        f"输出格式：\n{format_block}"
    )


def build_react_messages(
    user_input: str,
    history: list[dict] | None,
    observations: list[str],
    template: dict | None,
    force_final: bool = False,
) -> list[dict]:
    """构建 ReAct 推理的结构化 messages 列表（messages API 版本）。

    Returns:
        [{"role": "system", "content": ...}, {"role": "user", "content": ...}]
    """
    return [
        {"role": "system", "content": REACT_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": _build_react_user_message(
                user_input, history, observations, template, force_final
            ),
        },
    ]


def build_react_prompt(
    user_input: str,
    history: list[dict] | None,
    observations: list[str],
    template: dict | None,
    force_final: bool = False,
) -> str:
    """构建 ReAct 推理的扁平 prompt（fallback / 非 AgnesLLM 兼容路径）。"""
    user_content = _build_react_user_message(
        user_input, history, observations, template, force_final
    )
    return REACT_SYSTEM_PROMPT + "\n\n" + user_content


def _run_async_sync(factory: Callable[[], Any]) -> Any:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(factory())

    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(lambda: asyncio.run(factory())).result()


def _source_key(source: dict) -> tuple[str, str]:
    return (
        str(source.get("file_name") or ""),
        str(source.get("text") or "")[:240],
    )


def _merge_sources(all_sources: list[dict], new_sources: list[dict]) -> list[tuple[int, dict]]:
    existing = {_source_key(source): index for index, source in enumerate(all_sources, start=1)}
    indexed: list[tuple[int, dict]] = []

    for source in new_sources:
        key = _source_key(source)
        if key in existing:
            indexed.append((existing[key], source))
            continue
        all_sources.append(source)
        index = len(all_sources)
        existing[key] = index
        indexed.append((index, source))

    return indexed


def _format_document_observation(
    step: int,
    tool_name: str,
    tool_input: str,
    tool_result: dict,
    indexed_sources: list[tuple[int, dict]],
) -> str:
    lines = [
        f"Observation {step}: 工具 {tool_name} 已执行。",
        f"输入: {_truncate(tool_input, 500)}",
        f"工具答案: {_truncate(tool_result.get('answer', ''), 1200)}",
    ]

    if indexed_sources:
        lines.append("可引用来源:")
        for index, source in indexed_sources:
            file_name = source.get("file_name") or "未知文件"
            score = source.get("score")
            score_text = f"，相关度: {score:.4f}" if isinstance(score, (int, float)) else ""
            text = _truncate(source.get("text", ""), 700)
            lines.append(f"[{index}] 文件: {file_name}{score_text}\n{text}")
    else:
        lines.append("可引用来源: 无")

    return "\n".join(lines)


def _format_error_observation(step: int, tool_name: str, error: Exception) -> str:
    return f"Observation {step}: 工具 {tool_name} 执行失败。错误: {str(error)}"


def _format_asset_observation(step: int, tool_input: str, asset: dict) -> str:
    return "\n".join(
        [
            f"Observation {step}: 工具 image_generate 已生成图片资产。",
            f"输入: {_truncate(tool_input, 500)}",
            f"资产 ID: {asset.get('id', '')}",
            f"资产标题: {asset.get('title', '')}",
            f"图片格式: {asset.get('format', '')}",
        ]
    )


def _compact_tool_sources(sources: list[dict]) -> list[dict]:
    return [
        {
            "source_id": source.get("source_id"),
            "text": str(source.get("text", ""))[:1000],
            "score": source.get("score"),
            "file_name": source.get("file_name"),
            "document_title": source.get("document_title"),
            "chunk_index": source.get("chunk_index"),
            "page_number": source.get("page_number"),
            "file_path": source.get("file_path"),
        }
        for source in sources
    ]


def _compact_asset(asset: dict) -> dict:
    return {
        "id": asset.get("id"),
        "asset_type": asset.get("asset_type"),
        "title": asset.get("title"),
        "format": asset.get("format"),
        "source_template_id": asset.get("source_template_id"),
        "source_question": asset.get("source_question"),
    }


def execute_react_tool(
    tool_name: str,
    tool_input: str,
    history: list[dict] | None = None,
    template_id: str | None = None,
    llm=None,
) -> dict:
    if tool_name == "document_search":
        result = query_documents(tool_input, top_k=3, history=history, llm=llm)
        return {"kind": "document", **result}

    if tool_name == "document_deep_search":
        result = query_documents(tool_input, top_k=6, history=history, llm=llm)
        return {"kind": "document", **result}

    if tool_name == "image_generate":
        result = _run_async_sync(lambda: generate_image(tool_input))
        images = result.get("images") or []
        if not images:
            raise RuntimeError("图片生成服务未返回图片")

        first_image = images[0]
        asset = add_asset(
            asset_type="image",
            title=tool_input[:80] or "Generated image",
            image_data=first_image.get("b64_json", ""),
            format="png",
            source_template_id=template_id,
            source_question=tool_input,
        )
        return {
            "kind": "asset",
            "asset": asset,
            "answer": first_image.get("revised_prompt") or f"已生成图片资产：{asset['title']}",
        }

    if tool_name == "direct_answer":
        return {"kind": "direct_answer", "answer": tool_input}

    raise ValueError(f"未知工具: {tool_name}")


def run_react_agent(
    user_input: str,
    template_id: str | None = None,
    model: str | None = None,
    history: list[dict] | None = None,
    max_steps: int = MAX_REACT_STEPS,
) -> dict[str, Any]:
    started_at = perf_counter()
    llm = _get_llm(model)
    template = get_template(template_id) if template_id else None

    observations: list[str] = []
    sources: list[dict] = []
    events: list[dict] = [
        {"type": "status", "message": "Starting ReAct reasoning"},
    ]
    react_steps: list[dict] = []
    final_answer = ""
    asset: dict | None = None

    for step in range(1, max_steps + 1):
        force_final = step == max_steps
        if isinstance(llm, AgnesLLM):
            messages = build_react_messages(
                user_input, history, observations, template, force_final=force_final
            )
            raw_output = llm.chat_messages(messages)
        else:
            prompt = build_react_prompt(
                user_input, history, observations, template, force_final=force_final
            )
            raw_output = str(llm.complete(prompt))
        parsed = parse_react_output(raw_output)
        thought = parsed.get("thought", "")

        react_steps.append(
            {
                "step": step,
                "raw": raw_output,
                "parsed": parsed,
            }
        )

        if thought:
            events.append({"type": "thinking", "text": thought})

        if parsed["type"] == "final":
            final_answer = parsed.get("answer", "").strip()
            break

        tool_name = parsed.get("tool", "").strip()
        tool_input = parsed.get("tool_input", "").strip()

        if not tool_name:
            final_answer = raw_output.strip()
            break

        if tool_name not in REACT_TOOLS:
            observation = f"Observation {step}: 模型请求了不可用工具 {tool_name}。可用工具: {', '.join(REACT_TOOLS)}"
            observations.append(observation)
            events.append(
                {
                    "type": "tool_result",
                    "tool": tool_name,
                    "output": {"error": observation},
                }
            )
            continue

        if tool_name == "direct_answer":
            events.append({"type": "tool_start", "tool": tool_name, "input": tool_input})
            final_answer = tool_input or thought or raw_output.strip()
            events.append(
                {
                    "type": "tool_result",
                    "tool": tool_name,
                    "output": {"answer": final_answer},
                }
            )
            break

        events.append({"type": "tool_start", "tool": tool_name, "input": tool_input})

        try:
            tool_result = execute_react_tool(
                tool_name,
                tool_input,
                history=history,
                template_id=template_id,
                llm=llm,
            )
        except Exception as exc:
            observation = _format_error_observation(step, tool_name, exc)
            observations.append(observation)
            events.append(
                {
                    "type": "tool_result",
                    "tool": tool_name,
                    "output": {"error": str(exc)},
                }
            )
            continue

        if tool_result.get("kind") == "document":
            tool_sources = tool_result.get("sources", [])
            indexed_sources = _merge_sources(sources, tool_sources)
            observations.append(
                _format_document_observation(
                    step,
                    tool_name,
                    tool_input,
                    tool_result,
                    indexed_sources,
                )
            )
            events.append(
                {
                    "type": "tool_result",
                    "tool": tool_name,
                    "output": {
                        "answer": _truncate(tool_result.get("answer", ""), 1200),
                        "sources": _compact_tool_sources(tool_sources),
                    },
                }
            )
            continue

        if tool_result.get("kind") == "asset":
            asset = tool_result.get("asset")
            if asset:
                observations.append(_format_asset_observation(step, tool_input, asset))
                events.append(
                    {
                        "type": "tool_result",
                        "tool": tool_name,
                        "output": _compact_asset(asset),
                    }
                )
            final_answer = tool_result.get("answer", "") or "图片已生成。"
            break

    if not final_answer:
        final_prompt = build_react_prompt(
            user_input,
            history,
            observations,
            template,
            force_final=True,
        )
        raw_output = str(llm.complete(final_prompt))
        parsed = parse_react_output(raw_output)
        thought = parsed.get("thought", "")
        if thought:
            events.append({"type": "thinking", "text": thought})
        final_answer = parsed.get("answer", raw_output).strip()
        react_steps.append(
            {
                "step": max_steps + 1,
                "raw": raw_output,
                "parsed": parsed,
                "forced_final": True,
            }
        )

    if not final_answer:
        final_answer = "我暂时无法基于当前信息完成回答。"

    total_ms = int((perf_counter() - started_at) * 1000)
    events.append({"type": "status", "message": f"ReAct reasoning completed in {total_ms}ms"})

    return {
        "answer": final_answer,
        "sources": sources,
        "asset": asset,
        "events": events,
        "react_steps": react_steps,
        "total_ms": total_ms,
    }
