import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.api.routes import router
from app.core.agnes_client import init_agnes_services
from app.core.qdrant_client import close_qdrant, init_qdrant

load_dotenv()

# Lifecycle events
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        print("[INIT] Initializing Agnes AI & LlamaIndex...")
        init_agnes_services()
        print("[INIT] Initializing Qdrant vector database...")
        init_qdrant(url=os.getenv("QDRANT_URL"))
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
    allow_origins=["*"], # Since it's local dev, allow all. Or ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, log_level="info", workers=1)
