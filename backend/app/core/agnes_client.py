import os
from llama_index.embeddings.nvidia import NVIDIAEmbedding
from llama_index.core import Settings

from app.core.agnes_llm import AgnesLLM


def init_agnes_services():
    """
    初始化 Agnes AI 的 LLM 服务（通过自定义 httpx 包装器调用）
    保持 NVIDIA 嵌入模型用于 RAG 文档检索
    """
    api_key = os.getenv("AGNES_API_KEY")
    if not api_key:
        raise ValueError("缺少 AGNES_API_KEY，请在 .env 中配置")

    print("[INIT] Loading Agnes AI model settings...")

    # LLM: Agnes 2.0 Flash 通过自定义包装器（直接 httpx 调用，绕过 OpenAI SDK 模型名校验）
    llm = AgnesLLM(
        model="agnes-2.0-flash",
        api_base="https://apihub.agnes-ai.com/v1",
        api_key=api_key,
        temperature=0.1,
        max_tokens=4096,
    )

    # Embeddings: 保持 NVIDIA（Agnes 目前没有单独的 Embedding API）
    embed_model = NVIDIAEmbedding(
        model="nvidia/nv-embedqa-e5-v5",
        truncate="END",
    )

    Settings.llm = llm
    Settings.embed_model = embed_model

    print("[INIT] Agnes AI services initialized successfully (LLM: Agnes 2.0 Flash via custom wrapper)")
