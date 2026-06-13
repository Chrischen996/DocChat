from pathlib import Path
from time import sleep

from qdrant_client import QdrantClient
from qdrant_client.http.models import FieldCondition, Filter, MatchValue
from llama_index.vector_stores.qdrant import QdrantVectorStore

_qdrant_client: QdrantClient | None = None
_vector_store: QdrantVectorStore | None = None
_qdrant_source: str | None = None

COLLECTION_NAME = "financial_reports"
QDRANT_STORAGE_PATH = str(
    Path(__file__).resolve().parent.parent.parent / "data" / "qdrant_storage"
)
DEFAULT_QDRANT_URL = "http://localhost:6333"


def _build_client(url: str | None, path: str | None) -> QdrantClient:
    if url:
        return QdrantClient(url=url)
    if path:
        return QdrantClient(path=path)
    return QdrantClient(path=QDRANT_STORAGE_PATH)


def init_qdrant(
    collection_name: str = COLLECTION_NAME,
    url: str | None = None,
    path: str | None = None,
) -> QdrantVectorStore:
    global _qdrant_client, _vector_store, _qdrant_source

    source_key = url or path or QDRANT_STORAGE_PATH
    if _qdrant_client is not None and _qdrant_source == source_key:
        return _vector_store

    if _qdrant_client is not None:
        close_qdrant()

    if url:
        _qdrant_client = QdrantClient(url=url)
        _qdrant_source = url
    else:
        qdrant_path = path or QDRANT_STORAGE_PATH
        try:
            _qdrant_client = QdrantClient(path=qdrant_path)
        except RuntimeError as exc:
            if "already accessed by another instance" not in str(exc):
                raise

            print(
                f"[QDRANT] Storage lock is busy at {qdrant_path}. Waiting for it to be released..."
            )
            last_error: Exception | None = exc
            for _ in range(5):
                sleep(0.5)
                try:
                    _qdrant_client = QdrantClient(path=qdrant_path)
                    break
                except RuntimeError as retry_exc:
                    last_error = retry_exc
                    if "already accessed by another instance" not in str(retry_exc):
                        raise
            else:
                raise RuntimeError(
                    "Qdrant local storage is locked by another process. "
                    "Stop the other backend instance, or start an external Qdrant service."
                ) from last_error
        _qdrant_source = qdrant_path

    _vector_store = QdrantVectorStore(
        client=_qdrant_client,
        collection_name=collection_name,
    )

    print(f"[INIT] Qdrant vector database initialized (collection: {collection_name})")
    return _vector_store


def close_qdrant() -> None:
    global _qdrant_client, _vector_store, _qdrant_source

    client = _qdrant_client
    _qdrant_client = None
    _vector_store = None
    _qdrant_source = None

    close_method = getattr(client, "close", None)
    if callable(close_method):
        close_method()


def get_vector_store() -> QdrantVectorStore:
    if _vector_store is None:
        raise RuntimeError("Qdrant 尚未初始化，请先调用 init_qdrant()")
    return _vector_store


def get_qdrant_client() -> QdrantClient:
    if _qdrant_client is None:
        raise RuntimeError("Qdrant 尚未初始化，请先调用 init_qdrant()")
    return _qdrant_client


def delete_document_vectors(file_name: str) -> int:
    client = get_qdrant_client()

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
