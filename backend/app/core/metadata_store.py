"""
文档元数据持久化存储。

使用 JSON 文件存储已索引文档的元数据，
通过 threading.Lock 保证多线程安全（FastAPI 并发请求场景）。
"""

import json
from pathlib import Path
from threading import Lock
from typing import Optional

# 存储路径：相对于此文件的 data 目录
_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_METADATA_PATH = _BASE_DIR / "data" / "metadata.json"

_metadata_lock = Lock()


class DocumentInfo:
    """单篇文档的元数据"""

    def __init__(self, file_name: str, upload_time: str, chunks_indexed: int):
        self.file_name = file_name
        self.upload_time = upload_time
        self.chunks_indexed = chunks_indexed

    def to_dict(self) -> dict:
        return {
            "file_name": self.file_name,
            "upload_time": self.upload_time,
            "chunks_indexed": self.chunks_indexed,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "DocumentInfo":
        return cls(
            file_name=data["file_name"],
            upload_time=data.get("upload_time", ""),
            chunks_indexed=data.get("chunks_indexed", 0),
        )


def _read_metadata() -> list[dict]:
    """读取 metadata.json，返回文档列表。文件不存在时返回空列表。"""
    if not _METADATA_PATH.exists():
        return []
    try:
        data = json.loads(_METADATA_PATH.read_text(encoding="utf-8"))
        return data.get("documents", [])
    except (json.JSONDecodeError, KeyError):
        return []


def _write_metadata(documents: list[dict]) -> None:
    """将文档列表写入 metadata.json。"""
    _METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    _METADATA_PATH.write_text(
        json.dumps({"documents": documents}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def add_document(file_name: str, chunks_indexed: int) -> DocumentInfo:
    """
    添加一条文档元数据，返回 DocumentInfo 对象。

    线程安全：使用 threading.Lock 防止并发写入冲突。
    """
    from datetime import datetime, timezone

    doc = DocumentInfo(
        file_name=file_name,
        upload_time=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        chunks_indexed=chunks_indexed,
    )

    with _metadata_lock:
        documents = _read_metadata()
        # 如果已存在同名文档，先移除旧的（覆盖场景）
        documents = [d for d in documents if d.get("file_name") != file_name]
        documents.append(doc.to_dict())
        _write_metadata(documents)

    return doc


def list_documents() -> list[DocumentInfo]:
    """返回所有已索引文档的元数据列表。"""
    with _metadata_lock:
        return [DocumentInfo.from_dict(d) for d in _read_metadata()]


def delete_document(file_name: str) -> bool:
    """
    删除指定文档的元数据。

    Returns:
        True 如果找到并删除，False 如果文档不存在。
    """
    with _metadata_lock:
        documents = _read_metadata()
        before = len(documents)
        documents = [d for d in documents if d.get("file_name") != file_name]
        if len(documents) == before:
            return False
        _write_metadata(documents)
        return True


def get_document(file_name: str) -> Optional[DocumentInfo]:
    """按文件名查找文档元数据。"""
    with _metadata_lock:
        for d in _read_metadata():
            if d.get("file_name") == file_name:
                return DocumentInfo.from_dict(d)
    return None
