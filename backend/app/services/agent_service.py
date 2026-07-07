"""Compatibility facade for the Agent Core package.

New code should import from ``app.agent``. This module remains for existing API
routes and tests while the Phase 1 architecture refactor lands incrementally.
"""

from app.agent import run_agent, stream_agent

__all__ = ["run_agent", "stream_agent"]
