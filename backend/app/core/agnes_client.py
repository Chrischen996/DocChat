import os
from functools import lru_cache

from llama_index.core import Settings
from llama_index.embeddings.nvidia import NVIDIAEmbedding

from app.core.agnes_llm import AgnesLLM


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

    embed_model = NVIDIAEmbedding(
        model="nvidia/nv-embedqa-e5-v5",
        truncate="END",
    )

    Settings.llm = llm
    Settings.embed_model = embed_model

    print("[INIT] Agnes AI services initialized successfully")
    return llm
