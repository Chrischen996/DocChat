from __future__ import annotations

import ast
import asyncio
import operator
from dataclasses import dataclass
from typing import Any, Callable

from app.services.chat_service import chat_with_assistant
from app.services.image_service import generate_image
from app.services.rag_service import query_documents


@dataclass(frozen=True)
class Tool:
    """A small synchronous tool definition used by the Agent executor."""

    name: str
    description: str
    func: Callable[..., Any]
    input_schema: dict[str, str]

    def execute(self, **kwargs: Any) -> dict[str, Any]:
        """Execute the tool and normalize success/error results."""
        try:
            result = self.func(**kwargs)
            return {"success": True, "output": result, "error": None}
        except Exception as exc:
            return {"success": False, "output": None, "error": str(exc)}


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


def _search_documents_wrapper(query: str, history: list[dict] | None = None) -> dict[str, Any]:
    result = query_documents(query, history=history)
    sources = result.get("sources", [])
    return {
        "answer": result.get("answer", ""),
        "sources": sources,
        "source_count": len(sources),
    }


def _generate_image_wrapper(prompt: str) -> dict[str, str]:
    result = asyncio.run(generate_image(prompt))
    images = result.get("images", [])
    if not images:
        raise RuntimeError("图片服务未返回图片")

    first_image = images[0]
    return {
        "image_data": first_image.get("b64_json", ""),
        "revised_prompt": first_image.get("revised_prompt", prompt),
    }


def _chat_wrapper(message: str, history: list[dict] | None = None) -> str:
    return chat_with_assistant(message, history=history)


def _calculate_wrapper(expression: str) -> float:
    ops = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
    }

    def _eval(node: ast.AST) -> float:
        if isinstance(node, ast.Constant) and isinstance(node.value, int | float):
            return node.value
        if isinstance(node, ast.Num):
            return node.n
        if isinstance(node, ast.BinOp) and type(node.op) in ops:
            return ops[type(node.op)](_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in ops:
            return ops[type(node.op)](_eval(node.operand))
        raise ValueError("不支持的表达式")

    return _eval(ast.parse(expression, mode="eval").body)


register_tool(
    Tool(
        name="search_documents",
        description="在已上传的文档中搜索信息，适用于查询财报、合同、报告等文件内容",
        func=_search_documents_wrapper,
        input_schema={"query": "str", "history": "list[dict] | None"},
    )
)

register_tool(
    Tool(
        name="generate_image",
        description="根据文字描述生成图片、海报、插画、图表",
        func=_generate_image_wrapper,
        input_schema={"prompt": "str"},
    )
)

register_tool(
    Tool(
        name="chat",
        description="与 AI 助手对话，用于分析、总结、解释信息，不访问文档或生成图片",
        func=_chat_wrapper,
        input_schema={"message": "str", "history": "list[dict] | None"},
    )
)

register_tool(
    Tool(
        name="calculate",
        description="执行数学计算，支持 +、-、*、/、** 运算",
        func=_calculate_wrapper,
        input_schema={"expression": "str"},
    )
)

