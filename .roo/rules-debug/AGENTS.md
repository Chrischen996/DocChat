# Project Debug Rules (Non-Obvious Only)

- `ModuleNotFoundError` from backend commands usually means they were not run from `backend/` with the project venv active; `app.*` imports assume `backend` is on `sys.path`.
- Qdrant errors mentioning `already accessed by another instance` mean embedded storage is locked by another backend process; stop it or set `QDRANT_URL` and use the compose Qdrant service.
- Root smoke scripts are live endpoint probes, not pytest tests; failures can be backend-down, missing `AGNES_API_KEY`, missing NVIDIA embedding credentials, or proxy issues.
- `test_chat.py` deliberately uses `httpx.Client(proxy=None)` to avoid environment proxy interference against localhost.
- If document deletion appears incomplete, inspect `backend/data/metadata.json`, `backend/data/raw`, `backend/data/parsed`, and Qdrant payloads; all are separate persistence layers.
