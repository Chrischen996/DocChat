from llama_index.core import Settings


def _format_history(history: list[dict] | None = None) -> str:
    if not history:
        return ""

    lines = []
    for message in history[-12:]:
        role = message.get("role", "")
        content = message.get("content", "").strip()
        if not content:
            continue
        label = "用户" if role == "user" else "助手"
        lines.append(f"{label}: {content[:1200]}")

    return "\n".join(lines)


def chat_with_assistant(message: str, history: list[dict] | None = None) -> str:
    """
    通用个人助手聊天，不依赖文档索引。
    """
    llm = Settings.llm
    if llm is None:
        raise RuntimeError("LLM 尚未初始化")

    prompt = build_assistant_prompt(message, history)
    response = llm.complete(prompt)
    return str(response)


def build_assistant_prompt(message: str, history: list[dict] | None = None) -> str:
    history_text = _format_history(history)
    prompt = (
        "你是一个可靠、自然、简洁的个人助手。"
        "你可以帮助用户写作、解释概念、整理计划、翻译、头脑风暴、排查一般问题。"
        "如果问题涉及上传文档或具体文档证据，请提醒用户切换到文档分析模式或上传文件。"
        "回答使用中文，语气友好，避免编造不确定事实。"
        "请使用清晰的 Markdown 格式：短段落、必要的小标题、项目符号列表；"
        "当用户要求比较或整理数据时，可以使用 Markdown 表格。"
        "不要为了格式而过度展开。\n\n"
    )

    if history_text:
        prompt += f"最近对话:\n{history_text}\n\n"

    prompt += f"用户: {message}\n助手:"
    return prompt


def stream_chat_with_assistant(message: str, history: list[dict] | None = None):
    """
    流式个人助手聊天，不依赖文档索引。
    """
    llm = Settings.llm
    if llm is None:
        raise RuntimeError("LLM 尚未初始化")

    prompt = build_assistant_prompt(message, history)
    for chunk in llm.stream_complete(prompt):
        delta = getattr(chunk, "delta", None)
        if delta:
            yield delta
