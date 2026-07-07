import asyncio
import json
import shutil
from functools import partial
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.asset_store import list_assets
from app.core.feedback_store import add_feedback
from app.core.metadata_store import add_document, delete_document as delete_doc_meta, list_documents
from app.core.qdrant_client import delete_document_vectors
from app.core.template_store import ensure_templates, list_templates
from app.models.schemas import (
    AgentRequest,
    AgentResponse,
    AssetListResponse,
    ChatRequest,
    ChatResponse,
    DeleteResponse,
    DocumentInfo,
    DocumentListResponse,
    FeedbackRequest,
    FeedbackResponse,
    GeneratedAsset,
    ImageRequest,
    ImageResponse,
    QueryRequest,
    QueryResponse,
    SourceNode,
    TemplateInfo,
    TemplateListResponse,
    UploadResponse,
)
from app.services.parser import FinancialReportParser

router = APIRouter()

MAX_UPLOAD_SIZE = 50 * 1024 * 1024
parser = FinancialReportParser()


def _json_line(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False) + "\n"


def _to_source_nodes(items: list[dict]) -> list[SourceNode]:
    return [SourceNode(**item) for item in items]


@router.get("/templates", response_model=TemplateListResponse, summary="获取模板列表")
async def get_template_list():
    ensure_templates()
    templates = list_templates()
    return TemplateListResponse(
        templates=[TemplateInfo(**template) for template in templates],
        total=len(templates),
    )


@router.get("/assets", response_model=AssetListResponse, summary="获取生成资产")
async def get_generated_assets():
    assets = list_assets()
    return AssetListResponse(
        assets=[GeneratedAsset(**asset) for asset in assets],
        total=len(assets),
    )


@router.post("/agent/run", response_model=AgentResponse, summary="执行 Agent 工作流")
async def run_agent_workflow(request: AgentRequest):
    if not request.input.strip():
        raise HTTPException(status_code=400, detail="输入不能为空")

    try:
        history = [message.model_dump() for message in request.history]
        loop = asyncio.get_running_loop()
        from app.services.agent_service import run_agent

        result = await loop.run_in_executor(
            None,
            partial(
                run_agent,
                request.input,
                template_id=request.template_id,
                mode=request.mode,
                model=request.model,
                history=history,
            ),
        )
        return AgentResponse(
            answer=result.get("answer", ""),
            sources=_to_source_nodes(result.get("sources", [])),
            asset=result.get("asset"),
            mode=result.get("mode", "assistant"),
            model=result.get("model"),
            total_ms=result.get("total_ms", 0),
            events=result.get("events", []),
            react_steps=result.get("react_steps", []),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {str(e)}") from e


@router.post("/agent/stream", summary="流式执行 Agent 工作流")
async def stream_agent_workflow(request: AgentRequest):
    if not request.input.strip():
        raise HTTPException(status_code=400, detail="输入不能为空")

    history = [message.model_dump() for message in request.history]

    def generate():
        try:
            from app.services.agent_service import stream_agent

            for event in stream_agent(
                request.input,
                template_id=request.template_id,
                mode=request.mode,
                model=request.model,
                history=history,
            ):
                yield _json_line(event)
        except Exception as e:
            yield _json_line({"type": "error", "message": f"Agent execution failed: {str(e)}"})

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/upload", response_model=UploadResponse, summary="上传并索引文档")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    safe_filename = Path(file.filename).name
    if not parser.is_supported(safe_filename):
        raise HTTPException(
            status_code=400,
            detail=f"仅支持这些文件格式: {parser.supported_extensions_text()}",
        )

    file_size = 0
    save_path = parser.raw_dir / safe_filename
    with open(save_path, "wb") as f:
        while True:
            chunk = await file.read(64 * 1024)
            if not chunk:
                break
            file_size += len(chunk)
            if file_size > MAX_UPLOAD_SIZE:
                save_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"文件过大，最大允许 {MAX_UPLOAD_SIZE // (1024 * 1024)}MB",
                )
            f.write(chunk)

    try:
        loop = asyncio.get_running_loop()

        from app.core.qdrant_client import init_qdrant
        from app.services.rag_service import index_document

        init_qdrant()
        md_path = await loop.run_in_executor(None, partial(parser.parse_file, str(save_path)))
        chunks_count = await loop.run_in_executor(None, partial(index_document, md_path, safe_filename))
        add_document(safe_filename, chunks_count)

        return UploadResponse(
            file_name=safe_filename,
            status="success",
            message=f"文档解析并索引完成，共生成 {chunks_count} 个文本块",
            chunks_indexed=chunks_count,
        )
    except HTTPException:
        raise
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}") from e


@router.post("/query", response_model=QueryResponse, summary="查询文档")
async def query_report(request: QueryRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    try:
        loop = asyncio.get_running_loop()
        history = [message.model_dump() for message in request.history]
        from app.core.qdrant_client import init_qdrant
        from app.services.rag_service import query_documents

        init_qdrant()
        result = await loop.run_in_executor(
            None,
            partial(query_documents, request.question, history=history),
        )

        return QueryResponse(
            answer=result["answer"],
            sources=_to_source_nodes(result["sources"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}") from e


@router.post("/query/stream", summary="流式查询文档")
async def stream_query_report(request: QueryRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    history = [message.model_dump() for message in request.history]

    def generate():
        try:
            from app.core.qdrant_client import init_qdrant
            from app.services.rag_service import stream_query_documents

            init_qdrant()
            for event in stream_query_documents(request.question, history=history):
                yield _json_line(event)
        except Exception as e:
            yield _json_line({"type": "error", "message": f"查询失败: {str(e)}"})

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat", response_model=ChatResponse, summary="一般聊天")
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    try:
        loop = asyncio.get_running_loop()
        history = [message.model_dump() for message in request.history]
        from app.services.chat_service import chat_with_assistant

        answer = await loop.run_in_executor(
            None,
            partial(chat_with_assistant, request.message, history=history, model=request.model),
        )
        return ChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"聊天失败: {str(e)}") from e


@router.post("/chat/stream", summary="流式一般聊天")
async def stream_chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    history = [message.model_dump() for message in request.history]

    def generate():
        try:
            yield _json_line({"type": "status", "message": "Connecting to model..."})
            from app.services.chat_service import stream_chat_with_assistant

            for delta in stream_chat_with_assistant(request.message, history=history, model=request.model):
                yield _json_line({"type": "delta", "text": delta})
            yield _json_line({"type": "done"})
        except Exception as e:
            yield _json_line({"type": "error", "message": f"聊天失败: {str(e)}"})

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/health", summary="健康检查")
async def health_check():
    return {"status": "ok", "service": "ChatPDF"}


@router.get("/documents", response_model=DocumentListResponse, summary="获取已索引文档列表")
async def get_documents():
    docs = list_documents()
    return DocumentListResponse(
        documents=[DocumentInfo(**d.__dict__) for d in docs],
        total=len(docs),
    )


@router.delete("/documents/{file_name:path}", response_model=DeleteResponse, summary="删除文档")
async def delete_document(file_name: str):
    from app.core.qdrant_client import init_qdrant
    from app.services.rag_service import delete_from_index

    init_qdrant()
    vectors_deleted = delete_document_vectors(file_name)
    meta_deleted = delete_doc_meta(file_name)
    delete_from_index(file_name)

    raw_file = parser.raw_dir / file_name
    if raw_file.exists():
        raw_file.unlink()

    parsed_dir = parser.parsed_dir / Path(file_name).stem
    if parsed_dir.exists():
        shutil.rmtree(parsed_dir)

    if not meta_deleted and vectors_deleted == 0:
        raise HTTPException(status_code=404, detail=f"未找到文档 '{file_name}'")

    return DeleteResponse(
        message=f"文档 '{file_name}' 已删除，共移除 {vectors_deleted} 个向量点",
        vectors_deleted=vectors_deleted,
    )


@router.post("/generate-image", response_model=ImageResponse, summary="文生图")
async def generate_image_endpoint(request: ImageRequest):
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="描述不能为空")

    try:
        from app.services.image_service import generate_image

        result = await generate_image(request.prompt)
        first_image = result["images"][0]
        return ImageResponse(image_data=first_image["b64_json"], format="png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片生成失败: {str(e)}") from e


@router.post("/feedback", response_model=FeedbackResponse, summary="保存用户反馈")
async def save_feedback(request: FeedbackRequest):
    if not request.message_id.strip():
        raise HTTPException(status_code=400, detail="message_id 不能为空")
    if request.rating not in (-1, 1):
        raise HTTPException(status_code=400, detail="rating 只能是 -1 或 1")

    total = add_feedback(request.model_dump())
    return FeedbackResponse(total=total)
