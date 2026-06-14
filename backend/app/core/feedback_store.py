"""
Local JSON persistence for chat feedback.
"""

from __future__ import annotations

import json
from pathlib import Path
from threading import Lock

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_FEEDBACK_PATH = _BASE_DIR / "data" / "feedback.json"

_feedback_lock = Lock()


def _read_feedback() -> list[dict]:
    if not _FEEDBACK_PATH.exists():
        return []
    try:
        data = json.loads(_FEEDBACK_PATH.read_text(encoding="utf-8"))
        return data.get("feedback", [])
    except (json.JSONDecodeError, KeyError):
        return []


def _write_feedback(entries: list[dict]) -> None:
    _FEEDBACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    _FEEDBACK_PATH.write_text(
        json.dumps({"feedback": entries}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def add_feedback(entry: dict) -> int:
    with _feedback_lock:
        entries = _read_feedback()
        entries.append(entry)
        _write_feedback(entries[-1000:])
        return len(entries)

