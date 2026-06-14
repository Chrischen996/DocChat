from __future__ import annotations

from time import perf_counter
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.core.asset_store import add_asset
from app.core.qdrant_client import init_qdrant
from app.core.template_store import get_template, list_templates
from app.services.chat_service import chat_with_assistant
from app.services.image_service import generate_image
from app.services.rag_service import query_documents


class AgentState(TypedDict, total=False):
    user_input: str
    template_id: str | None
    workflow_id: str | None
    messages: list[dict]
    status: list[dict]
    sources: list[dict]
    answer: str
    asset: dict | None
    mode: str


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


def _classify_state(state: AgentState) -> AgentState:
    template = _find_template(state.get("template_id"), state["user_input"])
    if template:
        state["template_id"] = template["id"]
        state["workflow_id"] = template.get("workflow_id")
    else:
        state["workflow_id"] = state.get("workflow_id") or "assistant_plan"

    if state["workflow_id"] == "image_generation":
        state["mode"] = "image"
    elif state["workflow_id"] == "document_summary":
        state["mode"] = "document"
    else:
        state["mode"] = "assistant"

    state.setdefault("status", []).append(
        {
            "type": "status",
            "message": f"已进入 {state['workflow_id']} 工作流",
        }
    )
    return state


def _document_node(state: AgentState) -> AgentState:
    state.setdefault("status", []).append({"type": "status", "message": "正在检索文档片段..."})
    result = query_documents(state["user_input"], history=state.get("messages"))
    state["sources"] = result["sources"]
    state["answer"] = result["answer"]
    state.setdefault("status", []).append({"type": "sources", "sources": state["sources"]})
    return state


def _image_node(state: AgentState) -> AgentState:
    state.setdefault("status", []).append({"type": "status", "message": "正在生成图片..."})
    import asyncio

    result = asyncio.run(generate_image(state["user_input"]))
    first_image = result["images"][0]
    state["asset"] = add_asset(
        asset_type="image",
        title=state["user_input"][:80] or "生成图片",
        image_data=first_image.get("b64_json", ""),
        format="png",
        source_template_id=state.get("template_id"),
        source_question=state["user_input"],
    )
    state.setdefault("status", []).append({"type": "asset", "asset": state["asset"]})
    state["answer"] = first_image.get("revised_prompt") or state["user_input"]
    return state


def _assistant_node(state: AgentState) -> AgentState:
    state.setdefault("status", []).append({"type": "status", "message": "正在生成回答..."})
    state["answer"] = chat_with_assistant(state["user_input"], history=state.get("messages"))
    return state


def _build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("classify", _classify_state)
    graph.add_node("document", _document_node)
    graph.add_node("image", _image_node)
    graph.add_node("assistant", _assistant_node)

    graph.set_entry_point("classify")

    def route(state: AgentState) -> str:
        if state.get("mode") == "image":
            return "image"
        if state.get("mode") == "document":
            return "document"
        return "assistant"

    graph.add_conditional_edges("classify", route, {"document": "document", "image": "image", "assistant": "assistant"})
    graph.add_edge("document", END)
    graph.add_edge("image", END)
    graph.add_edge("assistant", END)
    return graph.compile()


_GRAPH = None


def _get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = _build_graph()
    return _GRAPH


def run_agent(
    user_input: str,
    template_id: str | None = None,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    init_qdrant()

    started_at = perf_counter()
    state = AgentState(user_input=user_input, template_id=template_id, messages=history or [])
    result = _get_graph().invoke(state)
    total_ms = int((perf_counter() - started_at) * 1000)

    payload = {
        "answer": result.get("answer", ""),
        "sources": result.get("sources", []),
        "asset": result.get("asset"),
        "mode": result.get("mode", "assistant"),
        "total_ms": total_ms,
    }

    if result.get("asset"):
        payload["asset"] = result["asset"]

    return payload


def stream_agent(
    user_input: str,
    template_id: str | None = None,
    history: list[dict] | None = None,
):
    started_at = perf_counter()
    yield {"type": "status", "message": "正在分析任务..."}
    result = run_agent(user_input, template_id=template_id, history=history)

    if result["sources"]:
        yield {"type": "sources", "sources": result["sources"]}

    if result.get("asset"):
        yield {"type": "asset", "asset": result["asset"]}

    answer = result["answer"]
    if answer:
        for index in range(0, len(answer), 32):
            yield {"type": "delta", "text": answer[index : index + 32]}

    yield {"type": "done", "total_ms": int((perf_counter() - started_at) * 1000)}
