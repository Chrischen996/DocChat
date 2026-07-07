# 修改审查报告

> 审查时间: 2026-07-07
> 基于提交: e7c720de70255220a1f7996c69d4b968b4ecc190

---

## ✅ 已修复的问题

### 1. **P0-1: 模型选择穿透工具调用层** ✅ 完全修复

**修改范围**:
- `rag_service.py`: `query_documents()` 和 `stream_query_documents()` 新增 `llm=None` 参数
- `react_agent.py`: `execute_react_tool()` 新增 `llm=None` 参数，并传递给 RAG 调用
- `agent_service.py`: `_document_node()` 和 `_deep_research_node()` 调用 `_get_llm()` 获取实例并传入

**效果**: 用户选择的模型（如 `deepseek-r1`）现在会贯穿整个 agent 循环，包括工具调用时的 RAG 查询生成。

**验证**: ✅ 代码逻辑正确，参数传递链完整

---

### 2. **P2-10: ReAct Prompt 工具名硬编码** ✅ 完全修复

**修改**: `react_agent.py` L123
```python
# 之前：硬编码
"ACTION: <document_search|document_deep_search|image_generate|direct_answer>"

# 现在：动态生成
tool_names = "|".join(REACT_TOOLS.keys())
f"ACTION: <{tool_names}>"
```

**效果**: 新增工具时 prompt 会自动更新。

---

### 3. **P2-9: ChatRequest 缺少 model 字段** ✅ 完全修复

**修改**:
- `schemas.py` L26: `ChatRequest` 增加 `model: Optional[str] = None`
- `routes.py` L249: `/api/chat` 端点传递 `model=request.model`
- `routes.py` L268: `/api/chat/stream` 同样传递 model
- `frontend/src/types/index.ts` L57: 前端 `ChatRequest` 增加 `model?: string | null`
- `frontend/src/lib/api.ts` L108-113: `chatWithAssistant()` 接受并发送 model

**效果**: 用户现在可以在一般聊天中选择不同模型。

---

### 4. **P2-11: AgentResponse 缺少 events/react_steps** ✅ 完全修复

**修改**:
- `schemas.py` L153-156: 增加 `model`, `events`, `react_steps` 字段
- `routes.py` L99-100: 非流式端点返回完整数据
- `frontend/src/types/index.ts` L107-111: 前端类型对齐

**效果**: 非流式 `/api/agent/run` 现在也能返回推理轨迹，前端可以展示 `ReActTrace` 组件。

---

### 5. **P1-4: 不同模型的 ReAct 输出格式差异** ✅ 部分修复

**修改**: `react_parser.py` 新增预处理层
- L34: 正则 `THINK_RE` 剥离 DeepSeek-R1 的 `<think>` 标签
- L35-39: 正则 `MARKDOWN_LABEL_RE` 标准化 Markdown 标题和加粗格式
- L53-76: `_preprocess_react_text()` 集成三层清理
- L88-135: `parse_react_output()` 调用预处理

**测试覆盖**:
```python
test_parse_deepseek_think_tag_action()      # ✅ <think> 标签
test_parse_markdown_heading_labels()        # ✅ ## Thought / ## Action
test_parse_bold_labels_final_answer()       # ✅ **THOUGHT:** / **FINAL_ANSWER:**
test_parse_action_with_extra_explanation()  # ✅ ACTION 后跟解释文本
```

**效果**: DeepSeek-R1、Claude（Markdown）、GPT（加粗）的输出格式现在都能正确解析。

---

### 6. **P3-16: 前端 ChatMode 与后端不完全对齐** ✅ 完全修复

**修改**: `frontend/src/types/index.ts` L37
```typescript
export type ChatMode = "rag" | "agent" | "deep_research" | "image" | "assistant";
```

**效果**: 前端类型现在包含后端支持的 `"assistant"` 模式。

---

## ⚠️ 新引入的问题

### 问题 A: 跨模块引用私有函数

**位置**: `agent_service.py` L14
```python
from app.services.react_agent import _get_llm, run_react_agent
```

**问题**: 
- `_get_llm()` 是 `react_agent` 的私有函数（下划线前缀），不应被外部导入
- 违反了模块封装原则
- `_get_llm()` 在 `react_agent.py` 和 `chat_service.py` 中重复实现（代码完全相同）

**影响**: 
- 紧耦合，未来修改 `_get_llm` 签名会影响多个模块
- 代码维护困难

**建议修复**: 将 `_get_llm()` 提升为公共工具函数
```python
# 方案：移至 app/core/agnes_client.py
def get_llm_instance(model: str | None = None):
    if model:
        return build_agnes_llm(model)
    if Settings._llm is not None:
        return Settings.llm
    return init_agnes_services()
```

然后三处都改为 `from app.core.agnes_client import get_llm_instance`。

---

### 问题 B: Markdown 标题标准化过于激进 🔴 **严重**

**位置**: `react_parser.py` L53-76 `_normalize_markdown_labels()`

**问题**: 测试发现的两个边界情况：

#### **边界情况 1**: 在 FINAL_ANSWER 内部的 Markdown 标题被篡改

**输入**:
```
THOUGHT: 足够了
FINAL_ANSWER: 计划如下：
## Action Items
1. 采购 2. 审批
```

**实际输出**:
```python
type='final'
answer='计划如下：\nACTION: Items\n1. 采购 2. 审批'
```

**根因**: `_normalize_markdown_labels()` 在整个文本上执行替换，把答案内容中的 `## Action Items` 转换成了 `ACTION: Items`。

**影响**: 最终答案的 Markdown 格式被破坏。

---

#### **边界情况 2**: 无标签的自然语言输出被误判为工具调用 🔴 **更严重**

**输入**:
```
以下是行动计划：
## Action Items
1. 采购 2. 审批
```

**实际输出**:
```python
type='action'
tool='items'
tool_input=''
```

**根因**: 
1. 预处理把 `## Action Items` 转为 `ACTION: Items`
2. 正则 `ACTION_RE` 匹配到 `ACTION:`，捕获 `items` 作为工具名
3. Parser 返回 action 类型，但 `items` 不是有效工具
4. Agent 进入下一步，发现工具不存在，添加错误 observation，继续循环

**影响**: 
- Agent 浪费一轮推理
- 如果模型持续输出类似格式，可能耗尽 `MAX_REACT_STEPS` 无法给出最终答案

---

**修复方案**:

```python
def _preprocess_react_text(text: str) -> str:
    candidate = _strip_code_fence(text)
    candidate = THINK_RE.sub("", candidate).strip()
    
    # 🔧 修复：只标准化明确的 ReAct 标签行，不处理其余内容
    # 方案 1: 只在有 THOUGHT/ACTION/FINAL_ANSWER 关键词的行上应用
    # 方案 2: 先检测是否为 ReAct 格式输出，再决定是否标准化
    # 方案 3: 使用更严格的正则，要求标签后紧跟冒号或换行
    
    # 临时方案：只标准化完整的 ReAct 标签（带冒号）
    lines = []
    for line in candidate.split('\n'):
        # 只处理明确的标签行
        if re.match(r'^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:THOUGHT|ACTION(?:_INPUT| INPUT)?|FINAL_ANSWER|FINAL ANSWER)(?:\*\*)?\s*:', line, re.IGNORECASE):
            line = _normalize_markdown_labels(line)
        lines.append(line)
    return '\n'.join(lines)
```

或者更保守的方案：**只在检测到至少 2 个 ReAct 标签时才标准化**，否则视为普通文本。

---

### 问题 C: 测试覆盖回归

**对比**:

| 旧测试 (9 个函数) | 新测试 (5 个函数) |
|------------------|------------------|
| ✅ `test_parse_action_output` | ✅ `test_parse_standard_action` |
| ✅ `test_parse_final_output` | ⚠️ 缺失 |
| ✅ `test_parse_code_fenced_action_output` | ⚠️ 缺失（改为只测标签格式） |
| ✅ `test_parse_malformed_output_as_final` | ⚠️ 缺失 |
| ✅ `test_react_tool_registry_and_prompt` | ⚠️ 缺失 |
| ✅ `test_react_direct_answer_loop` | ⚠️ 缺失 |
| ✅ `test_react_document_search_loop_with_mocked_tool` | ⚠️ 缺失 |
| ✅ `test_deep_search_tool_uses_larger_top_k` | ⚠️ 缺失 |
| ✅ `test_image_generate_tool_with_mocked_service` | ⚠️ 缺失 |
| — | ✅ `test_parse_deepseek_think_tag_action` (新增) |
| — | ✅ `test_parse_markdown_heading_labels` (新增) |
| — | ✅ `test_parse_bold_labels_final_answer` (新增) |
| — | ✅ `test_parse_action_with_extra_explanation` (新增) |

**缺失内容**:
- 完整的 `run_react_agent()` 集成测试
- `execute_react_tool()` 的 mock 测试
- Prompt 构建验证
- 工具注册表验证
- `direct_answer` 工具测试

**建议**: 保留旧测试，增加新的格式解析测试，而不是替换。

---

## 📊 修复进度总结

### P0 问题 (3 个)
- ✅ **[1] 模型选择不穿透工具调用层** — 完全修复
- ❌ **[2] LLM 接口只有单条 user message** — 未修复
- ❌ **[3] 流式响应是伪流式** — 未修复

### P1 问题 (4 个)
- ✅ **[4] 不同模型的 ReAct 输出格式差异** — 部分修复（有新bug）
- ❌ **[5] 无原生 Function Calling 支持** — 未修复
- ❌ **[6] AgnesLLM 无异步实现** — 未修复
- ❌ **[7] Token 计数与上下文窗口管理缺失** — 未修复

### P2 问题 (5 个)
- ❌ **[8] LangGraph 与 ReAct 职责重叠** — 未修复
- ✅ **[9] chat_service model 参数不一致** — 完全修复
- ✅ **[10] ReAct Prompt 工具名硬编码** — 完全修复
- ✅ **[11] AgentResponse 缺少 events/react_steps** — 完全修复
- ❌ **[12] LocalHashEmbedding 非语义向量** — 未修复

### P3 问题 (4 个)
- ❌ **[13] 无错误分类与重试** — 未修复
- ⚠️ **[14] _get_llm() 重复实现** — 部分改善（但新增跨模块引用）
- ❌ **[15] max_tokens 未按场景调整** — 未修复
- ✅ **[16] 前端 ChatMode 与后端不完全对齐** — 完全修复

---

## 🎯 建议下一步行动

### 立即修复（阻塞线上使用）

1. **修复 Markdown 标准化的边界问题** （问题 B）
   - 方案：只在检测到 ReAct 格式时标准化，或改为逐行匹配
   - 优先级：🔴 P0
   - 影响：当前版本会错误解析自然语言输出

2. **解耦 `_get_llm()` 跨模块引用** （问题 A）
   - 方案：移至 `agnes_client.py` 作为公共函数
   - 优先级：🟡 P1
   - 影响：代码质量和可维护性

3. **恢复完整测试覆盖** （问题 C）
   - 方案：保留旧测试 + 新增格式测试
   - 优先级：🟡 P1
   - 影响：回归风险

### 继续优化（下一迭代）

4. **修复 P0-2: AgnesLLM 支持 system/user/assistant 消息分离**
5. **修复 P0-3: 实现真正的流式响应**（`run_react_agent` 改为生成器）

---

## 📝 代码审查评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **功能完整性** | 🟡 **6/10** | 修复了 6 个问题，但引入 2 个新问题 |
| **代码质量** | 🟡 **5/10** | 跨模块引用私有函数，测试覆盖回归 |
| **向后兼容** | 🟢 **9/10** | API 签名变更都是新增可选参数，兼容性好 |
| **测试充分性** | 🔴 **4/10** | 缺失集成测试，边界情况未覆盖 |
| **文档完备性** | 🟢 **8/10** | 类型定义清晰，参数说明完整 |

**总体评价**: 🟡 **6.4/10** — 方向正确，但需要修复新引入的bug和测试回归。

---

## ✅ 验证清单

在部署前请确认：

- [ ] 运行完整测试套件（包括旧测试）
- [ ] 测试边界情况：
  - [ ] 输入包含 `## Action Items` 的自然语言
  - [ ] FINAL_ANSWER 中嵌套 Markdown 标题
  - [ ] 代码块内的 ReAct 标签（应被 fence 剥离）
- [ ] 测试不同模型：
  - [ ] `deepseek-r1` 输出 `<think>` 标签
  - [ ] `claude-sonnet-4` 输出 Markdown 标题
  - [ ] `gpt-5` 输出加粗标签
- [ ] 验证模型选择：
  - [ ] 前端选择 `deepseek-r1`，检查 agent 和 RAG 都使用该模型
  - [ ] 检查日志确认 LLM 调用使用正确模型
- [ ] 检查 `/api/agent/run` 非流式端点返回 `events` 和 `react_steps`
- [ ] 前端 `ReActTrace` 组件能正确展开推理过程
