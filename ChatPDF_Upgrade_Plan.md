# ChatPDF 改造升级计划

> 创建于: 2026-05-24
> 基于: FinAnalyzer RAG Pro → 个人文档问答助手（ChatPDF）

---

## 现状评估

现有代码已具备 ChatPDF 所需的核心能力，**无需重构**：

| 能力 | 状态 | 说明 |
|------|------|------|
| 多格式文档上传解析 | ✅ 已有 | 10 种格式（PDF/DOCX/XLSX/CSV/JSON/TXT/MD/PPTX/XLS/Markdown） |
| RAG 问答（流式） | ✅ 已有 | top_k=3，NDJSON 流式输出 |
| 多轮对话 history | ✅ 已有 | 最近 10 条上下文，自动截断 |
| 通用聊天（无文档） | ✅ 已有 | `/api/chat` + `/api/chat/stream` |
| 气泡式对话 UI | ✅ 已有 | 流式打字机效果已实现 |
| 文档管理 API | ❌ 缺失 | 无列表、无删除 |
| 文档元数据持久化 | ❌ 缺失 | 重启后列表丢失 |
| 品牌文案 | ❌ 待改 | 仍为"FinAnalyzer RAG Pro / 财报问答工作台" |

---

## Phase 1 — 后端：文档管理 API

### 1.1 新建元数据存储模块
**文件**: `backend/app/core/metadata_store.py`（新建）

- 用 JSON 文件持久化文档元数据
- 存储路径: `backend/data/metadata.json`
- 数据结构:
  ```json
  {
    "documents": [
      {
        "file_name": "report.pdf",
        "upload_time": "2026-05-24T21:00:00",
        "chunks_indexed": 42
      }
    ]
  }
  ```
- 提供三个函数:
  - `add_document(file_name, chunks_indexed)`
  - `list_documents()` → `list[DocumentInfo]`
  - `delete_document(file_name)` → `bool`

### 1.2 Qdrant 客户端新增删除函数
**文件**: `backend/app/core/qdrant_client.py`（修改）

- 新增 `delete_document_vectors(file_name: str)` 函数
- 按 payload 字段 `file_name` 过滤删除对应向量点
- 使用 Qdrant `delete` API with `FieldCondition`

### 1.3 新增 Pydantic Schema
**文件**: `backend/app/models/schemas.py`（修改）

```python
class DocumentInfo(BaseModel):
    file_name: str
    upload_time: str
    chunks_indexed: int

class DocumentListResponse(BaseModel):
    documents: list[DocumentInfo]
    total: int
```

### 1.4 新增 API 端点
**文件**: `backend/app/api/routes.py`（修改）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/documents` | 返回已索引文档列表 |
| `DELETE` | `/api/documents/{file_name}` | 删除文档向量 + 元数据 + 原始文件 |

同时修改 `POST /api/upload`：上传成功后调用 `add_document()` 写入元数据。

---

## Phase 2 — 前端：品牌文案调整

**文件**: `frontend/src/components/Header.tsx`（修改）

| 原文 | 改为 |
|------|------|
| `FinAnalyzer RAG Pro` | `ChatPDF` |
| `财报问答工作台` | `智能文档问答` |
| Logo 文字 `FA` | `CP` |

**文件**: `frontend/src/app/page.tsx`（修改，EmptyChat 组件）

- 描述文案改为通用文档问答场景
- 快捷提示词: `["整理计划", "解释概念", "润色文字", "分析文档"]` → `["总结文档", "提取关键信息", "对比内容", "解释概念"]`

---

## Phase 3 — 前端：文档管理 UI

### 3.1 API 客户端新增函数
**文件**: `frontend/src/lib/api.ts`（修改）

```typescript
export async function listDocuments(): Promise<DocumentListResponse>
export async function deleteDocument(fileName: string): Promise<void>
```

### 3.2 新增类型定义
**文件**: `frontend/src/types/index.ts`（修改）

```typescript
export interface DocumentInfo {
  file_name: string;
  upload_time: string;
  chunks_indexed: number;
}

export interface DocumentListResponse {
  documents: DocumentInfo[];
  total: number;
}
```

### 3.3 FileList 组件改造
**文件**: `frontend/src/components/FileList.tsx`（修改）

- 新增删除按钮（每个文档右侧 × 图标）
- 新增 `onDelete: (fileName: string) => void` prop
- 删除时显示 loading 状态

### 3.4 page.tsx 改造
**文件**: `frontend/src/app/page.tsx`（修改）

- 启动时调用 `listDocuments()` 初始化 `uploadedFiles`（解决刷新后列表消失）
- 删除文档后从列表移除并提示用户
- `mode === "document"` 且 `uploadedFiles.length === 0` 时显示"请先上传文档"引导

---

## Phase 4 — 前端：空状态引导

**文件**: `frontend/src/app/page.tsx`（修改，EmptyChat 组件）

- 文档模式下无文档时，显示上传引导提示
- 助手模式下保持原有欢迎语

---

## 改动文件清单

| 文件 | 操作 | Phase |
|------|------|-------|
| `backend/app/core/metadata_store.py` | 新建 | 1.1 |
| `backend/app/core/qdrant_client.py` | 修改 | 1.2 |
| `backend/app/models/schemas.py` | 修改 | 1.3 |
| `backend/app/api/routes.py` | 修改 | 1.4 |
| `frontend/src/components/Header.tsx` | 修改 | 2 |
| `frontend/src/lib/api.ts` | 修改 | 3.1 |
| `frontend/src/types/index.ts` | 修改 | 3.2 |
| `frontend/src/components/FileList.tsx` | 修改 | 3.3 |
| `frontend/src/app/page.tsx` | 修改 | 2 + 3.4 + 4 |

**共 9 个文件，1 个新建，8 个修改。**

---

## 不需要做的事

- 对话 UI 不需要重构 — 气泡式对话、流式打字机、多轮 history 已全部实现
- 后端 RAG 能力不需要改动 — chunk_size/top_k/embedding 已适合通用文档
- 多集合隔离暂不做 — 单集合对个人使用场景足够
- 用户认证暂不做 — 个人本地部署场景不需要

---

## 工作量估算

| Phase | 工作量 | 预计时间 |
|-------|--------|----------|
| Phase 1 后端文档管理 | 中 | 2-3h |
| Phase 2 品牌文案 | 小 | 15min |
| Phase 3 前端文档管理 UI | 中 | 1-2h |
| Phase 4 空状态引导 | 小 | 30min |
| **合计** | | **4-6h** |
