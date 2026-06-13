# FinAnalyzer RAG Pro — Project Guide

> Last updated: 2024 | Auto-generated from codebase analysis

---

## 1. Project Overview

**FinAnalyzer RAG Pro** is a financial document analysis system that uses RAG (Retrieval-Augmented Generation) to answer questions about uploaded financial reports with source citations.

### Key Technologies

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS 4 | User interface |
| **Backend** | FastAPI + Python 3.12 + Uvicorn | REST API server |
| **LLM** | NVIDIA NIM — `meta/llama-3.1-70b-instruct` | Answer generation |
| **Embeddings** | NVIDIA NIM — `nvidia/nv-embedqa-e5-v5` | Text vectorization |
| **Vector DB** | Qdrant (local file mode) | Similarity search |
| **PDF Parsing** | marker-pdf (`marker_single` CLI) | PDF → Markdown |
| **Orchestration** | LlamaIndex | RAG pipeline |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │UploadSect│  │ QuerySection │  │  AnswerDisplay       │  │
│  └─────┬────┘  └──────┬───────┘  └─────────────────────┘  │
└────────┼──────────────┼────────────────────────────────────┘
         │ POST /api/upload
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (FastAPI)                           │
│                                                             │
│  ┌─────────┐    ┌─────────────┐    ┌──────────────────┐   │
│  │ Parser  │───▶│  RAG Index  │───▶│  Qdrant Storage   │   │
│  │(marker) │    │(LlamaIndex) │    │  (./data/qdrant)  │   │
│  └─────────┘    └──────┬──────┘    └──────────────────┘   │
│                        │                                     │
│                 ┌──────▼──────┐                             │
│                 │ NVIDIA NIM  │                             │
│                 │ (LLM+Embed) │                             │
│                 └─────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Getting Started

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | 3.12+ | Required for backend |
| Node.js | 18+ | Required for frontend |
| NVIDIA API Key | — | Get from [build.nvidia.com](https://build.nvidia.com) |

### Installation

#### Backend Setup

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Create .env file (REQUIRED)
echo NVIDIA_API_KEY=your_api_key_here > .env

# 3. Install dependencies (use project venv)
.venv\Scripts\activate
pip install -r requirements.txt

# 4. Start the server
python main.py
# Server runs at: http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

#### Frontend Setup

```powershell
cd frontend
npm install
npm run dev
# Frontend runs at: http://localhost:3000
```

### Basic Usage Examples

```bash
# Health check
curl http://localhost:8000/api/health

# Upload a PDF file
curl -X POST http://localhost:8000/api/upload -F "file=@report.pdf"

# Query uploaded documents
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "该公司2024年的营收增长率是多少？"}'

# Stream query (real-time response)
curl -X POST http://localhost:8000/api/query/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "比较2023和2024年的财务数据"}'

# General chat (no documents needed)
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "解释什么是RAG技术"}'
```

---

## 3. Project Structure

```
.
├── .continue/rules/          # Continue AI assistant rules (THIS FILE)
├── backend/                  # FastAPI backend
│   ├── main.py              # Entry point with FastAPI app & lifespan events
│   ├── requirements.txt     # Python dependencies
│   ├── .env                 # Environment variables (API keys)
│   └── app/
│       ├── api/
│       │   └── routes.py    # API endpoints: /upload, /query, /chat, /health
│       ├── core/
│       │   ├── nvidia_client.py   # LLM & Embedding model initialization
│       │   └── qdrant_client.py   # Qdrant vector DB connection
│       ├── models/
│       │   └── schemas.py   # Pydantic request/response models
│       └── services/
│           ├── parser.py    # PDF→Markdown parsing via marker-pdf
│           ├── rag_service.py    # RAG indexing & querying
│           └── chat_service.py    # General chat (no RAG)
├── frontend/                 # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   └── page.tsx     # Main chat interface
│   │   ├── components/      # React components
│   │   ├── hooks/          # Custom React hooks (useUpload, useQuery)
│   │   ├── lib/
│   │   │   └── api.ts       # Backend API client with streaming support
│   │   └── types/
│   │       └── index.ts     # TypeScript type definitions
│   └── package.json
└── CLAUDE.md                # Claude Code specific guidance
```

### Key Configuration Files

| File | Purpose |
|------|---------|
| `backend/.env` | NVIDIA API key configuration |
| `backend/requirements.txt` | Python package dependencies |
| `frontend/next.config.ts` | Next.js configuration |
| `frontend/tsconfig.json` | TypeScript configuration |

### Data Directories

```
backend/data/
├── raw/                    # Uploaded PDF files
├── parsed/<pdf_name>/      # Marker output (Markdown + images)
│   └── *.md                # Parsed document content
└── qdrant_storage/        # Qdrant persistent vector data
    └── collection/
        └── financial_reports/
            └── storage.sqlite
```

---

## 4. Development Workflow

### Coding Standards

#### Python (Backend)
- Use type hints for function parameters and return values
- Follow FastAPI conventions for route handlers
- Use Pydantic models for request/response validation
- Run async operations in executor for CPU-bound tasks

#### TypeScript (Frontend)
- Use React functional components with hooks
- Follow existing component patterns (Tailwind CSS styling)
- Use the custom hooks (`useQuery`, `useUpload`) for API calls
- Type all API responses using `types/index.ts`

### Project Flow

```
Document Upload Flow:
┌────────────────┐
│ User uploads   │
│ PDF via UI     │
└───────┬────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  POST /api/upload                                        │
│  1. Save to data/raw/                                    │
│  2. Parse PDF → Markdown (marker-pdf)                     │
│  3. Split into chunks (512 chars, 64 overlap)            │
│  4. Generate embeddings (NVIDIA)                         │
│  5. Store in Qdrant vector DB                            │
└─────────────────────────────────────────────────────────┘

Query Flow:
┌────────────────┐
│ User asks      │
│ a question     │
└───────┬────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  POST /api/query or /api/query/stream                    │
│  1. Embed question (NVIDIA)                              │
│  2. Retrieve top-k similar chunks from Qdrant          │
│  3. Build prompt with sources                           │
│  4. Generate answer via LLM                            │
│  5. Return answer with citations                       │
└─────────────────────────────────────────────────────────┘
```

### Testing

#### Backend API Testing

```bash
# Using curl
curl http://localhost:8000/api/health

# Test upload
curl -X POST http://localhost:8000/api/upload -F "file=@tests/TechVision_Annual_Report_2024.pdf"

# Test query
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the revenue growth?"}'

# Test streaming
curl -X POST http://localhost:8000/api/query/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "Compare years 2023 and 2024"}' -N
```

---

## 5. Key Concepts

### RAG (Retrieval-Augmented Generation)

A pattern where:
1. **Retrieval**: Find relevant document chunks based on semantic similarity
2. **Augmentation**: Include retrieved content in the prompt
3. **Generation**: LLM generates answer based on augmented context

### Document Processing Pipeline

```
PDF File
    │
    ▼ [marker_single CLI]
Markdown + Images
    │
    ▼ [SentenceSplitter]
Text Chunks (512 chars, 64 overlap)
    │
    ▼ [NVIDIA Embeddings]
Vector Embeddings
    │
    ▼ [Qdrant]
Indexed Vectors
```

### Supported File Types

| Extension | Format | Parser |
|-----------|--------|--------|
| `.pdf` | PDF Documents | marker-pdf |
| `.docx` | Word Documents | python-docx |
| `.pptx` | PowerPoint | python-pptx |
| `.xlsx` | Excel | openpyxl |

---

## 6. Common Tasks

### Adding a New API Endpoint

1. Define Pydantic schemas in `backend/app/models/schemas.py`
2. Add route handler in `backend/app/api/routes.py`
3. (Optional) Add corresponding frontend component

Example:
```python
# backend/app/models/schemas.py
from pydantic import BaseModel

class NewRequest(BaseModel):
    field: str

class NewResponse(BaseModel):
    result: str

# backend/app/api/routes.py
@router.post("/new-endpoint", response_model=NewResponse)
async def new_endpoint(request: NewRequest):
    return NewResponse(result=f"Processed: {request.field}")
```

### Modifying the RAG Pipeline

To change how documents are indexed:
- Edit `rag_service.py` → `index_document()` — controls chunk size, overlap
- Edit `rag_service.py` → `_prepare_document_prompt()` — controls how context is built
- Edit `nvidia_client.py` → `init_nvidia_services()` — changes LLM/embedding models

### Adding Streaming to a New Endpoint

```python
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

def _json_line(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False) + "\n"

@router.post("/new-stream")
async def new_stream():
    def generate():
        yield _json_line({"type": "status", "message": "Starting..."})
        for i in range(5):
            yield _json_line({"type": "delta", "text": f"Chunk {i}"})
        yield _json_line({"type": "done"})
    
    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson; charset=utf-8"
    )
```

### Debugging Tips

```python
# Add debug logging to any service
import logging
logger = logging.getLogger(__name__)

def some_function(data):
    logger.debug(f"Received data: {data}")
    print(f"Processing: {data}")  # Also prints to server console
```

---

## 7. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `ValueError: 缺少 NVIDIA_API_KEY` | Missing `.env` file | Create `backend/.env` with valid key |
| Upload fails | File too large or unsupported | Check file type, see `parser.is_supported()` |
| Empty query results | Document not indexed | Call `/api/upload` before querying |
| CORS errors | Frontend can't reach backend | Check backend CORS settings in `main.py` |
| marker-pdf fails | Missing system dependencies | Run: `pip install marker-pdf[all]` |

### Reset Vector Database

If you need to clear all indexed documents:

```bash
# Stop the server
# Delete Qdrant storage
rm -rf backend/data/qdrant_storage/
# Restart server (will recreate empty storage)
python backend/main.py
```

### View Parsed Documents

```bash
# List raw files
ls backend/data/raw/

# View parsed Markdown
cat backend/data/parsed/TechVision_Annual_Report_2024/TechVision_Annual_Report_2024.md
```

---

## 8. References

### Documentation Links

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [LlamaIndex Documentation](https://docs.llamaindex.ai/)
- [NVIDIA NIM API](https://docs.api.ngc.nvidia.com/)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Next.js 16 Guide](https://nextjs.org/docs)
- [marker-pdf GitHub](https://github.com/VikParuchuri/marker)

### API Endpoint Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/upload` | Upload & index document |
| POST | `/api/query` | Query documents (non-streaming) |
| POST | `/api/query/stream` | Query documents (streaming) |
| POST | `/api/chat` | General chat (no RAG) |
| POST | `/api/chat/stream` | General chat (streaming) |

---

## Notes

- Continue will automatically load this file when working on the project
- Create additional `.md` files in subdirectories for component-specific documentation
- Update this file when the project architecture changes
</contents>