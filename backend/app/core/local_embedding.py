import hashlib
import math
import re
from typing import Any

from llama_index.core.embeddings import BaseEmbedding


class LocalHashEmbedding(BaseEmbedding):
    """无需外部 API 的本地哈希 Embedding。

    该实现用于替换原 NVIDIA 托管 embedding，保证后端可以在只有 Agnes
    LLM Key 的情况下启动、上传和检索文档。它不是语义向量模型，但具备稳定、
    可复现、零网络依赖的关键词检索能力。
    """

    embed_dim: int = 1024

    def __init__(self, embed_dim: int = 1024, **kwargs: Any) -> None:
        super().__init__(embed_dim=embed_dim, model_name="local-hash-embedding", **kwargs)

    @classmethod
    def class_name(cls) -> str:
        return "LocalHashEmbedding"

    def _tokenize(self, text: str) -> list[str]:
        normalized = text.lower()
        tokens = re.findall(r"[\w\u4e00-\u9fff]+", normalized)

        # 中文文本通常没有空格，补充字符 bigram/trigram 以提升关键词匹配能力。
        cjk_chars = re.findall(r"[\u4e00-\u9fff]", normalized)
        tokens.extend("".join(cjk_chars[i : i + 2]) for i in range(max(len(cjk_chars) - 1, 0)))
        tokens.extend("".join(cjk_chars[i : i + 3]) for i in range(max(len(cjk_chars) - 2, 0)))
        return [token for token in tokens if token]

    def _hash_token(self, token: str) -> tuple[int, float]:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, byteorder="big", signed=False)
        index = value % self.embed_dim
        sign = 1.0 if ((value >> 63) & 1) == 0 else -1.0
        return index, sign

    def _embed(self, text: str) -> list[float]:
        vector = [0.0] * self.embed_dim
        tokens = self._tokenize(text)
        if not tokens:
            return vector

        for token in tokens:
            index, sign = self._hash_token(token)
            vector[index] += sign

        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return vector
        return [value / norm for value in vector]

    def _get_text_embedding(self, text: str) -> list[float]:
        return self._embed(text)

    def _get_query_embedding(self, query: str) -> list[float]:
        return self._embed(query)

    async def _aget_text_embedding(self, text: str) -> list[float]:
        return self._embed(text)

    async def _aget_query_embedding(self, query: str) -> list[float]:
        return self._embed(query)
