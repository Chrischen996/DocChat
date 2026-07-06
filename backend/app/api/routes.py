import asyncio
import json
import shutil
from functools import partial
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.auth import verify_api_key
from app.core.metadata_store import add_document, delete_document as delete_doc_meta, list_documents
from app.core.asset_store import list_assets
from app.core.template_store import ensure_templates, list_templates
from app.core.qdrant_client import delete_document_vectors
from app.models.schemas import (
    AgentRequest,
    AgentResponse,
    ChatRequest,
    ChatResponse,
    AssetListResponse,
    GeneratedAsset,
    DeleteResponse,
    DocumentInfo,
    DocumentListResponse,
    ImageRequest,
    ImageResponse,
    QueryRequest,
    QueryResponse,
    SourceNode,
    TemplateInfo,
    TemplateListResponse,
    UploadResponse,
)
from app.services.agent_service import run_agent, stream_agent
from app.services.parser import FinancialReportParser
from app.services.chat_service import chat_with_assistant, stream_chat_with_assistant
from app.services.image_service import generate_image
from app.services.rag_service import delete_from_index, index_document, query_documents, stream_query_documents

router = APIRouter()

# 最大上传文件大小: 50MB
MAX_UPLOAD_SIZE = 50 * 1024 * 1024

parser = FinancialReportParser()


def _json_line(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False) + "\n"


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


@router.post(
    "/agent/run",
    response_model=AgentResponse,
    summary="执行 Agent 工作流",
    dependencies=[Depends(verify_api_key)],
)
async def run_agent_workflow(request: AgentRequest):
    if not request.input.strip():
        raise HTTPException(status_code=400, detail="输入不能为空")

    try:
        history = [message.model_dump() for message in request.history]
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            partial(run_agent, request.input, template_id=request.template_id, history=history),
        )
        sources = [
            SourceNode(
                text=s["text"],
                score=s.get("score"),
                file_name=s.get("file_name"),
            )
            for s in result.get("sources", [])
        ]
        asset = result.get("asset")
        return AgentResponse(
            answer=result.get("answer", ""),
            sources=sources,
            asset=asset,
            mode=result.get("mode", "assistant"),
            total_ms=result.get("total_ms", 0),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent 执行失败: {str(e)}") from e


@router.post(
    "/agent/stream",
    summary="流式执行 Agent 工作流",
    dependencies=[Depends(verify_api_key)],
)
async def stream_agent_workflow(request: AgentRequest):
    if not request.input.strip():
        raise HTTPException(status_code=400, detail="输入不能为空")

    history = [message.model_dump() for message in request.history]

    def generate():
        try:
            for event in stream_agent(request.input, template_id=request.template_id, history=history):
                yield _json_line(event)
        except Exception as e:
            yield _json_line({"type": "error", "message": f"Agent 执行失败: {str(e)}"})

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post(
    "/upload",
    response_model=UploadResponse,
    summary="上传并索引文档",
    dependencies=[Depends(verify_api_key)],
)
async def upload_document(file: UploadFile = File(...)):
    """
    接收支持的文档文件，保存到 data/raw，解析为 Markdown，切分嵌入后存入 Qdrant。
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    # 防止路径遍历攻击
    safe_filename = Path(file.filename).name
    if not parser.is_supported(safe_filename):
        raise HTTPException(
            status_code=400,
            detail=f"仅支持这些文件格式: {parser.supported_extensions_text()}",
        )

    # 检查文件大小（流式读取避免内存溢出）
    file_size = 0
    save_path = parser.raw_dir / safe_filename
    with open(save_path, "wb") as f:
        while True:
            chunk = await file.read(64 * 1024)  # 64KB chunks
            if not chunk:
                break
            file_size += len(chunk)
            if file_size > MAX_UPLOAD_SIZE:
                # 删除已写入的部分
                save_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"文件过大，最大允许 {MAX_UPLOAD_SIZE // (1024*1024)}MB",
                )
            f.write(chunk)

    try:
        loop = asyncio.get_running_loop()

        md_path = await loop.run_in_executor(None, partial(parser.parse_file, str(save_path)))
        chunks_count = await loop.run_in_executor(
            None, partial(index_document, md_path, safe_filename)
        )

        # 将文档元数据持久化
        add_document(safe_filename, chunks_count)

        # 上传完成后保留原始文件（可后续删除以节省空间，此处保留便于调试）
        return UploadResponse(
            file_name=safe_filename,
            status="success",
            message=f"文档解析并索引完成，共生成 {chunks_count} 个文本块",
            chunks_indexed=chunks_count,
        )
    except HTTPException:
        raise
    except Exception as e:
        # 清理残留文件
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}") from e


@router.post("/query", response_model=QueryResponse, summary="查询财报内容")
async def query_report(request: QueryRequest):
    """
    接收用户问题和聊天历史，从 Qdrant 检索相关段落，再由 LLM 生成带引用的回答。
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    try:
        loop = asyncio.get_running_loop()
        history = [message.model_dump() for message in request.history]
        result = await loop.run_in_executor(
            None,
            partial(query_documents, request.question, history=history),
        )

        sources = [
            SourceNode(
                text=s["text"],
                score=s.get("score"),
                file_name=s.get("file_name"),
            )
            for s in result["sources"]
        ]

        return QueryResponse(
            answer=result["answer"],
            sources=sources,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}") from e


@router.post("/query/stream", summary="流式查询财报内容")
async def stream_query_report(request: QueryRequest):
    """
    流式文档分析：先返回引用来源，再逐步返回答案片段。
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    history = [message.model_dump() for message in request.history]

    def generate():
        try:
            for event in stream_query_documents(request.question, history=history):
                yield _json_line(event)
        except Exception as e:
            yield _json_line({"type": "error", "message": f"查询失败: {str(e)}"})

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat", response_model=ChatResponse, summary="个人助手聊天")
async def chat(request: ChatRequest):
    """
    通用个人助手聊天，不依赖上传文档或向量库。
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    try:
        loop = asyncio.get_running_loop()
        history = [message.model_dump() for message in request.history]
        answer = await loop.run_in_executor(
            None,
            partial(chat_with_assistant, request.message, history=history),
        )
        return ChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"聊天失败: {str(e)}") from e


@router.post("/chat/stream", summary="流式个人助手聊天")
async def stream_chat(request: ChatRequest):
    """
    流式个人助手聊天，不依赖上传文档或向量库。
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    history = [message.model_dump() for message in request.history]

    def generate():
        try:
            yield _json_line({"type": "status", "message": "正在连接模型..."})
            for delta in stream_chat_with_assistant(request.message, history=history):
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
    """服务健康检查"""
    return {"status": "ok", "service": "ChatPDF"}


@router.get("/documents", response_model=DocumentListResponse, summary="获取已索引文档列表")
async def get_documents():
    """
    返回所有已成功上传并索引的文档元数据列表。
    数据来自 metadata.json 持久化存储。
    """
    docs = list_documents()
    return DocumentListResponse(
        documents=[DocumentInfo(**d.__dict__) for d in docs],
        total=len(docs),
    )


@router.delete(
    "/documents/{file_name:path}",
    response_model=DeleteResponse,
    summary="删除文档",
    dependencies=[Depends(verify_api_key)],
)
async def delete_document(file_name: str):
    """
    删除指定文档的：
    1. Qdrant 中的向量数据
    2. JSON 元数据记录
    3. data/raw/ 中的原始文件
    4. data/parsed/ 中的解析后文件
    5. 全局索引缓存
    """
    # 1. 删除 Qdrant 向量
    vectors_deleted = delete_document_vectors(file_name)

    # 2. 删除元数据
    meta_deleted = delete_doc_meta(file_name)

    # 3. 重置索引缓存
    delete_from_index(file_name)

    # 4. 删除原始文件
    raw_file = parser.raw_dir / file_name
    if raw_file.exists():
        raw_file.unlink()

    # 5. 删除解析后的目录
    parsed_dir = parser.parsed_dir / Path(file_name).stem
    if parsed_dir.exists():
        shutil.rmtree(parsed_dir)

    if not meta_deleted and vectors_deleted == 0:
        raise HTTPException(
            status_code=404,
            detail=f"未找到文档 '{file_name}'",
        )

    return DeleteResponse(
        message=f"文档 '{file_name}' 已删除，共移除 {vectors_deleted} 个向量点",
        vectors_deleted=vectors_deleted,
    )


@router.post(
    "/generate-image",
    response_model=ImageResponse,
    summary="文生图（Agnes Image API）",
    dependencies=[Depends(verify_api_key)],
)
async def generate_image_endpoint(request: ImageRequest):
    """
    使用 Agnes Image API 根据文字描述生成图片。
    返回 base64 编码的图片数据。
    """
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="描述不能为空")

    try:
        result = await generate_image(request.prompt)
        first_image = result["images"][0]
        return ImageResponse(image_data=first_image["b64_json"], format="png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片生成失败: {str(e)}") from e
