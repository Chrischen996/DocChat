from __future__ import annotations

from enum import Enum
from typing import TypedDict


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
    intent_reason: str
    tool_plan: list[dict]


class QualityLevel(str, Enum):
    """Tool execution result quality levels used by the self-correction loop."""

    EXCELLENT = "excellent"
    GOOD = "good"
    ACCEPTABLE = "acceptable"
    POOR = "poor"
