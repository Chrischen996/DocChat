# CLAUDE.md 分析问题清单

> 创建于: 2026-05-24
> 分析目的: 评估 [`CLAUDE.md`](CLAUDE.md) 作为 AI 助手指引文档的完整性、准确性和可操作性

---

## 一、准确性错误

### 1. 文件格式数量不匹配

- **位置**: [`CLAUDE.md:72`](CLAUDE.md:72)
- **原文**: "supports 8 file formats (PDF, DOCX, XLSX, CSV, JSON, TXT, PPTX, XLS)"
- **实际代码**: [`parser.py:22-33`](backend/app/services/parser.py:22) 定义了 10 个扩展名
- **真实数量**: 10 种扩展名 / 9 种格式（`.md` 和 `.markdown` 算同一种格式）
- **遗漏的格式**: `.md`, `.markdown`

---

## 二、严重信息缺失（AI 助手无法正常工作）

### 2. 前端项目完全未文档化

- **涉及目录**: [`frontend/`](frontend/)
- **缺失内容**:
  - 技术栈: Next.js 16.2.2, React 19.2.4, Tailwind CSS 4, TypeScript 5
  - 启动方式: `npm install` → `npm run dev`
  - 环境变量: `NEXT_PUBLIC_API_URL=http://localhost:8000`
  - 目录结构（6 个组件、2 个 hooks、1 个 API 客户端、类型定义）
  - 构建命令: `npm run build`
- **影响**: AI 助手无法理解前端架构，无法修改前端代码，无法指导前端开发

### 3. 个人助手聊天端点完全缺失

- **涉及文件**: [`chat_service.py`](backend/app/services/chat_service.py)
- **缺失端点**:
  | 端点 | 用途 | 是否在 CLAUDE.md 中 |
  |---|---|---|
  | `POST /api/chat` | 通用助手聊天（非 RAG） | ❌ |
  | `POST /api/chat/stream` | 流式通用聊天 | ❌ |
  | `POST /api/query/stream` | 流式文档 RAG 查询 | ❌ |
- **影响**: AI 助手不知道项目有通用聊天能力，curl 示例不完整

### 4. 流式 NDJSON 协议未文档化

- **涉及文件**: [`api.ts:5-10`](frontend/src/lib/api.ts:5)
- **缺失内容**: 流式事件的完整类型定义
- **事件类型**:
  ```typescript
  type StreamEvent =
    | { type: "status"; message: string }
    | { type: "sources"; sources: SourceNode[]; retrieval_ms?: number }
    | { type: "delta"; text: string }
    | { type: "done"; retrieval_ms?: number; generation_ms?: number; total_ms?: number }
    | { type: "error"; message: string };
  ```
- **影响**: 需要对接前端流式接口时需逆向代码

### 5. 缺少双端运行工作流说明

- **缺失内容**: 没有指导如何同时运行 backend（端口 8000）和 frontend（端口 3000）
- **现有辅助文件**: [`start_backend.bat`](start_backend.bat) 未被引用

---

## 三、中优先级缺失

### 6. 测试无运行指引

- **涉及文件**: [`tests/generate_mock_report.py`](tests/generate_mock_report.py)
- **缺失内容**:
  - 如何运行: `python tests/generate_mock_report.py`
  - 如何验证: 上传生成的 PDF 并查询
  - 依赖说明（需在 venv 中运行）

### 7. 环境变量说明不完整

| 变量 | 作用 | 位置 | 是否文档化 |
|---|---|---|---|
| `NVIDIA_API_KEY` | NVIDIA NIM API 密钥 | `backend/.env` | ✅ |
| `NEXT_PUBLIC_API_URL` | 前端后端 API 地址 | `frontend/.env.local` | ❌ |

### 8. Qdrant 管理操作缺失

- **Collection 名称**: `financial_reports`（定义在 [`qdrant_client.py:10`](backend/app/core/qdrant_client.py:10)）
- **重置方法**: 无说明
- **存储路径**: 代码中使用绝对路径 `Path(__file__).resolve().parent.parent.parent / "data" / "qdrant_storage"`

### 9. History 多轮对话未提及

- **涉及文件**: [`rag_service.py:18-43`](backend/app/services/rag_service.py:18)
- **缺失内容**: `query_documents()` 和 `chat_with_assistant()` 都支持 `history` 参数用于多轮追问，但数据流图中只画了单轮查询

---

## 四、低优先级 / 可改进点

### 10. 嵌入向量维度未提及

NV-EmbedQA-E5-v5 的输出维度（1024）未记录，调整 chunk_size 或切换模型时需要此信息。

### 11. 代码风格约定缺失

- Python 类型注解规范
- 路径解析约定（使用 `Path(__file__).resolve()` 避免 CWD 依赖）
- 错误处理模式（路由层抛 `HTTPException`）

### 12. `.gitignore` 与数据目录未联动

[`.gitignore:69-72`](.gitignore:69) 已配置忽略 `data/raw/*`、`data/parsed/*`、`data/qdrant_storage/`，但 CLAUDE.md 未说明这些目录是安全的不需要手动 `.gitkeep` 文件。

### 13. Next.js 版本特殊性

[`frontend/AGENTS.md`](frontend/AGENTS.md) 提示这是 "Next.js you know" 的破坏性版本，建议查阅 `node_modules/next/dist/docs/`。CLAUDE.md 无此说明，可能导致 AI 助手使用错误 API。

---

## 五、优先级排序与修复建议

```
P0 (立即修复) ──────────────────────────────────────
  ├── [修正] 文件格式数量 8 → 10 extensions
  ├── [新增] Frontend 完整章节（setup + 目录结构 + 组件说明）
  └── [新增] Chat / Streaming API 章节（端点 + curl 示例 + NDJSON 协议）

P1 (尽快补充) ──────────────────────────────────────
  ├── [新增] 测试运行指引
  ├── [新增] 环境变量完整表格
  └── [新增] 双端并行开发工作流

P2 (锦上添花) ──────────────────────────────────────
  ├── [新增] Qdrant 管理操作说明
  ├── [新增] History 多轮对话说明
  ├── [新增] 代码风格约定
  └── [新增] Next.js 版本特殊性提示
```

---

## 六、分析方法说明

本次分析通过以下步骤完成：

1. 读取 [`CLAUDE.md`](CLAUDE.md) 全文并提取所有声明性信息
2. 遍历项目文件结构，识别所有代码文件
3. 逐个读取后端核心文件（7 个）并与 CLAUDE.md 交叉验证
4. 逐个读取前端文件（9 个）并评估文档覆盖度
5. 检查配置文件（`.gitignore`, `package.json`, `requirements.txt`）
6. 对比 CLAUDE.md 的每个声明与实际代码实现
7. 按严重性对发现的差异和缺失进行分类
