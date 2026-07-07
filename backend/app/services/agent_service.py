from __future__ import annotations

from time import perf_counter
from uuid import uuid4
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.core.asset_store import add_asset
from app.core.agnes_client import resolve_model_capabilities
from app.core.qdrant_client import init_qdrant
from app.core.agnes_llm import AgnesLLM
from app.core.metadata_store import list_documents
from app.core.template_store import get_template, list_templates
from app.services.chat_service import chat_with_assistant, stream_chat_with_assistant, build_assistant_messages
from app.services.image_service import generate_image
from app.services.rag_service import query_documents, prepare_document_query, stream_document_answer
from app.services.react_agent import _get_llm, run_react_agent
from app.services.tool_calling_agent import run_tool_calling_agent, stream_tool_calling_agent


class AgentState(TypedDict, total=False):
    user_input: str
    template_id: str | None
    workflow_id: str | None
    mode: str
    messages: list[dict]
    status: list[dict]
    sources: list[dict]
    answer: str
    asset: dict | None
    model: str | None
    react_steps: list[dict]


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


def _normalize_mode(mode: str | None, workflow_id: str | None) -> str:
    if mode in {"rag", "agent", "deep_research", "image", "assistant"}:
        return mode
    if workflow_id == "document_summary":
        return "rag"
    if workflow_id == "image_generation":
        return "image"
    return "agent"


def _classify_state(state: AgentState) -> AgentState:
    template = _find_template(state.get("template_id"), state["user_input"])
    if template:
        state["template_id"] = template["id"]
        state["workflow_id"] = template.get("workflow_id")
    else:
        state["workflow_id"] = state.get("workflow_id") or "assistant_plan"

    state["mode"] = _normalize_mode(state.get("mode"), state.get("workflow_id"))
    state.setdefault("status", []).append(
        {
            "type": "status",
            "message": f"Routing to {state['mode']} workflow",
        }
    )
    return state


def _document_node(state: AgentState) -> AgentState:
    state.setdefault("status", []).append({"type": "thinking", "text": "Planning document retrieval."})
    llm = _get_llm(state.get("model"))
    result = query_documents(state["user_input"], history=state.get("messages"), llm=llm)
    state["sources"] = result["sources"]
    state["answer"] = result["answer"]
    state.setdefault("status", []).append(
        {"type": "tool_start", "tool": "retriever", "input": state["user_input"]}
    )
    state.setdefault("status", []).append(
        {"type": "tool_result", "tool": "retriever", "output": {"sources": state["sources"]}}
    )
    return state


def _deep_research_node(state: AgentState) -> AgentState:
    state.setdefault("status", []).append({"type": "thinking", "text": "Running multi-step research."})
    llm = _get_llm(state.get("model"))
    result = query_documents(state["user_input"], top_k=5, history=state.get("messages"), llm=llm)
    state["sources"] = result["sources"]
    state.setdefault("status", []).append({"type": "tool_start", "tool": "retriever", "input": state["user_input"]})
    state.setdefault("status", []).append(
        {"type": "tool_result", "tool": "retriever", "output": {"sources": state["sources"]}}
    )
    state["answer"] = result["answer"]
    return state


def _image_node(state: AgentState) -> AgentState:
    state.setdefault("status", []).append({"type": "thinking", "text": "Generating image asset."})
    import asyncio

    result = asyncio.run(generate_image(state["user_input"]))
    first_image = result["images"][0]
    state["asset"] = add_asset(
        asset_type="image",
        title=state["user_input"][:80] or "Generated image",
        image_data=first_image.get("b64_json", ""),
        format="png",
        source_template_id=state.get("template_id"),
        source_question=state["user_input"],
    )
    state.setdefault("status", []).append({"type": "tool_result", "tool": "image", "output": state["asset"]})
    state["answer"] = first_image.get("revised_prompt") or state["user_input"]
    return state


def _assistant_node(state: AgentState) -> AgentState:
    state.setdefault("status", []).append({"type": "thinking", "text": "Answering without retrieval."})
    state["answer"] = chat_with_assistant(
        state["user_input"],
        history=state.get("messages"),
        model=state.get("model"),
    )
    return state


def _react_node(state: AgentState) -> AgentState:
    caps = resolve_model_capabilities(state.get("model"))
    if caps.supports_function_calling:
        try:
            result = run_tool_calling_agent(
                state["user_input"],
                template_id=state.get("template_id"),
                model=state.get("model"),
                history=state.get("messages"),
            )
        except Exception as exc:
            state.setdefault("status", []).append(
                {
                    "type": "status",
                    "message": f"Native tool calling failed, falling back to text ReAct: {str(exc)}",
                }
            )
            result = run_react_agent(
                state["user_input"],
                template_id=state.get("template_id"),
                model=state.get("model"),
                history=state.get("messages"),
            )
    else:
        result = run_react_agent(
            state["user_input"],
            template_id=state.get("template_id"),
            model=state.get("model"),
            history=state.get("messages"),
        )
    state["answer"] = result.get("answer", "")
    state["sources"] = result.get("sources", [])
    state["asset"] = result.get("asset")
    state["react_steps"] = result.get("react_steps", [])
    state.setdefault("status", []).extend(result.get("events", []))
    return state


def _build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("classify", _classify_state)
    graph.add_node("document", _document_node)
    graph.add_node("deep_research", _deep_research_node)
    graph.add_node("image", _image_node)
    graph.add_node("assistant", _assistant_node)
    graph.add_node("react", _react_node)

    graph.set_entry_point("classify")

    def route(state: AgentState) -> str:
        mode = state.get("mode", "agent")
        if mode == "image":
            return "image"
        if mode == "rag":
            return "document"
        if mode == "deep_research":
            return "deep_research"
        if mode == "assistant":
            return "assistant"
        return "react"

    graph.add_conditional_edges(
        "classify",
        route,
        {
            "document": "document",
            "deep_research": "deep_research",
            "image": "image",
            "assistant": "assistant",
            "react": "react",
        },
    )
    graph.add_edge("document", END)
    graph.add_edge("deep_research", END)
    graph.add_edge("image", END)
    graph.add_edge("assistant", END)
    graph.add_edge("react", END)
    return graph.compile()


_GRAPH = None


def _now_ms() -> int:
    return int(perf_counter() * 1000)


def _node_start(
    label: str,
    node_type: str,
    *,
    tool: str | None = None,
    input: Any = None,
    mode: str | None = None,
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
    if mode:
        payload["mode"] = mode
    if meta:
        payload["meta"] = meta
    return payload


def _node_end(
    start_event: dict,
    *,
    status: str = "success",
    output: Any = None,
    mode: str | None = None,
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
    if mode or start_event.get("mode"):
        payload["mode"] = mode or start_event.get("mode")
    if meta or start_event.get("meta"):
        payload["meta"] = meta or start_event.get("meta")
    return payload


def _get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = _build_graph()
    return _GRAPH


def _compact_sources(sources: list[dict]) -> list[dict]:
    compacted = []
    for index, source in enumerate(sources, start=1):
        compacted.append(
            {
                "source_id": source.get("source_id") or f"source-{index}",
                "text": source.get("text", "")[:1000],
                "score": source.get("score"),
                "file_name": source.get("file_name"),
                "document_title": source.get("document_title"),
                "chunk_index": source.get("chunk_index"),
                "page_number": source.get("page_number"),
                "file_path": source.get("file_path"),
            }
        )
    return compacted


def run_agent(
    user_input: str,
    template_id: str | None = None,
    mode: str = "agent",
    model: str | None = None,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    init_qdrant()

    started_at = perf_counter()
    state = AgentState(
        user_input=user_input,
        template_id=template_id,
        mode=mode,
        messages=history or [],
        model=model,
    )
    result = _get_graph().invoke(state)
    total_ms = int((perf_counter() - started_at) * 1000)

    payload = {
        "answer": result.get("answer", ""),
        "sources": _compact_sources(result.get("sources", [])),
        "asset": result.get("asset"),
        "mode": result.get("mode", "assistant"),
        "model": model,
        "total_ms": total_ms,
        "events": result.get("status", []),
        "react_steps": result.get("react_steps", []),
    }
    return payload


def stream_agent(
    user_input: str,
    template_id: str | None = None,
    mode: str = "agent",
    model: str | None = None,
    history: list[dict] | None = None,
):
    """Real-time streaming agent dispatcher.

    Routes to per-mode streaming generators so the first token reaches the
    client immediately rather than after the entire answer is assembled.

    Event sequence matches the NDJSON streaming protocol documented in AGENTS.md:
        status → (thinking / tool_start / tool_result)* → sources? → delta* → done
    """
    started_at = perf_counter()

    # Classify mode (re-use existing logic without building the full LangGraph)
    template = _find_template(template_id, user_input)
    workflow_id = template.get("workflow_id") if template else "assistant_plan"
    resolved_mode = _normalize_mode(mode, workflow_id, user_input)
    effective_template_id = template["id"] if template else template_id

    route_node = _node_start(
        "智能路由",
        "router",
        input={"mode": mode, "input": user_input[:100]},
        mode=resolved_mode,
    )
    yield route_node
    yield _node_end(
        route_node,
        output={"routed_mode": resolved_mode, "reason": f"自动识别为 {resolved_mode}"},
        mode=resolved_mode,
    )

    # ------------------------------------------------------------------ #
    # RAG / deep_research modes                                            #
    # ------------------------------------------------------------------ #
    if resolved_mode in ("rag", "deep_research"):
        top_k = 5 if resolved_mode == "deep_research" else 3
        retrieval_node = _node_start(
            "文档检索",
            "retriever",
            tool="retriever",
            input=user_input,
            mode=resolved_mode,
            meta={"top_k": top_k},
        )
        yield retrieval_node
        yield {
            "type": "tool_start",
            "tool": "retriever",
            "input": user_input,
            "node_id": retrieval_node["node_id"],
            "node_type": "retriever",
            "label": "文档检索",
            "status": "running",
            "started_at": retrieval_node["started_at"],
            "mode": resolved_mode,
        }

        llm = _get_llm(model)
        prepared = prepare_document_query(user_input, top_k=top_k, history=history or [])
        sources = _compact_sources(prepared.get("sources", []))
        prompt = prepared.get("prompt", "")
        no_sources_answer = prepared.get("answer", "")

        retrieval_end = _node_end(
            retrieval_node,
            output={"sources_count": len(sources)},
            mode=resolved_mode,
        )
        yield {
            "type": "tool_result",
            "tool": "retriever",
            "output": {"sources": sources},
            "node_id": retrieval_node["node_id"],
            "node_type": "retriever",
            "label": "文档检索",
            "status": "success",
            "started_at": retrieval_node["started_at"],
            "duration_ms": retrieval_end["duration_ms"],
            "mode": resolved_mode,
        }
        yield retrieval_end
        if sources:
            yield {"type": "sources", "sources": sources, "mode": resolved_mode}

        llm_node = _node_start("生成回答", "llm", mode=resolved_mode)
        yield llm_node
        chars = 0
        if prompt:
            for token in stream_document_answer(prompt, llm=llm):
                chars += len(token)
                yield {"type": "delta", "text": token}
        else:
            chars = len(no_sources_answer)
            yield {"type": "delta", "text": no_sources_answer}
        yield _node_end(llm_node, output={"chars": chars}, mode=resolved_mode)

        yield {"type": "done", "total_ms": int((perf_counter() - started_at) * 1000)}
        return

    # ------------------------------------------------------------------ #
    # Image generation mode                                                #
    # ------------------------------------------------------------------ #
    if resolved_mode == "image":
        import asyncio
        image_node = _node_start(
            "生成图片",
            "tool",
            tool="image_generate",
            input=user_input,
            mode=resolved_mode,
        )
        yield image_node
        yield {
            "type": "tool_start",
            "tool": "image_generate",
            "input": user_input,
            "node_id": image_node["node_id"],
            "node_type": "tool",
            "label": "生成图片",
            "status": "running",
            "started_at": image_node["started_at"],
            "mode": resolved_mode,
        }

        try:
            result = asyncio.run(generate_image(user_input))
            first_image = result["images"][0]
            asset = add_asset(
                asset_type="image",
                title=user_input[:80] or "Generated image",
                image_data=first_image.get("b64_json", ""),
                format="png",
                source_template_id=effective_template_id,
                source_question=user_input,
            )
            image_end = _node_end(image_node, output={"asset_id": asset.get("id")}, mode=resolved_mode)
            yield {
                "type": "tool_result",
                "tool": "image_generate",
                "output": asset,
                "node_id": image_node["node_id"],
                "node_type": "tool",
                "label": "生成图片",
                "status": "success",
                "started_at": image_node["started_at"],
                "duration_ms": image_end["duration_ms"],
                "mode": resolved_mode,
            }
            yield image_end
            yield {"type": "asset", "asset": asset}
            answer = first_image.get("revised_prompt") or user_input
        except Exception as exc:
            yield _node_end(image_node, status="error", output={"error": str(exc)}, mode=resolved_mode)
            answer = f"图片生成失败：{exc}"

        for i in range(0, len(answer), 8):
            yield {"type": "delta", "text": answer[i: i + 8]}
        yield {"type": "done", "total_ms": int((perf_counter() - started_at) * 1000)}
        return

    # ------------------------------------------------------------------ #
    # Assistant mode (no documents, plain chat)                            #
    # ------------------------------------------------------------------ #
    if resolved_mode == "assistant":
        assistant_node = _node_start("助手回答", "assistant", mode=resolved_mode)
        yield assistant_node
        llm_obj = _get_llm(model)
        chars = 0
        if isinstance(llm_obj, AgnesLLM):
            messages = build_assistant_messages(user_input, history)
            for token in llm_obj.stream_chat_messages(messages):
                chars += len(token)
                yield {"type": "delta", "text": token}
        else:
            for token in stream_chat_with_assistant(user_input, history=history, model=model):
                chars += len(token)
                yield {"type": "delta", "text": token}
        yield _node_end(assistant_node, output={"chars": chars}, mode=resolved_mode)
        yield {"type": "done", "total_ms": int((perf_counter() - started_at) * 1000)}
        return

    # ------------------------------------------------------------------ #
    # Agent mode: tool-calling (preferred) or ReAct fallback              #
    # ------------------------------------------------------------------ #
    caps = resolve_model_capabilities(model)
    if caps.supports_function_calling:
        try:
            yield from stream_tool_calling_agent(
                user_input,
                template_id=effective_template_id,
                model=model,
                history=history,
            )
            return
        except Exception as exc:
            yield {
                "type": "status",
                "message": f"⚠️ 原生工具调用失败，切换至 ReAct：{exc}",
                "mode": resolved_mode,
            }

    # ReAct fallback (still blocking; real streaming would require ReAct refactor)
    yield {"type": "status", "message": "🔍 ReAct 推理中...", "mode": resolved_mode}
    result = run_react_agent(
        user_input,
        template_id=effective_template_id,
        model=model,
        history=history,
    )

    for event in result.get("events", []):
        event.setdefault("mode", resolved_mode)
        yield event

    sources = _compact_sources(result.get("sources", []))
    if sources:
        yield {"type": "sources", "sources": sources, "mode": resolved_mode}

    if result.get("asset"):
        yield {"type": "asset", "asset": result["asset"]}

    answer = result.get("answer", "")
    if answer:
        yield {"type": "status", "message": "📝 正在输出回答...", "mode": resolved_mode}
        llm_obj = _get_llm(model)
        if isinstance(llm_obj, AgnesLLM):
            # We already have the full answer from ReAct; stream in small chunks
            for i in range(0, len(answer), 4):
                yield {"type": "delta", "text": answer[i: i + 4]}
        else:
            for i in range(0, len(answer), 8):
                yield {"type": "delta", "text": answer[i: i + 8]}

    yield {"type": "done", "total_ms": int((perf_counter() - started_at) * 1000)}
