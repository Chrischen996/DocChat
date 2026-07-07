from __future__ import annotations

from app.tools.base import Tool

_TOOLS: dict[str, Tool] = {}


def register_tool(tool: Tool) -> None:
    """Register or replace a tool by name."""
    _TOOLS[tool.name] = tool


def get_tool(name: str) -> Tool | None:
    """Return a registered tool by name."""
    return _TOOLS.get(name)


def list_tools() -> list[Tool]:
    """Return all registered tools."""
    return list(_TOOLS.values())


def format_tools_for_llm() -> str:
    """Format registered tools for planner prompts."""
    lines = []
    for tool in _TOOLS.values():
        params = ", ".join(f"{key}: {value}" for key, value in tool.input_schema.items())
        lines.append(f"- {tool.name}({params}): {tool.description}")
    return "\n".join(lines)
