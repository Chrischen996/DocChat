"""
Local JSON persistence for generated assets.
"""

from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from uuid import uuid4

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_ASSET_PATH = _BASE_DIR / "data" / "generated_assets.json"

_asset_lock = Lock()


def _read_assets() -> list[dict]:
    if not _ASSET_PATH.exists():
        return []
    try:
        data = json.loads(_ASSET_PATH.read_text(encoding="utf-8"))
        return data.get("assets", [])
    except (json.JSONDecodeError, KeyError):
        return []


def _write_assets(assets: list[dict]) -> None:
    _ASSET_PATH.parent.mkdir(parents=True, exist_ok=True)
    _ASSET_PATH.write_text(
        json.dumps({"assets": assets}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def add_asset(
    asset_type: str,
    title: str,
    content: str = "",
    image_data: str = "",
    format: str = "",
    source_template_id: str | None = None,
    source_question: str | None = None,
) -> dict:
    asset = {
        "id": uuid4().hex,
        "asset_type": asset_type,
        "title": title,
        "content": content,
        "image_data": image_data,
        "format": format,
        "source_template_id": source_template_id,
        "source_question": source_question,
    }

    with _asset_lock:
        assets = _read_assets()
        assets.insert(0, asset)
        _write_assets(assets[:50])

    return asset


def list_assets(limit: int = 20) -> list[dict]:
    with _asset_lock:
        return _read_assets()[:limit]

