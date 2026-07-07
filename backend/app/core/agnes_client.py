import os
from functools import lru_cache

from llama_index.core import Settings

from app.core.agnes_llm import AgnesLLM
from app.core.local_embedding import LocalHashEmbedding
from app.core.model_capabilities import ModelCapabilities, get_model_capabilities


DEFAULT_MODEL = "agnes-2.0-flash"
MODEL_ALIASES = {
    "agnes-default": DEFAULT_MODEL,
    "deepseek-r1": "deepseek-r1",
    "deepseek-v3": "deepseek-v3",
    "gpt-5": "gpt-5",
    "gpt-4.1": "gpt-4.1",
    "claude-sonnet-4": "claude-sonnet-4",
    "claude-opus-4": "claude-opus-4",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-2.5-flash": "gemini-2.5-flash",
}


@lru_cache(maxsize=1)
def init_agnes_services():
    api_key = os.getenv("AGNES_API_KEY")
    if not api_key:
        raise ValueError("Missing AGNES_API_KEY in .env")

    print("[INIT] Loading Agnes AI model settings...")

    llm = AgnesLLM(
        model="agnes-2.0-flash",
        api_base="https://apihub.agnes-ai.com/v1",
        api_key=api_key,
        temperature=0.1,
        max_tokens=4096,
    )

    embed_model = LocalHashEmbedding(embed_dim=1024)

    Settings.llm = llm
    Settings.embed_model = embed_model

    print("[INIT] Agnes AI services initialized successfully (LLM + local embedding)")
    return llm


def resolve_model_name(model: str | None) -> str:
    if not model:
        return DEFAULT_MODEL
    return MODEL_ALIASES.get(model, model)


def resolve_model_capabilities(model: str | None) -> ModelCapabilities:
    """Return the capability profile for a model (alias-resolved)."""
    return get_model_capabilities(resolve_model_name(model))


def build_agnes_llm(model: str | None = None) -> AgnesLLM:
    api_key = os.getenv("AGNES_API_KEY")
    if not api_key:
        raise ValueError("Missing AGNES_API_KEY in .env")

    resolved = resolve_model_name(model)
    caps = get_model_capabilities(resolved)

    return AgnesLLM(
        model=resolved,
        api_base="https://apihub.agnes-ai.com/v1",
        api_key=api_key,
        temperature=0.1,
        # Use per-model safe max output tokens so we don't truncate responses
        # for models with large limits (e.g. Claude 8K) vs. small ones (4K).
        max_tokens=min(caps.max_output_tokens, 8192),
    )
