import os
from llama_index.llms.nvidia import NVIDIA
from llama_index.embeddings.nvidia import NVIDIAEmbedding
from llama_index.core import Settings

def init_nvidia_services():
    """
    初始化 NVIDIA NIM 的 LLM 和 Embedding 服务
    并将其配置为 LlamaIndex 的全局默认模型
    """
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise ValueError("缺少 NVIDIA_API_KEY，请在 .env 中配置")
        
    print("[INIT] Loading NVIDIA AI model settings...")

    # 配置 LLM：Llama 3.1 70B (用于回答问题和总结)
    llm = NVIDIA(
        model="meta/llama-3.1-70b-instruct",
        temperature=0.1,  # 财报分析需要更客观，所以温度设得很低
        max_tokens=2048
    )

    # 配置 Embedding 模型：用于将文本转化为向量
    # NV-Embed-v2 是目前在多页财报/长文本检索上极为强大的模型
    embed_model = NVIDIAEmbedding(
        model="nvidia/nv-embedqa-e5-v5",
        truncate="END"
    )

    # 将 NVIDIA 模型设为 LlamaIndex 全局通用配置
    Settings.llm = llm
    Settings.embed_model = embed_model
    
    print("[INIT] NVIDIA services initialized successfully (LLM + Embedding)")

if __name__ == "__main__":
    init_nvidia_services()
