from pathlib import Path
from threading import Lock
from time import perf_counter

from llama_index.core import Settings, StorageContext, VectorStoreIndex
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import Document

from app.core.qdrant_client import get_vector_store

# 模块级缓存索引对象，避免每次查询都重建
_index: VectorStoreIndex = None
_index_lock = Lock()
# 记录已索引的文档类型，用于动态提示词
_document_types: set[str] = set()


def _build_contextual_question(question: str, history: list[dict] | None = None) -> str:
    """把最近的聊天历史拼进查询，让追问可以引用上文。"""
    if not history:
        return question

    context_lines = []
    for message in history[-10:]:
        role = message.get("role", "")
        content = message.get("content", "").strip()
        if not content:
            continue
        label = "用户" if role == "user" else "助手"
        context_lines.append(f"{label}: {content[:1000]}")

    if not context_lines:
        return question

    # 动态推断文档类型
    doc_type_hint = _get_document_type_hint()
    conversation = "\n".join(context_lines)
    return (
        f"以下是本次{doc_type_hint}对话的最近上下文。请结合上下文理解用户当前问题，"
        "尤其是「它」「这个指标」「上面提到的公司」等追问指代。"
        "回答仍然必须基于检索到的文档内容和引用。\n\n"
        f"{conversation}\n\n当前用户问题: {question}"
    )


def _get_document_type_hint() -> str:
    """根据已索引的文档类型返回合适的提示词片段。"""
    if not _document_types:
        return "文档分析"
    # 如果所有文档文件名都包含常见财务关键词，则用"财报分析"
    finance_keywords = {"report", "财报", "财务", "年报", "financial", "季报", "审计"}
    if any(
        any(kw in name.lower() for kw in finance_keywords)
        for name in _document_types
    ):
        return "文档分析（财报）"
    return "文档分析"


def _get_or_create_index() -> VectorStoreIndex:
    """
    获取或创建 VectorStoreIndex。
    如果 Qdrant 中已有数据，则从已有向量构建索引；否则创建空索引。
    """
    global _index
    with _index_lock:
        if _index is not None:
            return _index

        vector_store = get_vector_store()
        storage_context = StorageContext.from_defaults(vector_store=vector_store)

        _index = VectorStoreIndex.from_vector_store(
            vector_store=vector_store,
            storage_context=storage_context,
        )
    return _index


def index_document(md_path: str, file_name: str) -> int:
    """
    将解析后的 Markdown 文件切分、嵌入并存入 Qdrant。

    Args:
        md_path: Markdown 文件路径
        file_name: 原始 PDF 文件名，用于元数据追踪

    Returns:
        成功索引的文本块数量
    """
    global _index

    md_content = Path(md_path).read_text(encoding="utf-8")

    document = Document(
        text=md_content,
        metadata={
            "file_name": file_name,
            "source": md_path,
        },
    )

    splitter = SentenceSplitter(chunk_size=1024, chunk_overlap=128)
    nodes = splitter.get_nodes_from_documents([document])

    print(f"文档 '{file_name}' 切分为 {len(nodes)} 个文本块")

    vector_store = get_vector_store()
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    with _index_lock:
        if _index is None:
            _index = VectorStoreIndex(
                nodes=nodes,
                storage_context=storage_context,
                show_progress=True,
            )
        else:
            _index.insert_nodes(nodes)
        # 记录文档类型
        _document_types.add(file_name)

    print(f"成功将 {len(nodes)} 个文本块存入向量数据库")
    return len(nodes)


def delete_from_index(file_name: str) -> None:
    """
    删除文档后重置全局索引缓存，并移除文档类型记录。
    下次查询时会自动从 Qdrant 重建索引（不含已删除的向量）。

    Args:
        file_name: 被删除的文档文件名
    """
    global _index
    with _index_lock:
        _index = None
    _document_types.discard(file_name)
    print(f"[RAG] 索引缓存已重置，文档 '{file_name}' 已从记录中移除")


def _format_sources_for_prompt(sources: list[dict]) -> str:
    blocks = []
    for index, source in enumerate(sources, start=1):
        file_name = source.get("file_name") or "未知文件"
        text = source.get("text", "").strip()
        blocks.append(f"[{index}] 文件: {file_name}\n{text}")
    return "\n\n".join(blocks)


def _prepare_document_prompt(
    question: str,
    top_k: int = 3,
    history: list[dict] | None = None,
) -> tuple[str, list[dict], int]:
    started_at = perf_counter()
    index = _get_or_create_index()
    contextual_question = _build_contextual_question(question, history)

    retriever = index.as_retriever(similarity_top_k=top_k)
    source_nodes = retriever.retrieve(contextual_question)
    retrieval_ms = int((perf_counter() - started_at) * 1000)

    sources = [
        {
            "text": node.node.get_content()[:1000],
            "score": node.score,
            "file_name": node.node.metadata.get("file_name", "未知"),
        }
        for node in source_nodes
    ]

    if not sources:
        return "", [], retrieval_ms

    source_text = _format_sources_for_prompt(sources)
    doc_type_hint = _get_document_type_hint()
    prompt = (
        f"你是一个严谨的{doc_type_hint}助手。请只基于下面给出的来源回答问题。"
        "回答要简洁、直接，并在引用具体信息时使用来源编号，例如 [1]、[2]。"
        "如果来源不足以回答，请明确说无法从当前文档中确定。"
        "请使用清晰的 Markdown 格式：先给一个简短结论，再用小标题或项目符号展开；"
        "如果适合比较多个文件或指标，可以使用 Markdown 表格。"
        "引用编号必须放在对应事实句后面。\n\n"
        f"来源:\n{source_text}\n\n"
        f"问题:\n{contextual_question}\n\n"
        "答案:"
    )
    return prompt, sources, retrieval_ms


def _compact_sources(sources: list[dict]) -> list[dict]:
    return [
        {
            **source,
            "text": source["text"][:1000],
        }
        for source in sources
    ]


def query_documents(
    question: str,
    top_k: int = 3,
    history: list[dict] | None = None,
    llm=None,
) -> dict:
    """
    基于用户问题执行 RAG 查询：检索 + 生成带引用的回答。

    Args:
        question: 用户提出的问题
        top_k: 检索的相关文本块数量
        history: 最近聊天上下文，用于理解追问
        llm: 可选 LLM 实例；未传入时使用全局 Settings.llm

    Returns:
        包含 answer 和 sources 的字典
    """
    started_at = perf_counter()
    prompt, sources, retrieval_ms = _prepare_document_prompt(question, top_k, history)

    if not sources:
        return {
            "answer": "我没有在已上传文档中检索到足够相关的内容。可以换个更具体的问题，或确认文档已经上传并索引完成。",
            "sources": [],
        }

    generation_started_at = perf_counter()
    active_llm = llm or Settings.llm
    response = active_llm.complete(prompt)
    generation_ms = int((perf_counter() - generation_started_at) * 1000)
    total_ms = int((perf_counter() - started_at) * 1000)

    print(
        "文档查询耗时: "
        f"retrieval={retrieval_ms}ms, generation={generation_ms}ms, total={total_ms}ms"
    )

    return {
        "answer": str(response),
        "sources": _compact_sources(sources),
    }


def stream_query_documents(
    question: str,
    top_k: int = 3,
    history: list[dict] | None = None,
    llm=None,
):
    """
    流式文档查询。先产出 sources，再产出 answer delta。
    """
    started_at = perf_counter()
    yield {"type": "status", "message": "正在检索文档片段..."}
    prompt, sources, retrieval_ms = _prepare_document_prompt(question, top_k, history)

    yield {
        "type": "sources",
        "sources": _compact_sources(sources),
        "retrieval_ms": retrieval_ms,
    }
    yield {"type": "status", "message": "已找到相关片段，正在生成回答..."}

    if not sources:
        yield {
            "type": "delta",
            "text": "我没有在已上传文档中检索到足够相关的内容。可以换个更具体的问题，或确认文档已经上传并索引完成。",
        }
        yield {"type": "done"}
        return

    generation_started_at = perf_counter()
    active_llm = llm or Settings.llm
    for chunk in active_llm.stream_complete(prompt):
        delta = getattr(chunk, "delta", None)
        if delta:
            yield {"type": "delta", "text": delta}

    generation_ms = int((perf_counter() - generation_started_at) * 1000)
    total_ms = int((perf_counter() - started_at) * 1000)
    print(
        "文档流式查询耗时: "
        f"retrieval={retrieval_ms}ms, generation={generation_ms}ms, total={total_ms}ms"
    )
    yield {
        "type": "done",
        "retrieval_ms": retrieval_ms,
        "generation_ms": generation_ms,
        "total_ms": total_ms,
    }
