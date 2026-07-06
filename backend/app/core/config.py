from __future__ import annotations

import os


class AgentConfig:
    """Agent runtime configuration sourced from environment variables."""

    ENABLE_TOOL_CHAIN = os.getenv("ENABLE_TOOL_CHAIN", "false").lower() == "true"
    MAX_CHAIN_STEPS = int(os.getenv("MAX_CHAIN_STEPS", "5"))
    PLANNER_TIMEOUT = int(os.getenv("PLANNER_TIMEOUT", "10"))
    ENABLE_SELF_CORRECTION = os.getenv("ENABLE_SELF_CORRECTION", "false").lower() == "true"
    MAX_CORRECTION_LOOPS = int(os.getenv("MAX_CORRECTION_LOOPS", "3"))
    MIN_QUALITY_THRESHOLD = float(os.getenv("MIN_QUALITY_THRESHOLD", "0.6"))
