# AGENTS.md

This file provides guidance to agents when working with code in this repository.

- Backend startup now requires `AGNES_API_KEY`; `NVIDIA_API_KEY` is still needed for `NVIDIAEmbedding`, so old NVIDIA-only docs are stale (`backend/app/core/agnes_client.py`, `backend/app/core/agnes_llm.py`).
- Run backend entry points from `backend/` (`python main.py` or `uvicorn main:app ...`) because imports use the top-level `app.*` package; root-level Python scripts hit the live server on port 8000 rather than unit-test code.
- No pytest/vitest config exists. Single smoke checks are `python test_chat.py` or `python test_endpoints.py` after the backend is already running; frontend validation is `cd frontend && npm run lint && npm run build`.
- Qdrant defaults to embedded local storage at `backend/data/qdrant_storage`, but `QDRANT_URL` switches it to an external server; embedded storage is single-process and retries lock acquisition only briefly.
- The active vector collection is still named `financial_reports` even though the app handles general documents.
- Upload flow persists raw files, parsed Markdown, Qdrant vectors, and `backend/data/metadata.json`; deleting a document must remove all and call `delete_from_index()` to clear the in-memory `VectorStoreIndex` cache.
- Parsed output paths are computed relative to `backend/app/...`, not the current working directory, to avoid data being written under the repo root.
- PDFs use PyMuPDF by default; `marker_single` is only used when `parse_pdf(..., use_marker=True)` and falls back after timeout/failure.
- Streaming APIs are newline-delimited JSON with `status`, `sources`, `delta`, `asset`, `done`, and `error` events; frontend parsing depends on one JSON object per line.
- Agent templates are seeded into `backend/data/templates.json` on first `/api/templates` call; `workflow_id` values route LangGraph to assistant, document, or image nodes.
- Generated image assets are stored inline as base64 in `backend/data/generated_assets.json` and capped to the newest 50 assets.
- Frontend uses Next 16.2.2/React 19; keep `frontend/AGENTS.md` rule to consult `node_modules/next/dist/docs/` before changing Next APIs.
