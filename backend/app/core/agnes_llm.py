"""
自定义 Agnes AI LLM 包装器
绕过 OpenAI SDK 的模型名校验，直接通过 httpx 调用 Agnes API
实现 LlamaIndex 的 LLM 接口，可替换 Settings.llm
"""
import json
import os
from typing import Any, Generator, Iterator, Optional

import httpx
from llama_index.core.llms import (
    CustomLLM,
    CompletionResponse,
    CompletionResponseGen,
    LLMMetadata,
)
from llama_index.core.llms.callbacks import llm_completion_callback


class AgnesLLM(CustomLLM):
    """Agnes AI LLM 包装器，通过 httpx 直接调用 API"""

    model: str = "agnes-2.0-flash"
    api_base: str = "https://apihub.agnes-ai.com/v1"
    api_key: str = ""
    temperature: float = 0.1
    max_tokens: int = 4096
    timeout: int = 60

    def __init__(
        self,
        model: str = "agnes-2.0-flash",
        api_base: str = "https://apihub.agnes-ai.com/v1",
        api_key: str = "",
        temperature: float = 0.1,
        max_tokens: int = 4096,
        timeout: int = 60,
    ):
        super().__init__(
            model=model,
            api_base=api_base,
            api_key=api_key or os.getenv("AGNES_API_KEY", ""),
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
        )

    @property
    def metadata(self) -> LLMMetadata:
        return LLMMetadata(
            model_name=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            context_window=128000,
            is_chat_model=True,
        )

    def _call_api(self, prompt: str, stream: bool = False) -> dict:
        """调用 Agnes AI Chat Completions API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": stream,
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    def _call_api_stream(self, prompt: str) -> Generator[str, None, None]:
        """流式调用 Agnes AI Chat Completions API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": True,
        }

        with httpx.Client(timeout=self.timeout) as client:
            with client.stream(
                "POST",
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue

    def _call_messages_api(self, messages: list[dict]) -> str:
        """调用 Agnes AI Chat Completions API（多消息模式）。

        Args:
            messages: OpenAI 格式的 messages 列表，如
                [{"role": "system", "content": "..."},
                 {"role": "user", "content": "..."}]

        Returns:
            助手回复文本
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": False,
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
            return ""

    def _call_messages_api_stream(self, messages: list[dict]) -> Iterator[str]:
        """流式调用 Agnes AI Chat Completions API（多消息模式）。

        Args:
            messages: OpenAI 格式的 messages 列表

        Yields:
            每个流式 token 内容
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": True,
        }

        with httpx.Client(timeout=self.timeout) as client:
            with client.stream(
                "POST",
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue

    def chat_messages(self, messages: list[dict]) -> str:
        """使用结构化 messages 调用 LLM（非 LlamaIndex 兼容，供内部调用）。

        Args:
            messages: 标准 Chat Completions messages 列表，包含
                      system / user / assistant 三种 role。

        Returns:
            模型的完整文本回复。
        """
        return self._call_messages_api(messages)

    def stream_chat_messages(self, messages: list[dict]) -> Iterator[str]:
        """流式调用结构化 messages API（非 LlamaIndex 兼容，供内部调用）。

        Args:
            messages: 标准 Chat Completions messages 列表。

        Yields:
            每个流式 token 内容字符串。
        """
        return self._call_messages_api_stream(messages)

    @llm_completion_callback()
    def complete(self, prompt: str, **kwargs: Any) -> CompletionResponse:
        data = self._call_api(prompt, stream=False)
        choices = data.get("choices", [])
        if choices:
            text = choices[0].get("message", {}).get("content", "")
            return CompletionResponse(text=text)
        return CompletionResponse(text="")

    @llm_completion_callback()
    def stream_complete(
        self, prompt: str, **kwargs: Any
    ) -> CompletionResponseGen:
        def gen() -> CompletionResponseGen:
            full_text = ""
            for token in self._call_api_stream(prompt):
                full_text += token
                yield CompletionResponse(text=full_text, delta=token)

        return gen()
