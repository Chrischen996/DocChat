from llama_index.core import Settings

from app.core.agnes_client import build_agnes_llm, init_agnes_services
from app.core.agnes_llm import AgnesLLM

ASSISTANT_SYSTEM_PROMPT = (
    "你是一个可靠、自然、简洁的个人助手。"
    "你可以帮助用户写作、解释概念、整理计划、翻译、头脑风暴、排查一般问题。"
    "如果问题涉及上传文档或具体文档证据，请提醒用户切换到文档分析模式或上传文件。"
    "回答使用中文，语气友好，避免编造不确定事实。"
    "请使用清晰的 Markdown 格式：短段落、必要的小标题、项目符号列表；"
    "当用户要求比较或整理数据时，可以使用 Markdown 表格。"
    "不要为了格式而过度展开。"
)


def build_assistant_messages(
    message: str,
    history: list[dict] | None = None,
) -> list[dict]:
    """构建符合 Chat Completions 规范的 messages 列表。

    结构：
    - system: 助手角色设定
    - user/assistant 交替: 历史对话（最近 12 条）
    - user: 当前用户输入

    Returns:
        OpenAI Chat Completions 格式的 messages 列表
    """
    messages: list[dict] = [{"role": "system", "content": ASSISTANT_SYSTEM_PROMPT}]

    if history:
        for msg in history[-12:]:
            role = msg.get("role", "")
            content = str(msg.get("content", "")).strip()
            if not content or role not in ("user", "assistant"):
                continue
            messages.append({"role": role, "content": content[:1200]})

    messages.append({"role": "user", "content": message})
    return messages


def _get_llm(model: str | None = None):
    """获取 LLM 实例（init_agnes_services 有 @lru_cache，重复调用无开销）

    注意：不能写成 Settings.llm or init_agnes_services()，因为 Settings.llm
    是 property，值为 None 时会尝试解析默认 OpenAI LLM 并抛出缺少 API key 的错误。
    """
    if model:
        return build_agnes_llm(model)
    if Settings._llm is not None:
        return Settings.llm
    return init_agnes_services()


def chat_with_assistant(
    message: str,
    history: list[dict] | None = None,
    model: str | None = None,
) -> str:
    llm = _get_llm(model)
    messages = build_assistant_messages(message, history)

    # 优先使用结构化 messages API；不支持时 fallback 到 flat prompt
    if isinstance(llm, AgnesLLM):
        return llm.chat_messages(messages)

    # fallback：将 messages 展平为 prompt（LlamaIndex 非 AgnesLLM 兼容路径）
    prompt = _messages_to_flat_prompt(messages)
    return str(llm.complete(prompt))


def stream_chat_with_assistant(
    message: str,
    history: list[dict] | None = None,
    model: str | None = None,
):
    llm = _get_llm(model)
    messages = build_assistant_messages(message, history)

    if isinstance(llm, AgnesLLM):
        yield from llm.stream_chat_messages(messages)
        return

    # fallback
    prompt = _messages_to_flat_prompt(messages)
    for chunk in llm.stream_complete(prompt):
        delta = getattr(chunk, "delta", None)
        if delta:
            yield delta


def _messages_to_flat_prompt(messages: list[dict]) -> str:
    """将 messages 列表展平为单一文本 prompt（非 AgnesLLM fallback 用）。"""
    parts: list[str] = []
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "system":
            parts.append(content)
        elif role == "user":
            parts.append(f"用户: {content}")
        elif role == "assistant":
            parts.append(f"助手: {content}")
    parts.append("助手:")
    return "\n\n".join(parts)
