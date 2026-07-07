from typing import List, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single chat message."""

    role: str = Field(pattern="^(user|assistant)$")
    content: str


class QueryRequest(BaseModel):
    """Document question request."""

    question: str
    collection_name: Optional[str] = "financial_reports"
    history: List[ChatMessage] = []


class ChatRequest(BaseModel):
    """General chat request."""

    message: str
    history: List[ChatMessage] = []
    model: Optional[str] = None


class SourceNode(BaseModel):
    """Source citation payload."""

    source_id: Optional[str] = None
    text: str
    score: Optional[float] = None
    file_name: Optional[str] = None
    document_title: Optional[str] = None
    chunk_index: Optional[int] = None
    page_number: Optional[int] = None
    file_path: Optional[str] = None


class QueryResponse(BaseModel):
    """Query response with citations."""

    answer: str
    sources: List[SourceNode]


class ChatResponse(BaseModel):
    """General chat response."""

    answer: str


class UploadResponse(BaseModel):
    """File upload response."""

    file_name: str
    status: str
    message: str
    chunks_indexed: int


class DocumentInfo(BaseModel):
    """Stored document metadata."""

    file_name: str
    upload_time: str
    chunks_indexed: int


class DocumentListResponse(BaseModel):
    """Document list response."""

    documents: list[DocumentInfo]
    total: int


class ImageRequest(BaseModel):
    """Image generation request."""

    prompt: str


class ImageResponse(BaseModel):
    """Image generation response."""

    image_data: str
    format: str = "png"


class DeleteResponse(BaseModel):
    """Document deletion response."""

    message: str
    vectors_deleted: int


class TemplateInfo(BaseModel):
    """Template configuration."""

    id: str
    name: str
    description: str
    default_prompt: str
    workflow_id: str


class TemplateListResponse(BaseModel):
    """Template list response."""

    templates: list[TemplateInfo]
    total: int


class GeneratedAsset(BaseModel):
    """Generated asset payload."""

    id: str
    asset_type: str
    title: str
    content: str = ""
    image_data: str = ""
    format: str = ""
    source_template_id: str | None = None
    source_question: str | None = None


class AssetListResponse(BaseModel):
    """Generated asset list response."""

    assets: list[GeneratedAsset]
    total: int


class AgentRequest(BaseModel):
    """Agent execution request."""

    input: str
    template_id: str | None = None
    mode: str = "agent"
    model: str | None = None
    history: list[ChatMessage] = []


class AgentResponse(BaseModel):
    """Agent execution response."""

    answer: str
    sources: list[SourceNode]
    asset: GeneratedAsset | None = None
    mode: str = "assistant"
    model: str | None = None
    total_ms: int = 0
    events: list[dict] = []
    react_steps: list[dict] = []


class FeedbackRequest(BaseModel):
    """User feedback payload."""

    message_id: str
    rating: int
    tag: str | None = None
    comment: str | None = None
    mode: str | None = None
    source_ids: list[str] = []


class FeedbackResponse(BaseModel):
    """Feedback save response."""

    status: str = "ok"
    total: int = 0
