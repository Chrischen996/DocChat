# Project Coding Rules (Non-Obvious Only)

- Use `Settings.llm`/`Settings.embed_model` initialized by `init_agnes_services()` for RAG/chat paths; do not instantiate OpenAI SDK clients for Agnes because `AgnesLLM` bypasses model-name validation via direct `httpx` calls.
- Preserve NDJSON event names and newline framing in streaming routes; `frontend/src/lib/api.ts` parses buffered lines and calls `JSON.parse` per line.
- For blocking parsing/RAG calls inside FastAPI routes, keep the existing `run_in_executor(partial(...))` pattern to avoid blocking the event loop.
- When adding document-derived data, include `file_name` metadata on nodes because Qdrant deletion filters on payload key `file_name`.
- If adding templates, use `workflow_id` values consumed by `_classify_state`: `image_generation`, `document_summary`, or fallback assistant workflow.
- Frontend request/response fields intentionally stay snake_case to match Pydantic models; avoid converting API payloads to camelCase.
