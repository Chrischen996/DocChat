"""Agent Core package.

This package separates planning, workflow routing, execution, and service facade
logic so DocChat can evolve into a tool-driven Agent runtime.
"""

from app.agent.service import run_agent, stream_agent

__all__ = ["run_agent", "stream_agent"]
