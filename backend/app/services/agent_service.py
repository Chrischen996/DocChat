from __future__ import annotations

from time import perf_counter
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.core.asset_store import add_asset
from app.core.qdrant_client import init_qdrant
from app.core.template_store import get_template, list_templates
from app.services.chat_service import chat_with_assistant, stream_chat_with_assistant
from app.services.image_service import generate_image
from app.services.rag_service import query_documents


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
    if mode in {"rag", "agent", "deep_research", "image"}:
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
    result = query_documents(state["user_input"], history=state.get("messages"))
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
    result = query_documents(state["user_input"], top_k=5, history=state.get("messages"))
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


def _build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("classify", _classify_state)
    graph.add_node("document", _document_node)
    graph.add_node("deep_research", _deep_research_node)
    graph.add_node("image", _image_node)
    graph.add_node("assistant", _assistant_node)

    graph.set_entry_point("classify")

    def route(state: AgentState) -> str:
        mode = state.get("mode", "agent")
        if mode == "image":
            return "image"
        if mode == "rag":
            return "document"
        if mode == "deep_research":
            return "deep_research"
        return "assistant"

    graph.add_conditional_edges(
        "classify",
        route,
        {
            "document": "document",
            "deep_research": "deep_research",
            "image": "image",
            "assistant": "assistant",
        },
    )
    graph.add_edge("document", END)
    graph.add_edge("deep_research", END)
    graph.add_edge("image", END)
    graph.add_edge("assistant", END)
    return graph.compile()


_GRAPH = None


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
    }
    return payload


def stream_agent(
    user_input: str,
    template_id: str | None = None,
    mode: str = "agent",
    model: str | None = None,
    history: list[dict] | None = None,
):
    started_at = perf_counter()
    yield {"type": "status", "message": "Starting agent run", "mode": mode}
    result = run_agent(user_input, template_id=template_id, mode=mode, model=model, history=history)

    for event in result.get("events", []):
        event["mode"] = result.get("mode", mode)
        yield event

    if result["sources"]:
        yield {"type": "sources", "sources": result["sources"], "mode": result.get("mode", mode)}

    if result.get("asset"):
        yield {"type": "tool_result", "tool": "asset", "output": result["asset"]}
        yield {"type": "asset", "asset": result["asset"]}

    answer = result["answer"]
    if answer:
        yield {"type": "status", "message": "Streaming final answer", "mode": result.get("mode", mode)}
        for index in range(0, len(answer), 32):
            yield {"type": "delta", "text": answer[index : index + 32]}

    yield {"type": "done", "total_ms": int((perf_counter() - started_at) * 1000)}
