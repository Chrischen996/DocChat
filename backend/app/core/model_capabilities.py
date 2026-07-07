"""
Model Capability Registry

Centralises per-model capability metadata so that agent routing, prompt
building, and output parsing can adapt automatically without scattering
``if model.startswith(...)`` guards across the codebase.

Usage::

    from app.core.model_capabilities import get_model_capabilities

    caps = get_model_capabilities("claude-sonnet-4")
    if caps.supports_function_calling:
        # use tool_calling_agent
    elif caps.emits_thinking_tags:
        # pre-process <think> tags
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ModelCapabilities:
    """Immutable capability profile for a single model.

    Attributes:
        model_id: Canonical model identifier (after alias resolution).
        provider: Provider label ("agnes", "openai", "anthropic", "google",
                  "deepseek").
        context_window: Maximum input context in tokens.
        max_output_tokens: Recommended (safe) max output token count.
        supports_system_message: Whether the model honours a system-role
            message in Chat Completions. If False, callers must flatten
            system content into the first user message.
        supports_streaming: Whether the model supports SSE streaming.
        supports_function_calling: Whether the model can use the
            ``tools`` + ``tool_calls`` Chat Completions interface.
        supports_parallel_tool_calls: Whether the model may return multiple
            tool_calls in a single response turn.
        supports_tool_streaming: Whether tool_calls are returned incrementally
            during streaming (vs. only in the final chunk).
        supports_json_mode: Whether the model supports
            ``response_format={"type": "json_object"}``.
        emits_thinking_tags: Whether the model wraps internal reasoning in
            ``<think>...</think>`` XML tags that must be stripped before
            further processing.
        preferred_agent_mode: Hint for agent routing.  One of:
            - ``"function_calling"`` – use native tool-use loop
            - ``"react_text"``       – use text-format ReAct loop
    """

    model_id: str
    provider: str

    # ---- context and output ----
    context_window: int = 128_000
    max_output_tokens: int = 4_096

    # ---- API capabilities ----
    supports_system_message: bool = True
    supports_streaming: bool = True
    supports_function_calling: bool = False
    supports_parallel_tool_calls: bool = False
    supports_tool_streaming: bool = False
    supports_json_mode: bool = False

    # ---- output format quirks ----
    emits_thinking_tags: bool = False

    # ---- agent routing hint ----
    preferred_agent_mode: str = "react_text"


# ---------------------------------------------------------------------------
# Per-model capability entries
#
# Keys must match the *resolved* model names used in MODEL_ALIASES inside
# agnes_client.py (i.e., the string that ends up in the Agnes API payload).
# ---------------------------------------------------------------------------

_REGISTRY: dict[str, ModelCapabilities] = {
    # ------------------------------------------------------------------
    # Agnes proprietary models
    # ------------------------------------------------------------------
    "agnes-2.0-flash": ModelCapabilities(
        model_id="agnes-2.0-flash",
        provider="agnes",
        context_window=128_000,
        max_output_tokens=4_096,
        supports_function_calling=False,
        supports_json_mode=False,
        preferred_agent_mode="react_text",
    ),

    # ------------------------------------------------------------------
    # DeepSeek models (routed via Agnes hub)
    # ------------------------------------------------------------------
    "deepseek-r1": ModelCapabilities(
        model_id="deepseek-r1",
        provider="deepseek",
        context_window=64_000,
        max_output_tokens=8_192,
        supports_function_calling=False,
        supports_json_mode=False,
        emits_thinking_tags=True,
        preferred_agent_mode="react_text",
    ),
    "deepseek-v3": ModelCapabilities(
        model_id="deepseek-v3",
        provider="deepseek",
        context_window=128_000,
        max_output_tokens=8_192,
        supports_function_calling=False,
        supports_json_mode=False,
        preferred_agent_mode="react_text",
    ),

    # ------------------------------------------------------------------
    # OpenAI models (routed via Agnes hub)
    # ------------------------------------------------------------------
    "gpt-4.1": ModelCapabilities(
        model_id="gpt-4.1",
        provider="openai",
        context_window=128_000,
        max_output_tokens=16_384,
        supports_function_calling=True,
        supports_parallel_tool_calls=True,
        supports_tool_streaming=True,
        supports_json_mode=True,
        preferred_agent_mode="function_calling",
    ),
    "gpt-5": ModelCapabilities(
        model_id="gpt-5",
        provider="openai",
        context_window=128_000,
        max_output_tokens=16_384,
        supports_function_calling=True,
        supports_parallel_tool_calls=True,
        supports_tool_streaming=True,
        supports_json_mode=True,
        preferred_agent_mode="function_calling",
    ),

    # ------------------------------------------------------------------
    # Anthropic models (routed via Agnes hub)
    # ------------------------------------------------------------------
    "claude-sonnet-4": ModelCapabilities(
        model_id="claude-sonnet-4",
        provider="anthropic",
        context_window=200_000,
        max_output_tokens=8_096,
        supports_function_calling=True,
        supports_parallel_tool_calls=True,
        supports_tool_streaming=False,
        supports_json_mode=False,
        preferred_agent_mode="function_calling",
    ),
    "claude-opus-4": ModelCapabilities(
        model_id="claude-opus-4",
        provider="anthropic",
        context_window=200_000,
        max_output_tokens=8_096,
        supports_function_calling=True,
        supports_parallel_tool_calls=True,
        supports_tool_streaming=False,
        supports_json_mode=False,
        preferred_agent_mode="function_calling",
    ),

    # ------------------------------------------------------------------
    # Google models (routed via Agnes hub)
    # ------------------------------------------------------------------
    "gemini-2.5-pro": ModelCapabilities(
        model_id="gemini-2.5-pro",
        provider="google",
        context_window=1_000_000,
        max_output_tokens=8_192,
        supports_function_calling=True,
        supports_parallel_tool_calls=True,
        supports_tool_streaming=False,
        supports_json_mode=True,
        preferred_agent_mode="function_calling",
    ),
    "gemini-2.5-flash": ModelCapabilities(
        model_id="gemini-2.5-flash",
        provider="google",
        context_window=1_000_000,
        max_output_tokens=8_192,
        supports_function_calling=True,
        supports_parallel_tool_calls=False,
        supports_tool_streaming=False,
        supports_json_mode=True,
        preferred_agent_mode="function_calling",
    ),
}

# Fallback profile for unknown / unregistered models
_DEFAULT_CAPABILITIES = ModelCapabilities(
    model_id="unknown",
    provider="unknown",
    context_window=128_000,
    max_output_tokens=4_096,
    supports_function_calling=False,
    preferred_agent_mode="react_text",
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_model_capabilities(model_id: str | None) -> ModelCapabilities:
    """Return the capability profile for the given model ID.

    The lookup is case-insensitive and falls back to a safe default profile
    for unrecognised models so that callers never need to guard for None.

    Args:
        model_id: The resolved model name (e.g. ``"claude-sonnet-4"``).  Pass
            ``None`` to get the default profile.

    Returns:
        A :class:`ModelCapabilities` instance.
    """
    if not model_id:
        return _DEFAULT_CAPABILITIES
    return _REGISTRY.get(model_id.lower(), _DEFAULT_CAPABILITIES)


def supports_function_calling(model_id: str | None) -> bool:
    """Quick helper: does this model support native function calling?"""
    return get_model_capabilities(model_id).supports_function_calling


def list_registered_models() -> list[str]:
    """Return all model IDs in the capability registry."""
    return list(_REGISTRY.keys())
