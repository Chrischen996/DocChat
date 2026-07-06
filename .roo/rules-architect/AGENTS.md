# Project Architecture Rules (Non-Obvious Only)

- The backend has two AI providers by design: Agnes chat/image APIs for generation and NVIDIA embeddings for LlamaIndex retrieval.
- RAG index state is a module-level cache in `rag_service.py`; vector truth lives in Qdrant, and cache reset is required after deletions.
- The agent workflow is synchronous LangGraph under FastAPI; streaming agent responses currently chunk the completed answer into 32-character deltas rather than true token streaming.
- Templates are both UI affordances and routing controls; changing `workflow_id` semantics affects backend graph routing and frontend mode display.
- Embedded Qdrant optimizes local setup but prevents multiple backend processes from sharing the same `backend/data/qdrant_storage` path.
