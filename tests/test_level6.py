from __future__ import annotations

import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.agent_service import QualityLevel, _evaluate_tool_result


def test_search_quality_poor_triggers_correction() -> None:
    """Empty document search results should be marked poor and suggest corrections."""
    result = {"success": True, "output": {"sources": [], "answer": ""}, "error": None}

    evaluation = _evaluate_tool_result("search_documents", result, "测试查询")

    assert evaluation["quality"] == QualityLevel.POOR
    assert evaluation["score"] < 0.6
    assert evaluation["suggestions"]


def test_tool_failure_is_poor_quality() -> None:
    """Tool execution errors should be converted into poor quality feedback."""
    result = {"success": False, "output": None, "error": "boom"}

    evaluation = _evaluate_tool_result("chat", result, "测试查询")

    assert evaluation["quality"] == QualityLevel.POOR
    assert evaluation["score"] == 0.0
    assert "boom" in evaluation["reason"]
