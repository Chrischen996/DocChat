from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.http.models import FieldCondition, Filter, MatchValue
from llama_index.vector_stores.qdrant import QdrantVectorStore

# 模块级别的全局变量
_qdrant_client: QdrantClient = None
_vector_store: QdrantVectorStore = None

COLLECTION_NAME = "financial_reports"
# 使用相对于当前文件的绝对路径，避免工作目录变动导致数据丢失
QDRANT_STORAGE_PATH = str(
    Path(__file__).resolve().parent.parent.parent / "data" / "qdrant_storage"
)


def init_qdrant(
    collection_name: str = COLLECTION_NAME,
    path: str = QDRANT_STORAGE_PATH,
) -> QdrantVectorStore:
    """
    初始化 Qdrant 向量数据库客户端。
    使用本地文件存储模式，无需启动独立的 Qdrant 服务器。
    """
    global _qdrant_client, _vector_store

    _qdrant_client = QdrantClient(path=path)

    _vector_store = QdrantVectorStore(
        client=_qdrant_client,
        collection_name=collection_name,
    )

    print(f"[INIT] Qdrant vector database initialized (collection: {collection_name})")
    return _vector_store


def get_vector_store() -> QdrantVectorStore:
    """获取已初始化的 QdrantVectorStore 实例"""
    if _vector_store is None:
        raise RuntimeError("Qdrant 尚未初始化，请先调用 init_qdrant()")
    return _vector_store


def get_qdrant_client() -> QdrantClient:
    """获取底层 QdrantClient（用于管理操作）"""
    if _qdrant_client is None:
        raise RuntimeError("Qdrant 尚未初始化，请先调用 init_qdrant()")
    return _qdrant_client


def delete_document_vectors(file_name: str) -> int:
    """
    按 file_name payload 字段删除 Qdrant 中该文档的所有向量点。

    Args:
        file_name: 要删除的文档文件名（与上传时保持一致）

    Returns:
        删除的向量点数量
    """
    client = get_qdrant_client()

    # 先查询匹配的 points 数量（用于返回计数）
    points = client.scroll(
        collection_name=COLLECTION_NAME,
        scroll_filter=Filter(
            must=[
                FieldCondition(
                    key="file_name",
                    match=MatchValue(value=file_name),
                )
            ],
        ),
        limit=99999,
    )
    count = len(points[0])

    if count == 0:
        print(f"[QDRANT] 未找到文档 '{file_name}' 的向量，无需删除")
        return 0

    # 按 file_name 过滤删除
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="file_name",
                    match=MatchValue(value=file_name),
                )
            ],
        ),
    )

    print(f"[QDRANT] 已删除文档 '{file_name}' 的 {count} 个向量点")
    return count
