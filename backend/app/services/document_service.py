from __future__ import annotations

import shutil
from pathlib import Path

from app.core.metadata_store import add_document, delete_document as delete_doc_meta, list_documents
from app.core.qdrant_client import delete_document_vectors
from app.services.parser import FinancialReportParser
from app.services.rag_service import delete_from_index, index_document


class DocumentService:
    """Business service for document persistence, parsing, indexing, and deletion."""

    def __init__(self, parser: FinancialReportParser | None = None):
        self.parser = parser or FinancialReportParser()

    def safe_filename(self, filename: str) -> str:
        return Path(filename).name

    def is_supported(self, filename: str) -> bool:
        return self.parser.is_supported(filename)

    def supported_extensions_text(self) -> str:
        return self.parser.supported_extensions_text()

    def raw_path_for(self, file_name: str) -> Path:
        return self.parser.raw_dir / self.safe_filename(file_name)

    def index_saved_file(self, save_path: Path, file_name: str) -> int:
        """Parse a saved raw file, index it into Qdrant, and persist metadata."""
        md_path = self.parser.parse_file(str(save_path))
        chunks_count = index_document(md_path, file_name)
        add_document(file_name, chunks_count)
        return chunks_count

    def list_indexed_documents(self):
        return list_documents()

    def delete_document(self, file_name: str) -> dict:
        """Delete vectors, metadata, raw file, parsed output, and index cache."""
        safe_name = self.safe_filename(file_name)
        vectors_deleted = delete_document_vectors(safe_name)
        meta_deleted = delete_doc_meta(safe_name)
        delete_from_index(safe_name)

        raw_file = self.parser.raw_dir / safe_name
        if raw_file.exists():
            raw_file.unlink()

        parsed_dir = self.parser.parsed_dir / Path(safe_name).stem
        if parsed_dir.exists():
            shutil.rmtree(parsed_dir)

        return {
            "file_name": safe_name,
            "meta_deleted": meta_deleted,
            "vectors_deleted": vectors_deleted,
        }


document_service = DocumentService()
