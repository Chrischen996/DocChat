import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.api.routes import router
from app.core.agnes_client import init_agnes_services
from app.core.qdrant_client import DEFAULT_QDRANT_URL, close_qdrant, init_qdrant

load_dotenv()


def _get_allowed_origins() -> list[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        print("[INIT] Initializing Agnes AI & LlamaIndex...")
        init_agnes_services()
        print("[INIT] Initializing Qdrant vector database...")
        init_qdrant(url=os.getenv("QDRANT_URL", DEFAULT_QDRANT_URL))
        yield
    finally:
        close_qdrant()
        print("[SHUTDOWN] Server shutting down")

app = FastAPI(
    title="DocChat AI Agent API",
    lifespan=lifespan
)

# CORS configuration for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, log_level="info", workers=1)
