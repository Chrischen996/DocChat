from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AgentToolSpec:
    """Unified tool definition for prompt-based ReAct and function calling."""

    name: str
    description: str
    input_key: str
    input_description: str

    def to_function_schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        self.input_key: {
                            "type": "string",
                            "description": self.input_description,
                        }
                    },
                    "required": [self.input_key],
                },
            },
        }


AGENT_TOOLS: dict[str, AgentToolSpec] = {
    "document_search": AgentToolSpec(
        name="document_search",
        description="在已上传文档中检索相关片段，适合回答需要文档证据的问题。",
        input_key="query",
        input_description="查询关键词或自然语言问题",
    ),
    "document_deep_search": AgentToolSpec(
        name="document_deep_search",
        description="在已上传文档中进行更广泛检索，适合复杂分析、跨段落比较或一次检索不足的情况。",
        input_key="query",
        input_description="更完整的查询关键词或分析问题",
    ),
    "image_generate": AgentToolSpec(
        name="image_generate",
        description="根据描述生成一张图片资产，适合海报、插图、配图等视觉内容任务。",
        input_key="prompt",
        input_description="图片描述，包含主题、风格、构图和用途",
    ),
}


def get_tool_schemas() -> list[dict[str, Any]]:
    """Return OpenAI-compatible function calling schemas."""
    return [tool.to_function_schema() for tool in AGENT_TOOLS.values()]


def extract_tool_input(tool_name: str, arguments: dict[str, Any]) -> str:
    """Convert function-call JSON arguments to the legacy string tool input."""
    spec = AGENT_TOOLS.get(tool_name)
    if spec and arguments.get(spec.input_key):
        return str(arguments[spec.input_key]).strip()

    for fallback_key in ("query", "prompt", "input", "text", "question"):
        if arguments.get(fallback_key):
            return str(arguments[fallback_key]).strip()

    return str(arguments)


def execute_agent_tool(
    tool_name: str,
    arguments: dict[str, Any],
    history: list[dict] | None = None,
    template_id: str | None = None,
    llm=None,
) -> dict:
    """Execute a function-called tool via the existing ReAct tool executor.

    This compatibility wrapper lets the Function Calling MVP reuse the current
    RAG/image/direct-answer tool implementation without duplicating business
    logic. A future refactor can move all tool execution here permanently.
    """
    from app.services.react_agent import execute_react_tool

    tool_input = extract_tool_input(tool_name, arguments)
    return execute_react_tool(
        tool_name,
        tool_input,
        history=history,
        template_id=template_id,
        llm=llm,
    )
