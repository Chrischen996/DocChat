from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class Tool:
    """Synchronous tool definition used by the Agent executor."""

    name: str
    description: str
    func: Callable[..., Any]
    input_schema: dict[str, str]

    def execute(self, **kwargs: Any) -> dict[str, Any]:
        """Execute a tool and normalize success/error results."""
        try:
            result = self.func(**kwargs)
            return {"success": True, "output": result, "error": None}
        except Exception as exc:
            return {"success": False, "output": None, "error": str(exc)}
