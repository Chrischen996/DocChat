from __future__ import annotations

import asyncio
from time import perf_counter
from typing import Any

from app.agent.executor import chain_node
from app.agent.planner import classify_state
from app.agent.state import AgentState
from app.agent.workflow import build_graph
from app.core.asset_store import add_asset
from app.services.chat_service import stream_chat_with_assistant
from app.services.image_service import generate_image
from app.services.rag_service import stream_query_documents

_GRAPH = build_graph()


def run_agent(
    user_input: str,
    template_id: str | None = None,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    started_at = perf_counter()
    state = AgentState(user_input=user_input, template_id=template_id, messages=history or [])
    result = _GRAPH.invoke(state)
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

    state = AgentState(user_input=user_input, template_id=template_id, messages=history or [])
    state = classify_state(state)
    for event in state.get("status", []):
        yield event

    mode = state.get("mode", "assistant")

    if mode == "document":
        yield from stream_query_documents(user_input, history=history)
    elif mode == "image":
        yield {"type": "status", "message": "正在生成图片..."}
        result = asyncio.run(generate_image(user_input))
        first_image = result["images"][0]
        asset = add_asset(
            asset_type="image",
            title=user_input[:80] or "生成图片",
            image_data=first_image.get("b64_json", ""),
            format="png",
            source_template_id=state.get("template_id"),
            source_question=user_input,
        )
        yield {"type": "asset", "asset": asset}
        answer = first_image.get("revised_prompt") or user_input
        if answer:
            yield {"type": "delta", "text": answer}
    elif mode == "chain":
        before_status_count = len(state.get("status", []))
        result_state = chain_node(state)
        for event in result_state.get("status", [])[before_status_count:]:
            yield event
        if result_state.get("sources"):
            yield {"type": "sources", "sources": result_state["sources"]}
        if result_state.get("asset"):
            yield {"type": "asset", "asset": result_state["asset"]}
        answer = result_state.get("answer", "")
        if answer:
            for index in range(0, len(answer), 32):
                yield {"type": "delta", "text": answer[index : index + 32]}
    else:
        yield {"type": "status", "message": "正在生成回答..."}
        for delta in stream_chat_with_assistant(user_input, history=history):
            yield {"type": "delta", "text": delta}

    yield {"type": "done", "total_ms": int((perf_counter() - started_at) * 1000)}
