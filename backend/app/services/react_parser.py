from __future__ import annotations

import re
from typing import Literal, TypedDict


class ParsedReactOutput(TypedDict, total=False):
    """Parsed result from a text-format ReAct response."""

    type: Literal["action", "final"]
    thought: str
    tool: str
    tool_input: str
    answer: str
    raw: str


THOUGHT_RE = re.compile(
    r"(?:^|\n)\s*THOUGHT\s*:\s*(.+?)(?=\n\s*(?:ACTION|ACTION_INPUT|ACTION INPUT|FINAL_ANSWER|FINAL ANSWER)\s*:|$)",
    re.IGNORECASE | re.DOTALL,
)
ACTION_RE = re.compile(
    r"(?:^|\n)\s*ACTION\s*:\s*([a-zA-Z_][\w-]*)",
    re.IGNORECASE,
)
ACTION_INPUT_RE = re.compile(
    r"(?:^|\n)\s*(?:ACTION_INPUT|ACTION INPUT)\s*:\s*(.+?)(?=\n\s*(?:THOUGHT|ACTION|FINAL_ANSWER|FINAL ANSWER)\s*:|$)",
    re.IGNORECASE | re.DOTALL,
)
FINAL_RE = re.compile(
    r"(?:^|\n)\s*(?:FINAL_ANSWER|FINAL ANSWER)\s*:\s*(.+)",
    re.IGNORECASE | re.DOTALL,
)
THINK_RE = re.compile(r"<think>.*?</think>", re.IGNORECASE | re.DOTALL)
MARKDOWN_LABEL_RE = re.compile(
    r"(?im)^\s*(?:#{1,6}\s*)?(?:\*\*)?"
    r"(THOUGHT|ACTION_INPUT|ACTION INPUT|ACTION|FINAL_ANSWER|FINAL ANSWER)"
    r"(?:\*\*)?\s*:?[ \t]*(.*)$"
)


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```") or not stripped.endswith("```"):
        return stripped

    lines = stripped.splitlines()
    if len(lines) <= 2:
        return stripped.strip("`").strip()
    return "\n".join(lines[1:-1]).strip()


def _normalize_markdown_labels(text: str) -> str:
    """Normalize common model-specific Markdown label variants.

    Examples handled:
    - ## Thought
    - **ACTION:** document_search
    - ### Final Answer: ...
    """

    text = re.sub(r"(?im)^\s*\*\*(THOUGHT|ACTION_INPUT|ACTION INPUT|ACTION|FINAL_ANSWER|FINAL ANSWER):\*\*", r"\1:", text)

    def replace(match: re.Match) -> str:
        label = match.group(1).upper().replace(" ", "_")
        rest = match.group(2).strip().removeprefix("**").strip()
        return f"{label}: {rest}" if rest else f"{label}:"

    return MARKDOWN_LABEL_RE.sub(replace, text)


def _preprocess_react_text(text: str) -> str:
    candidate = _strip_code_fence(text)
    candidate = THINK_RE.sub("", candidate).strip()
    candidate = _normalize_markdown_labels(candidate)
    return candidate.strip()


def _extract_thought(text: str) -> str:
    match = THOUGHT_RE.search(text)
    return match.group(1).strip() if match else ""


def _normalize_tool_name(tool_name: str) -> str:
    return tool_name.strip().lower().replace("-", "_")


def parse_react_output(text: str) -> ParsedReactOutput:
    """Parse a pure-text ReAct response into either an action or a final answer.

    Supported formats:

    THOUGHT: ...
    ACTION: document_search
    ACTION_INPUT: query

    or:

    THOUGHT: ...
    FINAL_ANSWER: answer

    If the model does not follow the format, the full text is treated as a final
    answer so the agent can fail soft instead of crashing the request.
    """

    raw = text or ""
    candidate = _preprocess_react_text(raw)
    thought = _extract_thought(candidate)

    final_match = FINAL_RE.search(candidate)
    if final_match:
        return {
            "type": "final",
            "thought": thought,
            "answer": final_match.group(1).strip(),
            "raw": raw,
        }

    action_match = ACTION_RE.search(candidate)
    if action_match:
        action_input_match = ACTION_INPUT_RE.search(candidate)
        return {
            "type": "action",
            "thought": thought,
            "tool": _normalize_tool_name(action_match.group(1)),
            "tool_input": action_input_match.group(1).strip() if action_input_match else "",
            "raw": raw,
        }

    return {
        "type": "final",
        "thought": thought,
        "answer": candidate.strip(),
        "raw": raw,
    }
