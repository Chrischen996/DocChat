# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**DocChat** — A personal document Q&A assistant (ChatPDF-style). Upload documents (PDF, Word, Excel, PPT, TXT, CSV, JSON, Markdown) and ask questions using RAG (Retrieval-Augmented Generation). The backend is a Python/FastAPI service with a Next.js frontend.

## Environment Setup

Requires a `.env` file in `backend/` with:
```
NVIDIA_API_KEY=<your key>
```

Optionally configure the frontend API URL in `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Activate the virtual environment (`.venv/` at the project root) before running any commands:
```bash
# Windows
.venv\Scripts\activate

# Then install dependencies
pip install -r backend/requirements.txt
```

## Key Commands

```bash
# Start the FastAPI server (run from backend/)
cd backend && python main.py
# or
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# One-click start from project root
start_backend.bat

# Start the frontend (separate terminal)
cd frontend && npm install && npm run dev

# Swagger UI: http://localhost:8000/docs

# Upload a document
curl -X POST http://localhost:8000/api/upload -F "file=@report.pdf"

# Query (document analysis)
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "该公司的营收增长率是多少？"}'

# Streaming query (document analysis)
curl -N -X POST http://localhost:8000/api/query/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "该公司的营收增长率是多少？"}'

# General chat (no document needed)
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "帮我规划一个项目方案", "history": []}'

# Streaming chat
curl -N -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "帮我规划一个项目方案", "history": []}'

# Health check
curl http://localhost:8000/api/health

# List uploaded documents
curl http://localhost:8000/api/documents

# Delete a document
curl -X DELETE http://localhost:8000/api/documents/report.pdf
```

## Architecture

```
backend/
├── main.py                          # FastAPI app entry point with lifespan init
├── requirements.txt
├── .env
└── app/
    ├── core/
    │   ├── nvidia_client.py         # LlamaIndex global Settings (LLM + Embeddings)
    │   ├── qdrant_client.py         # Qdrant vector store singleton + delete support
    │   └── metadata_store.py        # JSON-persisted document metadata (thread-safe)
    ├── services/
    │   ├── parser.py                # PDF → Markdown via marker_single CLI
    │   ├── rag_service.py           # RAG indexing + citation-based querying
    │   └── chat_service.py          # General assistant chat (non-RAG)
    ├── api/
    │   └── routes.py                # API endpoints: upload, query, chat, documents CRUD, health
    └── models/
        └── schemas.py               # Pydantic request/response models

frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx               # App layout
│   │   ├── page.tsx                 # Main chat UI (conversation + upload sidebar)
│   │   └── globals.css              # Tailwind global styles
│   ├── components/
│   │   ├── Header.tsx               # App header with health indicator
│   │   ├── UploadSection.tsx        # File upload component
│   │   ├── FileList.tsx             # Uploaded file list with delete button
│   │   ├── QuerySection.tsx         # Query input with mode switcher
│   │   ├── AnswerDisplay.tsx        # Streaming answer renderer
│   │   ├── SourceList.tsx           # Citation source list
│   │   └── SourceCard.tsx           # Single source card
│   ├── hooks/
│   │   ├── useQuery.ts              # Query state management (streaming + history)
│   │   └── useUpload.ts             # Upload state management
│   ├── lib/
│   │   └── api.ts                   # API client (NDJSON streaming parser)
│   └── types/
│       └── index.ts                 # TypeScript type definitions

data/
├── raw/                             # Uploaded document files (gitignored)
├── parsed/                          # Parsed Markdown output (gitignored)
└── qdrant_storage/                  # Qdrant persistent vector data (gitignored)
```

### AI Stack
- **LLM**: NVIDIA NIM — `meta/llama-3.1-70b-instruct` (temperature=0.1 for factual accuracy)
- **Embeddings**: NVIDIA NIM — `nvidia/nv-embedqa-e5-v5` (dimension=1024, optimized for long documents)
- **Orchestration**: LlamaIndex — models set as global defaults via `Settings.llm` / `Settings.embed_model`
- **Vector DB**: Qdrant in local file mode (no external server required)
- **Document Parsing**: PyMuPDF (fast, default) with `marker-pdf` fallback; supports 10 extensions across 9 formats (PDF, DOCX, XLSX, XLS, PPTX, CSV, JSON, TXT, MD/Markdown)
- **RAG Pipeline**: Custom retriever (top_k=3) + LLM generation with `[1]`, `[2]` source citations
- **Chunking**: `SentenceSplitter(chunk_size=1024, chunk_overlap=128)`

### Data Flow
1. `POST /api/upload` → save file to `data/raw/` → `FinancialReportParser` → Markdown → save to `data/parsed/`
2. `SentenceSplitter` → NVIDIA embed → store in Qdrant → `metadata_store.add_document()` save metadata
3. `POST /api/query` → embed question → Qdrant similarity search (top_k=3) → LLM answer with source citations
4. `POST /api/chat` → direct LLM call (no vector search), for general conversation

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload and index a document |
| `POST` | `/api/query` | RAG query against indexed documents |
| `POST` | `/api/query/stream` | Streaming RAG query (NDJSON) |
| `POST` | `/api/chat` | General assistant chat (no documents) |
| `POST` | `/api/chat/stream` | Streaming general chat (NDJSON) |
| `GET` | `/api/documents` | List all uploaded documents with metadata |
| `DELETE` | `/api/documents/{file_name}` | Delete document + vectors + metadata |
| `GET` | `/api/health` | Service health check |

### Streaming Protocol (NDJSON)

Both `/api/query/stream` and `/api/chat/stream` return newline-delimited JSON events:

| Event Type | Payload | Description |
|------------|---------|-------------|
| `status` | `{"type":"status","message":"..."}` | Status update (e.g., "searching...", "generating...") |
| `sources` | `{"type":"sources","sources":[...]}` | Retrieved source chunks (query/stream only) |
| `delta` | `{"type":"delta","text":"..."}` | Partial LLM output token |
| `done` | `{"type":"done","total_ms":N}` | Stream complete |
| `error` | `{"type":"error","message":"..."}` | Error occurred |

### Startup Sequence (lifespan)
1. `init_nvidia_services()` — configures LLM + Embedding as LlamaIndex globals
2. `init_qdrant()` — opens/creates local Qdrant storage

### Document Persistence
- Uploaded file: `data/raw/<file_name>`
- Parsed Markdown: `data/parsed/<file_stem>/<file_stem>.md`
- Vectors: Qdrant local storage at `data/qdrant_storage/`
- Metadata: `data/metadata.json` (thread-safe, uses `threading.Lock`)

### Qdrant Collection
- Collection name: `financial_reports` (configurable in `qdrant_client.py`)
- To reset: delete `data/qdrant_storage/` directory

## Known Issues & Gotchas

### Virtual Environment Must Be Activated
**Problem**: Running `python main.py` directly fails with `ModuleNotFoundError` (e.g., `No module named 'fitz'`, `No module named 'docx'`).

**Root Cause**: The system Python is being used instead of the venv Python. Dependencies are installed in `.venv/` but not available to the system Python.

**Solution**: Always activate the virtual environment first:
```powershell
# Windows
.venv\Scripts\activate

# Then run from backend/
cd backend
python main.py
```

You'll see `(.venv)` in your prompt when activated.

### Package Name vs Import Name Mismatches
Some packages have different installation names and import names:
- `pymupdf` (install) → `import fitz` (code)
- `python-docx` (install) → `from docx import ...` (code)
- `python-pptx` (install) → `from pptx import ...` (code)

This is normal Python behavior. If you see `ModuleNotFoundError`, check `requirements.txt` for the correct package name to install.

### Frontend Next.js Version
This project uses Next.js 16.2.2, which has breaking changes from earlier versions. Before writing frontend code, check `node_modules/next/dist/docs/` for API changes. See `frontend/AGENTS.md` for details.

### Document Deletion Clears RAG Index Cache
When deleting a document via `DELETE /api/documents/{file_name}`, the in-memory `VectorStoreIndex` cache is reset. The next query will be slightly slower as it rebuilds from Qdrant. This is intentional and ensures deleted vectors are excluded.
