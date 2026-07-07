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

    # ------------------------------------------------------------------ #
    # Unified transport helpers                                            #
    # ------------------------------------------------------------------ #

    def _build_payload(
        self,
        messages: list[dict],
        stream: bool = False,
        tools: list[dict] | None = None,
        tool_choice: str | dict | None = None,
        response_format: dict | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> dict:
        """Build a Chat Completions request payload.

        All parameters are optional overrides. When omitted they fall back to
        the instance defaults (``self.max_tokens``, ``self.temperature``).

        Args:
            messages: List of OpenAI-format message dicts.
            stream: Whether to request a streaming response.
            tools: Optional list of tool/function schemas for function calling.
            tool_choice: Optional tool_choice hint ("auto", "none", or a
                specific tool object). Ignored when ``tools`` is None.
            response_format: Optional response_format hint, e.g.
                ``{"type": "json_object"}`` for JSON mode.
            max_tokens: Per-call token limit override.
            temperature: Per-call temperature override.

        Returns:
            A dict ready to be JSON-serialised and POST-ed.
        """
        payload: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": max_tokens if max_tokens is not None else self.max_tokens,
            "stream": stream,
        }
        if tools:
            payload["tools"] = tools
            if tool_choice is not None:
                payload["tool_choice"] = tool_choice
        if response_format is not None:
            payload["response_format"] = response_format
        return payload

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _post_chat_completion(self, payload: dict) -> dict:
        """Send a non-streaming Chat Completions request and return raw JSON."""
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(
                f"{self.api_base}/chat/completions",
                headers=self._get_headers(),
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    def _stream_chat_completion(self, payload: dict) -> Iterator[str]:
        """Send a streaming Chat Completions request, yield text delta tokens."""
        with httpx.Client(timeout=self.timeout) as client:
            with client.stream(
                "POST",
                f"{self.api_base}/chat/completions",
                headers=self._get_headers(),
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

    # ------------------------------------------------------------------ #
    # LlamaIndex-compatible interfaces (complete / stream_complete)        #
    # ------------------------------------------------------------------ #

    @llm_completion_callback()
    def complete(self, prompt: str, **kwargs: Any) -> CompletionResponse:
        payload = self._build_payload(
            messages=[{"role": "user", "content": prompt}],
            stream=False,
            max_tokens=kwargs.get("max_tokens"),
            temperature=kwargs.get("temperature"),
        )
        data = self._post_chat_completion(payload)
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
            payload = self._build_payload(
                messages=[{"role": "user", "content": prompt}],
                stream=True,
                max_tokens=kwargs.get("max_tokens"),
                temperature=kwargs.get("temperature"),
            )
            full_text = ""
            for token in self._stream_chat_completion(payload):
                full_text += token
                yield CompletionResponse(text=full_text, delta=token)

        return gen()

    # ------------------------------------------------------------------ #
    # Structured messages API (non-LlamaIndex, used internally)           #
    # ------------------------------------------------------------------ #

    def chat_messages(
        self,
        messages: list[dict],
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> str:
        """Call the LLM with a structured messages list (system/user/assistant).

        This is the preferred method for all internal agent and chat service
        calls. It bypasses LlamaIndex's prompt abstraction and sends the full
        messages array directly to Chat Completions.

        Args:
            messages: Standard Chat Completions messages list.
            max_tokens: Per-call token limit override.
            temperature: Per-call temperature override.

        Returns:
            The assistant reply text.
        """
        payload = self._build_payload(
            messages=messages,
            stream=False,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        data = self._post_chat_completion(payload)
        choices = data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        return ""

    def stream_chat_messages(
        self,
        messages: list[dict],
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> Iterator[str]:
        """Stream the LLM reply for a structured messages list.

        Args:
            messages: Standard Chat Completions messages list.
            max_tokens: Per-call token limit override.
            temperature: Per-call temperature override.

        Yields:
            Text delta strings as they arrive.
        """
        payload = self._build_payload(
            messages=messages,
            stream=True,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return self._stream_chat_completion(payload)

    def chat_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        tool_choice: str | dict = "auto",
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> dict:
        """Call the LLM with function calling / tool use enabled.

        Returns the raw first ``choice`` dict, which may contain either a
        ``content`` text reply or ``tool_calls`` list.

        Args:
            messages: Standard Chat Completions messages list.
            tools: List of tool schemas in OpenAI function calling format.
            tool_choice: Tool selection hint ("auto", "none", or specific tool).
            max_tokens: Per-call token limit override.
            temperature: Per-call temperature override.

        Returns:
            The first choice dict from the API response, e.g.:
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [...]
                },
                "finish_reason": "tool_calls"
            }
        """
        payload = self._build_payload(
            messages=messages,
            stream=False,
            tools=tools,
            tool_choice=tool_choice,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        data = self._post_chat_completion(payload)
        choices = data.get("choices", [])
        return choices[0] if choices else {}
