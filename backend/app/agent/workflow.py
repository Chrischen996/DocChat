from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agent.executor import assistant_node, chain_node, document_node, image_node
from app.agent.planner import classify_state
from app.agent.state import AgentState


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("classify", classify_state)
    graph.add_node("document", document_node)
    graph.add_node("image", image_node)
    graph.add_node("assistant", assistant_node)
    graph.add_node("chain", chain_node)

    graph.set_entry_point("classify")

    def route(state: AgentState) -> str:
        if state.get("mode") == "chain":
            return "chain"
        if state.get("mode") == "image":
            return "image"
        if state.get("mode") == "document":
            return "document"
        return "assistant"

    graph.add_conditional_edges(
        "classify",
        route,
        {"chain": "chain", "document": "document", "image": "image", "assistant": "assistant"},
    )
    graph.add_edge("chain", END)
    graph.add_edge("document", END)
    graph.add_edge("image", END)
    graph.add_edge("assistant", END)
    return graph.compile()
