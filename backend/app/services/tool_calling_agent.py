from __future__ import annotations

import json
from time import perf_counter
from uuid import uuid4
from typing import Any

from app.core.agnes_client import build_agnes_llm, init_agnes_services, resolve_model_capabilities
from app.core.agnes_llm import AgnesLLM
from app.core.template_store import get_template
from app.services.agent_tools import execute_agent_tool, extract_tool_input, get_tool_schemas
from app.services.react_agent import (
    MAX_REACT_STEPS,
    _compact_asset,
    _compact_tool_sources,
    _format_asset_observation,
    _format_document_observation,
    _format_error_observation,
    _format_template,
    _get_llm,
    _merge_sources,
)


TOOL_CALLING_SYSTEM_PROMPT = """你是 DocChat 的智能文档 Agent。你可以使用工具检索文档、生成图片或直接回答。

规则：
- 涉及上传文档、合同、财报、文件内容或需要引用证据时，优先调用 document_search。
- 需要跨章节、多指标、复杂比较或首次检索不足时，调用 document_deep_search。
- 用户明确要求生成图片、配图、海报、插图时，调用 image_generate。
- 工具结果足够后，直接输出最终中文答案。
- 不要编造工具结果中没有的文档事实；引用文档事实时使用来源编号，例如 [1]、[2]。
- 如果工具结果不足以回答文档问题，请明确说明无法从当前文档确定。
"""


def _history_messages(history: list[dict] | None) -> list[dict]:
    messages: list[dict] = []
    if not history:
        return messages
    for msg in history[-10:]:
        role = msg.get("role")
        content = str(msg.get("content", "")).strip()
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content[:1200]})
    return messages


def build_tool_calling_messages(
    user_input: str,
    template: dict | None,
    history: list[dict] | None,
) -> list[dict]:
    template_text = _format_template(template)
    return [
        {"role": "system", "content": TOOL_CALLING_SYSTEM_PROMPT},
        *_history_messages(history),
        {
            "role": "user",
            "content": f"当前模板：\n{template_text}\n\n当前用户问题：\n{user_input}",
        },
    ]


def _parse_arguments(raw: str | dict | None) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {"input": parsed}
    except json.JSONDecodeError:
        return {"input": raw}


def _tool_message(tool_call_id: str, content: dict) -> dict:
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": json.dumps(content, ensure_ascii=False),
    }


def _now_ms() -> int:
    return int(perf_counter() * 1000)


def _node_start(
    label: str,
    node_type: str,
    *,
    tool: str | None = None,
    input: Any = None,
    node_id: str | None = None,
    meta: dict | None = None,
) -> dict:
    payload = {
        "type": "node_start",
        "node_id": node_id or f"{node_type}-{uuid4().hex[:8]}",
        "node_type": node_type,
        "label": label,
        "status": "running",
        "started_at": _now_ms(),
    }
    if tool:
        payload["tool"] = tool
    if input is not None:
        payload["input"] = input
    if meta:
        payload["meta"] = meta
    return payload


def _node_end(
    start_event: dict,
    *,
    status: str = "success",
    output: Any = None,
    meta: dict | None = None,
) -> dict:
    ended_at = _now_ms()
    payload = {
        "type": "node_end",
        "node_id": start_event["node_id"],
        "node_type": start_event.get("node_type"),
        "label": start_event.get("label"),
        "tool": start_event.get("tool"),
        "status": status,
        "started_at": start_event.get("started_at"),
        "ended_at": ended_at,
        "duration_ms": max(0, ended_at - int(start_event.get("started_at", ended_at))),
    }
    if output is not None:
        payload["output"] = output
    if meta or start_event.get("meta"):
        payload["meta"] = meta or start_event.get("meta")
    return payload


def _compact_tool_result_for_message(tool_result: dict) -> dict:
    kind = tool_result.get("kind")
    if kind == "document":
        return {
            "kind": "document",
            "answer": tool_result.get("answer", ""),
            "sources": _compact_tool_sources(tool_result.get("sources", [])),
        }
    if kind == "asset":
        return {
            "kind": "asset",
            "answer": tool_result.get("answer", ""),
            "asset": _compact_asset(tool_result.get("asset", {})),
        }
    return tool_result


def run_tool_calling_agent(
    user_input: str,
    template_id: str | None = None,
    model: str | None = None,
    history: list[dict] | None = None,
    max_steps: int = MAX_REACT_STEPS,
) -> dict[str, Any]:
    started_at = perf_counter()
    caps = resolve_model_capabilities(model)
    llm = _get_llm(model)
    if not isinstance(llm, AgnesLLM):
        raise TypeError("Tool calling agent requires AgnesLLM")

    template = get_template(template_id) if template_id else None
    messages = build_tool_calling_messages(user_input, template, history)
    tools = get_tool_schemas()

    sources: list[dict] = []
    events: list[dict] = [
        {"type": "status", "message": "Starting native tool-calling agent"}
    ]
    react_steps: list[dict] = []
    final_answer = ""
    asset: dict | None = None

    for step in range(1, max_steps + 1):
        choice = llm.chat_with_tools(messages, tools=tools, tool_choice="auto")
        message = choice.get("message", {}) if isinstance(choice, dict) else {}
        content = (message.get("content") or "").strip()
        tool_calls = message.get("tool_calls") or []

        react_steps.append(
            {
                "step": step,
                "mode": "function_calling",
                "choice": choice,
            }
        )

        if not tool_calls:
            final_answer = content
            break

        messages.append(
            {
                "role": "assistant",
                "content": content or None,
                "tool_calls": tool_calls,
            }
        )

        for tool_call in tool_calls:
            function = tool_call.get("function", {})
            tool_name = function.get("name", "")
            arguments = _parse_arguments(function.get("arguments"))
            tool_input = extract_tool_input(tool_name, arguments)
            events.append({"type": "tool_start", "tool": tool_name, "input": tool_input})

            try:
                tool_result = execute_agent_tool(
                    tool_name,
                    arguments,
                    history=history,
                    template_id=template_id,
                    llm=llm,
                )
            except Exception as exc:
                observation = _format_error_observation(step, tool_name, exc)
                compact_result = {"kind": "error", "error": str(exc), "observation": observation}
                events.append(
                    {"type": "tool_result", "tool": tool_name, "output": {"error": str(exc)}}
                )
                messages.append(_tool_message(tool_call.get("id", f"call-{step}"), compact_result))
                continue

            if tool_result.get("kind") == "document":
                tool_sources = tool_result.get("sources", [])
                indexed_sources = _merge_sources(sources, tool_sources)
                observation = _format_document_observation(
                    step,
                    tool_name,
                    tool_input,
                    tool_result,
                    indexed_sources,
                )
                compact_result = _compact_tool_result_for_message(tool_result)
                compact_result["observation"] = observation
                events.append(
                    {
                        "type": "tool_result",
                        "tool": tool_name,
                        "output": {
                            "answer": tool_result.get("answer", "")[:1200],
                            "sources": _compact_tool_sources(tool_sources),
                        },
                    }
                )
                messages.append(_tool_message(tool_call.get("id", f"call-{step}"), compact_result))
                continue

            if tool_result.get("kind") == "asset":
                asset = tool_result.get("asset")
                if asset:
                    observation = _format_asset_observation(step, tool_input, asset)
                    compact_result = _compact_tool_result_for_message(tool_result)
                    compact_result["observation"] = observation
                    events.append(
                        {
                            "type": "tool_result",
                            "tool": tool_name,
                            "output": _compact_asset(asset),
                        }
                    )
                    messages.append(_tool_message(tool_call.get("id", f"call-{step}"), compact_result))
                final_answer = tool_result.get("answer", "") or "图片已生成。"
                break

        if final_answer:
            break

    if not final_answer:
        messages.append(
            {
                "role": "user",
                "content": "请基于已有工具结果给出最终答案。禁止继续调用工具。",
            }
        )
        final_answer = llm.chat_messages(messages)

    if not final_answer:
        final_answer = "我暂时无法基于当前信息完成回答。"

    total_ms = int((perf_counter() - started_at) * 1000)
    events.append(
        {"type": "status", "message": f"Tool-calling agent completed in {total_ms}ms"}
    )

    return {
        "answer": final_answer,
        "sources": sources,
        "asset": asset,
        "events": events,
        "react_steps": react_steps,
        "total_ms": total_ms,
        "agent_mode": caps.preferred_agent_mode,
    }


# ---------------------------------------------------------------------------
# Real-time streaming version of the tool-calling agent
# ---------------------------------------------------------------------------

def stream_tool_calling_agent(
    user_input: str,
    template_id: str | None = None,
    model: str | None = None,
    history: list[dict] | None = None,
    max_steps: int = MAX_REACT_STEPS,
):
    """Generator that yields StreamEvents in real-time as the agent executes.

    Unlike run_tool_calling_agent() which blocks until completion, this
    generator yields tool_start / tool_result events immediately when each
    tool is called, then streams the final answer token-by-token using
    AgnesLLM.stream_chat_messages().

    Yields NDJSON-compatible dicts matching the StreamEvent type:
        status, thinking, tool_start, tool_result, sources, delta, asset, done
    """
    started_at = perf_counter()
    llm = _get_llm(model)
    if not isinstance(llm, AgnesLLM):
        raise TypeError("Tool calling agent requires AgnesLLM")

    template = get_template(template_id) if template_id else None
    messages = build_tool_calling_messages(user_input, template, history)
    tools = get_tool_schemas()

    sources: list[dict] = []
    asset: dict | None = None
    # True when the LLM chose to produce a final answer (no tool_calls).
    # The answer text is stored here so we can stream it afterwards.
    pending_final_text: str = ""

    agent_node = _node_start("Agent 分析", "router", input={"mode": "agent"})
    yield agent_node
    yield _node_end(agent_node, output={"mode": "agent"})

    for step in range(1, max_steps + 1):
        choice = llm.chat_with_tools(messages, tools=tools, tool_choice="auto")
        message = choice.get("message", {}) if isinstance(choice, dict) else {}
        content = (message.get("content") or "").strip()
        tool_calls = message.get("tool_calls") or []

        if not tool_calls:
            # LLM decided to answer directly – content is the final answer.
            # We'll fake-stream it below (it's already generated, so it's instant).
            pending_final_text = content
            break

        # LLM wants to call tools → append its assistant message and execute tools.
        messages.append(
            {
                "role": "assistant",
                "content": content or None,
                "tool_calls": tool_calls,
            }
        )

        for tool_call in tool_calls:
            function = tool_call.get("function", {})
            tool_name = function.get("name", "")
            arguments = _parse_arguments(function.get("arguments"))
            tool_input = extract_tool_input(tool_name, arguments)

            tool_label = {
                "document_search": "搜索文档",
                "document_deep_search": "深度搜索",
                "image_generate": "生成图片",
                "direct_answer": "直接回答",
            }.get(tool_name, tool_name or "工具调用")
            tool_node = _node_start(
                tool_label,
                "tool",
                tool=tool_name,
                input=tool_input,
                meta={"step": step},
            )
            yield tool_node
            # ➡ yield tool_start immediately so the frontend shows progress
            yield {
                "type": "tool_start",
                "tool": tool_name,
                "input": tool_input,
                "node_id": tool_node["node_id"],
                "node_type": "tool",
                "label": tool_label,
                "status": "running",
                "started_at": tool_node["started_at"],
                "meta": tool_node.get("meta"),
            }

            try:
                tool_result = execute_agent_tool(
                    tool_name,
                    arguments,
                    history=history,
                    template_id=template_id,
                    llm=llm,
                )
            except Exception as exc:
                observation = _format_error_observation(step, tool_name, exc)
                compact_result = {"kind": "error", "error": str(exc), "observation": observation}
                tool_end = _node_end(tool_node, status="error", output={"error": str(exc)})
                yield {
                    "type": "tool_result",
                    "tool": tool_name,
                    "output": {"error": str(exc)},
                    "node_id": tool_node["node_id"],
                    "node_type": "tool",
                    "label": tool_label,
                    "status": "error",
                    "started_at": tool_node["started_at"],
                    "duration_ms": tool_end["duration_ms"],
                    "meta": tool_node.get("meta"),
                }
                yield tool_end
                messages.append(_tool_message(tool_call.get("id", f"call-{step}"), compact_result))
                continue

            if tool_result.get("kind") == "document":
                tool_sources = tool_result.get("sources", [])
                indexed_sources = _merge_sources(sources, tool_sources)
                observation = _format_document_observation(
                    step, tool_name, tool_input, tool_result, indexed_sources
                )
                compact_result = _compact_tool_result_for_message(tool_result)
                compact_result["observation"] = observation
                # ➡ yield tool_result immediately
                tool_end = _node_end(
                    tool_node,
                    output={"answer": tool_result.get("answer", "")[:1200], "sources_count": len(tool_sources)},
                )
                yield {
                    "type": "tool_result",
                    "tool": tool_name,
                    "output": {
                        "answer": tool_result.get("answer", "")[:1200],
                        "sources": _compact_tool_sources(tool_sources),
                    },
                    "node_id": tool_node["node_id"],
                    "node_type": "tool",
                    "label": tool_label,
                    "status": "success",
                    "started_at": tool_node["started_at"],
                    "duration_ms": tool_end["duration_ms"],
                    "meta": tool_node.get("meta"),
                }
                yield tool_end
                messages.append(_tool_message(tool_call.get("id", f"call-{step}"), compact_result))
                continue

            if tool_result.get("kind") == "asset":
                asset = tool_result.get("asset")
                if asset:
                    observation = _format_asset_observation(step, tool_input, asset)
                    compact_result = _compact_tool_result_for_message(tool_result)
                    compact_result["observation"] = observation
                    tool_end = _node_end(tool_node, output={"asset_id": asset.get("id")})
                    yield {
                        "type": "tool_result",
                        "tool": tool_name,
                        "output": _compact_asset(asset),
                        "node_id": tool_node["node_id"],
                        "node_type": "tool",
                        "label": tool_label,
                        "status": "success",
                        "started_at": tool_node["started_at"],
                        "duration_ms": tool_end["duration_ms"],
                        "meta": tool_node.get("meta"),
                    }
                    yield tool_end
                    messages.append(
                        _tool_message(tool_call.get("id", f"call-{step}"), compact_result)
                    )
                pending_final_text = tool_result.get("answer", "") or "图片已生成。"
                break

        if pending_final_text:
            break

    # If the agent looped through all steps without a final answer, force one via streaming.
    if not pending_final_text:
        messages.append(
            {
                "role": "user",
                "content": "请基于已有工具结果给出最终答案。禁止继续调用工具。",
            }
        )
        llm_node = _node_start("生成最终回答", "llm")
        yield llm_node
        # ➡ TRUE token-level streaming for the forced final answer
        chars = 0
        for token in llm.stream_chat_messages(messages):
            chars += len(token)
            yield {"type": "delta", "text": token}
        yield _node_end(llm_node, output={"chars": chars})
    else:
        # ➡ The answer was already generated by chat_with_tools(); stream it
        #    character-by-character so the frontend shows the typing effect.
        llm_node = _node_start("输出回答", "llm")
        yield llm_node
        for i in range(0, len(pending_final_text), 4):
            yield {"type": "delta", "text": pending_final_text[i: i + 4]}
        yield _node_end(llm_node, output={"chars": len(pending_final_text)})

    # Emit sources and optional asset after the answer
    if sources:
        yield {"type": "sources", "sources": _compact_tool_sources(sources)}
    if asset:
        yield {"type": "asset", "asset": asset}

    yield {"type": "done", "total_ms": int((perf_counter() - started_at) * 1000)}
