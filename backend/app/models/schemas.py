from typing import List, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """一条聊天上下文消息"""

    role: str = Field(pattern="^(user|assistant)$")
    content: str


class QueryRequest(BaseModel):
    """用户查询请求"""

    question: str
    collection_name: Optional[str] = "financial_reports"
    history: List[ChatMessage] = []


class ChatRequest(BaseModel):
    """个人助手聊天请求"""

    message: str
    history: List[ChatMessage] = []


class SourceNode(BaseModel):
    """引用来源信息"""

    text: str
    score: Optional[float] = None
    file_name: Optional[str] = None


class QueryResponse(BaseModel):
    """查询响应，包含回答和引用来源"""

    answer: str
    sources: List[SourceNode]


class ChatResponse(BaseModel):
    """个人助手聊天响应"""

    answer: str


class UploadResponse(BaseModel):
    """文件上传响应"""

    file_name: str
    status: str
    message: str
    chunks_indexed: int


class DocumentInfo(BaseModel):
    """文档元数据"""

    file_name: str
    upload_time: str
    chunks_indexed: int


class DocumentListResponse(BaseModel):
    """文档列表响应"""

    documents: list[DocumentInfo]
    total: int


class ImageRequest(BaseModel):
    """图片生成请求"""

    prompt: str


class ImageResponse(BaseModel):
    """图片生成响应"""

    image_data: str
    format: str = "png"


class DeleteResponse(BaseModel):
    """删除文档响应"""

    message: str
    vectors_deleted: int


class TemplateInfo(BaseModel):
    """模板配置"""

    id: str
    name: str
    description: str
    default_prompt: str
    workflow_id: str


class TemplateListResponse(BaseModel):
    """模板列表响应"""

    templates: list[TemplateInfo]
    total: int


class GeneratedAsset(BaseModel):
    """生成资产"""

    id: str
    asset_type: str
    title: str
    content: str = ""
    image_data: str = ""
    format: str = ""
    source_template_id: str | None = None
    source_question: str | None = None


class AssetListResponse(BaseModel):
    """生成资产列表响应"""

    assets: list[GeneratedAsset]
    total: int


class AgentRequest(BaseModel):
    """Agent 执行请求"""

    input: str
    template_id: str | None = None
    history: list[ChatMessage] = []


class AgentResponse(BaseModel):
    """Agent 执行响应"""

    answer: str
    sources: list[SourceNode]
    asset: GeneratedAsset | None = None
    mode: str = "assistant"
    total_ms: int = 0
