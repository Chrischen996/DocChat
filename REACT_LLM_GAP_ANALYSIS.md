# ReAct Agent 架构与 LLM 层适配问题分析

> 分析时间: 2026-07-07
> 分析范围: `react_agent.py`, `react_parser.py`, `agent_service.py`, `agnes_llm.py`, `agnes_client.py`, `rag_service.py`, `chat_service.py`, `image_service.py` 及前端调用链

---

## 一、关键架构图

```
Frontend (page.tsx)
  └── streamAgent() ─── POST /api/agent/stream
        └── agent_service.stream_agent()
              └── agent_service.run_agent()    ← 同步阻塞，完成后才开始 yield events
                    └── LangGraph: classify → route
                          ├── react_node → run_react_agent()
                          │     ├── _get_llm(model) → AgnesLLM.complete(prompt)  [同步]
                          │     └── execute_react_tool()
                          │           ├── query_documents() → Settings.llm.complete()  ⚠️ 忽略 model
                          │           └── generate_image() → async httpx  ⚠️ sync/async 桥接
                          ├── document_node → query_documents() → Settings.llm  ⚠️ 忽略 model
                          ├── assistant_node → chat_with_assistant(model=...)  ✅
                          └── image_node → generate_image()  ⚠️ asyncio.run() 嵌套风险
```

---

## 二、P0 — 严重适配缺陷（影响功能正确性）

### 1. 模型选择不穿透工具调用层

**问题**: 用户在前端选择了特定模型（如 `deepseek-r1`），`run_react_agent()` 正确地用 `_get_llm(model)` 创建了对应 LLM 实例做推理，但当 agent 调用 `document_search` / `document_deep_search` 工具时，`query_documents()` 内部硬编码使用 `Settings.llm.complete(prompt)`，回退为默认的 `agnes-2.0-flash`。

**影响**: Agent 推理和 RAG 生成使用不同模型，可能导致引用风格/语气不一致。

**涉及文件**:
| 文件 | 行号 | 问题 |
|------|------|------|
| `rag_service.py` | L228 | `Settings.llm.complete(prompt)` 硬编码全局 LLM |
| `rag_service.py` | L271 | `Settings.llm.stream_complete(prompt)` 同上 |
| `agent_service.py` | L74 | `_document_node` 调用 `query_documents()` 未传 model |
| `agent_service.py` | L88 | `_deep_research_node` 同上 |

**修复建议**: `query_documents()` 增加可选 `llm` 参数，`react_agent.execute_react_tool()` 将当前 LLM 实例传入。

---

### 2. AgnesLLM 只暴露 Completion 接口，丢失多轮对话结构

**问题**: `AgnesLLM._call_api()` 将所有内容压缩为一条 `{"role": "user", "content": prompt}` 消息，发送给 Chat Completions API。但实际对话历史、系统指令、ReAct 工具描述、Observation 全部拼接为一个扁平字符串。

**影响**:
- LLM 无法区分系统指令与用户输入，指令遵循能力下降
- 对话历史作为文本嵌入 prompt，占用额外 token 且无法利用模型的原生多轮对话能力
- 不同模型（Claude、GPT-5、Gemini）对 system message 的优化全部失效

**涉及文件**:
| 文件 | 行号 | 问题 |
|------|------|------|
| `agnes_llm.py` | L58-79 | `_call_api` 只发送单条 user 消息 |
| `agnes_llm.py` | L81-119 | `_call_api_stream` 同上 |
| `react_agent.py` | L104-164 | `build_react_prompt` 把所有内容拼成一个字符串 |
| `chat_service.py` | L22-38 | `build_assistant_prompt` 把历史拼接为文本 |

**修复建议**: 
- `AgnesLLM` 增加 `chat(messages: list[dict])` 方法，支持 `system`/`user`/`assistant` 消息数组
- 或添加 `system_prompt` 参数，至少分离系统指令和用户输入

---

### 3. 流式响应是"伪流式"——完成后才开始推送

**问题**: `agent_service.stream_agent()` 内部调用 `run_agent()` 同步阻塞执行整个 agent 循环（可能包含多次 LLM 调用 + 工具调用），**全部完成后**才开始 yield events。最终答案被切成 32 字符的 chunk 模拟打字机效果。

```python
# agent_service.py L254
result = run_agent(...)  # ← 阻塞等待全部完成
for event in result.get("events", []):  # ← 事后重放
    yield event
for index in range(0, len(answer), 32):  # ← 假流式
    yield {"type": "delta", "text": answer[index : index + 32]}
```

**影响**:
- 用户感知延迟 = 全部 agent 循环完成时间（可能 10-30 秒），期间无任何反馈
- 推理过程中的 thinking/tool_start/tool_result 事件全部延迟到最后一起推送
- 与前端 `page.tsx` 设计的实时推理轨迹 UI（`ReActTrace` 组件）完全脱节

**修复建议**: 将 `run_react_agent` 改为生成器模式，每个 step 实时 yield events，`stream_agent` 直接透传。

---

## 三、P1 — 重要适配缺陷（影响鲁棒性和多模型支持）

### 4. 不同模型的 ReAct 输出格式差异未处理

**问题**: `react_parser.py` 使用固定正则表达式解析 `THOUGHT:/ACTION:/ACTION_INPUT:/FINAL_ANSWER:`，但不同模型的输出格式差异显著：

| 模型 | 典型格式问题 |
|------|------------|
| `deepseek-r1` | 输出 `<think>...</think>` 推理标签，干扰正则匹配 |
| `claude-*` | 倾向使用 Markdown 标题（`## Thought`），或在标签前加空行 |
| `gpt-5` / `gpt-4.1` | 可能用 `**THOUGHT:**` 加粗格式 |
| `gemini-*` | 可能在 ACTION 后添加额外解释文本 |

**当前行为**: 当正则匹配失败时，`parse_react_output` 将整个文本作为 `FINAL_ANSWER` 返回（L98-102）。这意味着 agent 在第一步就退出循环，丧失了多步推理能力。

**涉及文件**: `react_parser.py` 全文

**修复建议**:
- 增加模型特定的预处理层（如剥离 `<think>` 标签、Markdown 格式）
- 增加备用解析策略（如 JSON 模式、结构化输出指令）
- 添加解析失败的重试机制（附加格式纠正提示）

---

### 5. 无原生 Function Calling / Tool Use 支持

**问题**: Agnes API hub 提供 OpenAI 兼容接口，多个模型（GPT-5、Claude、Gemini）原生支持 function calling / tool use。但当前实现完全依赖纯文本 ReAct prompt，放弃了这一能力。

**影响**:
- 纯文本解析脆弱，容易出现工具名拼写错误、格式异常
- 无法利用模型的结构化输出能力
- 多一轮文本解析延迟和出错概率

**涉及文件**:
| 文件 | 行号 | 问题 |
|------|------|------|
| `agnes_llm.py` | 全文 | 无 `tools` 参数传递 |
| `react_agent.py` | L29-50 | 工具定义只用于 prompt 文本，未构建 function schema |

**修复建议**:
- 为支持 function calling 的模型，动态构建 `tools` 参数
- 对不支持的模型保留当前纯文本 ReAct 回退
- `AgnesLLM` 增加 `supports_function_calling` 属性

---

### 6. AgnesLLM 无异步实现，阻塞事件循环

**问题**: `AgnesLLM` 使用同步 `httpx.Client`，没有实现 `acomplete` / `astream_complete`。FastAPI 路由中通过 `loop.run_in_executor()` 将同步调用包装到线程池，但：

- LlamaIndex 内部异步操作会回退到同步
- `image_service.py` 使用 async `httpx.AsyncClient`，与 `AgnesLLM` 混用时需要 `_run_async_sync()` 桥接，存在嵌套事件循环风险

```python
# react_agent.py L167-174
def _run_async_sync(factory):
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(factory())
    with ThreadPoolExecutor(max_workers=1) as executor:  # ← 线程池桥接
        return executor.submit(lambda: asyncio.run(factory())).result()
```

**影响**: 在高并发下，每个 agent 请求占用一个线程池线程做同步 HTTP 调用，可能耗尽线程池。

**修复建议**: `AgnesLLM` 增加 async 方法实现 `acomplete` / `astream_complete`，使用 `httpx.AsyncClient`。

---

### 7. Token 计数与上下文窗口管理缺失

**问题**: `AgnesLLM.metadata` 硬编码 `context_window=128000`，但：

| 模型 | 实际上下文窗口 |
|------|-------------|
| `agnes-2.0-flash` | 未知（无文档） |
| `deepseek-r1` | 64K |
| `deepseek-v3` | 128K |
| `gpt-5` | 128K+ |
| `claude-sonnet-4` | 200K |
| `gemini-2.5-pro` | 1M |

当前的截断策略按字符数而非 token 数：
- `_truncate(text, limit=1600)` — 观察文本截断 1600 字符
- `_format_history` — 每条历史截断 900 字符
- `rag_service._build_contextual_question` — 每条历史截断 1000 字符

**影响**: 对于中文（1 字符 ≈ 1-2 token），截断可能过于激进或不足，不同模型的 tokenizer 差异被忽略。

**修复建议**:
- 按模型设置 `context_window`
- 引入 token 计数器（至少用 tiktoken 做估算）
- 在 prompt 组装时检查总 token 数，动态调整截断

---

## 四、P2 — 中等适配缺陷（影响可扩展性和代码质量）

### 8. LangGraph 图编排与 ReAct agent 重复工具调度

**问题**: `agent_service.py` 使用 LangGraph `StateGraph` 做路由：
- `mode=rag` → `_document_node` → `query_documents()`
- `mode=agent` → `_react_node` → `run_react_agent()`
- `mode=image` → `_image_node` → `generate_image()`

但 `run_react_agent()` 内部**再次**实现了工具选择和调度（document_search、image_generate 等）。这导致：

- **职责重叠**: LangGraph 的分类路由和 ReAct 的工具选择是两层独立的决策机制
- **代码重复**: `_document_node` 和 ReAct 的 `document_search` 做的是同一件事
- **状态不同步**: LangGraph 状态和 ReAct 内部状态独立管理

**修复建议**: 二选一——
- 让 LangGraph 成为唯一的编排层，ReAct 降级为 LangGraph 内的一个节点策略
- 或者让 ReAct agent 成为唯一入口，移除 LangGraph 层

---

### 9. `chat_service` 独立于 Agent 架构，model 参数传递不一致

**问题**: 存在两条独立的聊天路径：
1. `/api/chat` → `chat_service.chat_with_assistant(model=None)` — 不传 model
2. `/api/agent/run` → `_assistant_node` → `chat_with_assistant(model=state.model)` — 传 model

但 `/api/chat` 路由的 `ChatRequest` schema 没有 `model` 字段，无法让用户选择模型。

**涉及文件**:
| 文件 | 行号 | 问题 |
|------|------|------|
| `schemas.py` | L21-25 | `ChatRequest` 缺少 `model` 字段 |
| `routes.py` | L234-250 | `/api/chat` 端点未传递 model |

---

### 10. ReAct Prompt 中工具名硬编码

**问题**: `build_react_prompt()` 在 `format_block` 中硬编码了工具名列表：

```python
"ACTION: <document_search|document_deep_search|image_generate|direct_answer>"
```

但工具注册表 `REACT_TOOLS` 是动态字典。如果新增工具，prompt 中的枚举不会自动更新。

**涉及文件**: `react_agent.py` L126

**修复建议**: 从 `REACT_TOOLS.keys()` 动态生成工具名枚举。

---

### 11. `AgentResponse` Schema 缺少 `events` 和 `react_steps` 字段

**问题**: 后端 `run_agent()` 返回包含 `events` 和 `react_steps` 的完整结果，但 `AgentResponse` Pydantic model 没有这两个字段，导致：
- 非流式 `/api/agent/run` 响应丢失了推理轨迹数据
- 前端无法在非流式模式下展示 `ReActTrace` 组件

**涉及文件**:
| 文件 | 行号 | 问题 |
|------|------|------|
| `schemas.py` | L145-152 | `AgentResponse` 缺少 `events`, `react_steps` 字段 |
| `routes.py` | L92-98 | 构建响应时丢弃了 `events` 和 `react_steps` |

---

### 12. `LocalHashEmbedding` 与语义检索根本不兼容

**问题**: `LocalHashEmbedding` 是基于 BLAKE2b 哈希的关键词匹配向量，不是语义嵌入模型。这意味着：
- "公司盈利情况" 和 "企业利润表现" 的向量完全不同（即使语义相同）
- ReAct agent 的 `document_search` 工具返回的结果可能与问题语义不相关
- Agent 基于低质量检索结果做推理，回答质量受限

**当前状态**: 这不是 ReAct/LLM 的适配问题，但它严重限制了 agent 工具的实际效果。

---

## 五、P3 — 可改进点

### 13. 无错误分类与重试策略

当前 ReAct 循环对 LLM 调用失败的处理：
- API 超时 / 限流 / 认证失败全部抛到外层 `try/except Exception`
- 没有区分可重试错误（超时、限流）和不可重试错误（模型不存在、认证失败）
- 没有指数退避重试

### 14. `_get_llm()` 重复实现

`react_agent._get_llm()` 和 `chat_service._get_llm()` 是完全相同的代码（包括注释），应抽取为共享工具函数。

### 15. `max_tokens` 对不同场景未做调整

`AgnesLLM` 硬编码 `max_tokens=4096`，但：
- ReAct 推理步骤通常只需要 200-500 tokens
- 最终答案生成可能需要 2000-8000 tokens
- 图片描述优化只需要 200 tokens

不同场景应使用不同的 `max_tokens` 以节省成本和减少延迟。

### 16. 前端 `ChatMode` 类型与后端 `_normalize_mode` 不完全对齐

| 前端 `ChatMode` | 后端 `_normalize_mode` 支持 |
|-----------------|---------------------------|
| `"rag"` | ✅ |
| `"agent"` | ✅ |
| `"deep_research"` | ✅ |
| `"image"` | ✅ |
| — | `"assistant"` (后端独有) |

前端无法显式选择 `"assistant"` 模式，后端的 `assistant` 模式只能通过模板匹配或工作流推断触发。

---

## 六、优先级汇总

```
P0 严重（功能正确性）────────────────────────────────
  ├── [1] 模型选择不穿透工具调用层 — rag_service 忽略 model
  ├── [2] LLM 接口只有单条 user message，丢失多轮结构
  └── [3] 流式响应是伪流式，用户感知延迟极高

P1 重要（鲁棒性/多模型）──────────────────────────────
  ├── [4] 不同模型的 ReAct 输出格式差异未处理
  ├── [5] 无原生 Function Calling 支持
  ├── [6] AgnesLLM 无异步实现
  └── [7] Token 计数与上下文窗口管理缺失

P2 中等（可扩展性）───────────────────────────────────
  ├── [8]  LangGraph 与 ReAct 职责重叠
  ├── [9]  chat_service model 参数不一致
  ├── [10] ReAct Prompt 工具名硬编码
  ├── [11] AgentResponse 缺少 events/react_steps
  └── [12] LocalHashEmbedding 非语义向量

P3 可改进──────────────────────────────────────────
  ├── [13] 无错误分类与重试
  ├── [14] _get_llm() 重复实现
  ├── [15] max_tokens 未按场景调整
  └── [16] 前端 ChatMode 与后端不完全对齐
```

---

## 七、建议修复路径

### 阶段一：修复 P0（~2-3 天）

1. **LLM 接口升级**: `AgnesLLM` 增加 `chat(messages)` 方法，支持 system/user/assistant 消息分离
2. **Model 穿透**: `query_documents()` 增加可选 `llm` 参数，agent 工具调用时传入当前 LLM
3. **真流式**: 将 `run_react_agent` 改为生成器 `stream_react_agent`，逐步 yield events

### 阶段二：修复 P1（~3-5 天）

4. **模型适配层**: 按模型族添加 prompt 预处理器和输出后处理器
5. **Function Calling**: 为兼容模型构建 `tools` schema，保留文本 ReAct 作为 fallback
6. **Async LLM**: 实现 `acomplete` / `astream_complete`
7. **Token 管理**: 引入 token 估算和上下文窗口感知截断

### 阶段三：修复 P2（~2-3 天）

8-12. 统一编排层、补全 Schema、修复模式对齐
