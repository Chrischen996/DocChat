"use client";

import { useEffect, useRef, useState } from "react";
import { AgentStepItem } from "@/types";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import QuerySection from "@/components/QuerySection";
import AnswerDisplay from "@/components/AnswerDisplay";
import { useUpload } from "@/hooks/useUpload";
import {
  AssistantTurn,
  ChatMessage,
  ChatMode,
  ConversationTurn,
  GeneratedAsset,
  SourceNode,
  StreamEvent,
  TemplateInfo,
  UploadResponse,
  UserTurn,
} from "@/types";
import { listTemplates, streamAgent } from "@/lib/api";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function normalizeSource(source: SourceNode, index: number): SourceNode {
  return {
    ...source,
    source_id: source.source_id ?? `source-${index + 1}`,
    text: source.text ?? "",
  };
}

const TOOL_LABEL: Record<string, string> = {
  document_search: "📄 搜索文档",
  document_deep_search: "🔍 深度搜索",
  image_generate: "🎨 生成图片",
  direct_answer: "💬 直接回答",
  retriever: "📦 检索器",
  asset: "🗂 资产",
  router: "🔀 路由分析",
  llm: "✍️ 生成回答",
  assistant: "💬 助手回答",
  image: "🎨 图片生成",
};

const STEP_CONFIG: Record<string, { icon: string; label: string }> = {
  router: { icon: "🔀", label: "路由分析" },
  retriever: { icon: "📄", label: "文档检索" },
  document_search: { icon: "📄", label: "搜索文档" },
  document_deep_search: { icon: "🔍", label: "深度搜索" },
  web_search: { icon: "🌐", label: "网页搜索" },
  python: { icon: "🐍", label: "运行 Python" },
  sql: { icon: "🧮", label: "查询数据库" },
  browser: { icon: "🧭", label: "浏览网页" },
  image_generate: { icon: "🎨", label: "生成图片" },
  asset: { icon: "🗂", label: "生成资产" },
  llm: { icon: "✍️", label: "生成回答" },
  assistant: { icon: "💬", label: "助手回答" },
};

function formatDuration(ms?: number) {
  if (ms === undefined || ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

/** Map raw English status messages from the backend to friendly Chinese */
function localizeStatus(raw: string): string {
  const map: Record<string, string> = {
    "Starting agent run":              "🤔 Agent 启动中...",
    "Starting native tool-calling agent": "🤔 工具调用 Agent 启动...",
    "Streaming final answer":          "📝 正在输出回答...",
    "Routing to agent workflow":       "🔀 路由到 Agent...",
    "Routing to rag workflow":         "🔀 路由到文档检索...",
    "Routing to assistant workflow":   "🔀 路由到助手模式...",
    "Routing to image workflow":       "🔀 路由到图片生成...",
  };
  // Exact match first
  if (map[raw]) return map[raw];
  // Prefix patterns
  if (raw.startsWith("Routing to")) return `🔀 ${raw.replace("Routing to", "路由到")}`;
  if (raw.startsWith("Tool-calling agent completed")) return "✅ Agent 执行完成";
  return raw;
}

function AgentRunPanel({ steps }: { steps: AgentStepItem[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-2 flex items-center gap-2 font-medium text-[var(--text-primary)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)] thinking-bounce" />
        Agent 正在处理
      </div>
      <div className="space-y-1.5">
        {steps.map((step) => {
          const key = step.tool || step.node_type;
          const config = STEP_CONFIG[key] ?? STEP_CONFIG[step.node_type];
          const icon = config?.icon ?? "⚙️";
          const label = step.label || config?.label || key || "执行步骤";
          const isRunning = step.status === "running";
          const isError = step.status === "error";
          return (
            <div key={step.id} className="flex items-center gap-2 text-[var(--text-secondary)]">
              <span className="w-4 text-center">{isError ? "✕" : isRunning ? "●" : "✓"}</span>
              <span className="w-5 text-center">{icon}</span>
              <span className="min-w-0 flex-1 truncate">{label}{isRunning ? "中..." : ""}</span>
              <span className="shrink-0 tabular-nums text-[var(--text-tertiary)]">
                {isRunning ? "运行中" : formatDuration(step.duration_ms)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ElapsedTimer({ active }: { active: boolean }) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!active || secs === 0) return null;
  return (
    <span className="ml-1 tabular-nums text-[var(--text-tertiary)]">
      {secs}s
    </span>
  );
}

function AssistantMessageView({ turn }: { turn: AssistantTurn }) {
  const isStreaming = turn.status === "streaming";
  const isWaiting = isStreaming && !turn.content;   // no delta yet
  const latestStepText = turn.steps.at(-1)?.text ?? "";
  const activeToolCall = isStreaming
    ? turn.toolCalls.findLast((c) => c.status === "start")
    : null;

  return (
    <div className="message-enter space-y-2">
      {/* 流式推理中：显示当前工具/状态 + 计时器 */}
      {isStreaming && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0"
            style={{ animation: "thinking-bounce 1.2s ease-in-out infinite" }}
          />
          {activeToolCall ? (
            <span>
              正在调用{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {TOOL_LABEL[activeToolCall.tool] ?? activeToolCall.tool}
              </span>
              {typeof activeToolCall.input === "string" && activeToolCall.input
                ? `：${activeToolCall.input.slice(0, 60)}${activeToolCall.input.length > 60 ? "…" : ""}`
                : ""}
            </span>
          ) : (
            <span>{localizeStatus(latestStepText) || "思考中..."}</span>
          )}
          <ElapsedTimer key={`${turn.id}-${isWaiting}`} active={isWaiting} />
        </div>
      )}

      {/* 仅运行中展示 Agent Chat 步骤；完成后隐藏过程，只保留最终答案 */}
      {isStreaming && <AgentRunPanel steps={turn.agentSteps} />}

      {/* 最终答案（流式时显示打字光标） */}
      <AnswerDisplay
        answer={turn.content}
        loading={isWaiting}
        error=""
        sourceAnchorPrefix={turn.id}
        isStreaming={isStreaming && !!turn.content}
      />
    </div>
  );
}

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadResponse[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<TemplateInfo | null>(null);
  const [mode, setMode] = useState<ChatMode>("auto");
  const [model, setModel] = useState("agnes-default");
  const [composerText, setComposerText] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState("");
  const [streamingAsset, setStreamingAsset] = useState<GeneratedAsset | null>(null);
  const hasConversation = turns.length > 0;
  const bottomRef = useRef<HTMLDivElement>(null);
  const upload = useUpload();

  useEffect(() => {
    listTemplates()
      .then((res) => {
        setTemplates(res.templates);
        setActiveTemplate(res.templates[0] ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns, streamError, streamingAsset]);

  function buildHistory(untilTurnId?: string | null) {
    const items: ChatMessage[] = [];
    for (const turn of turns) {
      if (untilTurnId && turn.id === untilTurnId) break;
      if (turn.role === "user") items.push({ role: "user", content: turn.content });
      if (turn.role === "assistant") items.push({ role: "assistant", content: turn.content });
    }
    return items;
  }

  async function handleFilesSelect(files: File[]) {
    const results = await upload.uploadMany(files);
    if (results.length > 0) {
      setUploadedFiles((prev) => [...results, ...prev]);
    }
  }

  async function handlePhotosSelect(files: File[]) {
    for (const file of files) {
      await fileToBase64(file);
    }
  }

  function updateStreamingAssistant(
    turnId: string,
    updater: (turn: AssistantTurn) => AssistantTurn
  ) {
    setTurns((prev) =>
      prev.map((turn) => {
        if (turn.role !== "assistant" || turn.id !== turnId) return turn;
        return updater(turn);
      })
    );
  }

  async function handleSend(input: string, branchFromTurnId?: string | null) {
    if (isSending) return;
    const normalized = input.trim();
    if (!normalized) return;

    const userTurnId = crypto.randomUUID();
    const assistantTurnId = crypto.randomUUID();
    const history = buildHistory(branchFromTurnId ?? currentTurnId);

    setIsSending(true);
    setStreamError("");
    setStreamingAsset(null);
    setCurrentTurnId(assistantTurnId);

    const userTurn: UserTurn = {
      id: userTurnId,
      role: "user",
      content: normalized,
      mode,
      parentId: branchFromTurnId ?? currentTurnId,
    };

      const assistantTurn: AssistantTurn = {
      id: assistantTurnId,
      role: "assistant",
        content: "",
        sources: [],
        agentSteps: [],
        steps: [],
        toolCalls: [],
      mode,
      parentId: userTurnId,
      status: "streaming",
    };

    setTurns((prev) => [...prev, userTurn, assistantTurn]);
    setComposerText("");

    let buffer = "";
    let sources: SourceNode[] = [];
    let agentSteps: AgentStepItem[] = [];
    let steps: { id: string; kind: "status" | "thinking"; text: string; ts: number }[] = [];
    let toolCalls: {
      id: string;
      tool: string;
      input?: unknown;
      output?: unknown;
      status: "start" | "result";
      ts: number;
    }[] = [];

    function upsertAgentStep(step: AgentStepItem) {
      const index = agentSteps.findIndex((item) => item.node_id === step.node_id);
      if (index >= 0) {
        agentSteps = agentSteps.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...step, id: item.id } : item
        );
      } else {
        agentSteps = [...agentSteps, step];
      }
      updateStreamingAssistant(assistantTurnId, (turn) => ({ ...turn, agentSteps: [...agentSteps] }));
    }

    try {
      await streamAgent(
        normalized,
        mode,
        activeTemplate?.id ?? null,
        model,
        history,
        (event: StreamEvent) => {
          if (event.type === "node_start") {
            upsertAgentStep({
              id: event.node_id,
              node_id: event.node_id,
              node_type: event.node_type,
              label: event.label,
              status: "running",
              started_at: event.started_at,
              input: event.input,
              tool: event.tool,
              meta: event.meta,
            });
            return;
          }

          if (event.type === "node_end") {
            upsertAgentStep({
              id: event.node_id,
              node_id: event.node_id,
              node_type: event.node_type ?? "node",
              label: event.label ?? "执行步骤",
              status: event.status,
              started_at: event.started_at ?? Date.now(),
              ended_at: event.ended_at,
              duration_ms: event.duration_ms,
              output: event.output,
              tool: event.tool,
              meta: event.meta,
            });
            return;
          }

          if (event.type === "status") {
            steps = [...steps, { id: crypto.randomUUID(), kind: "status", text: event.message, ts: Date.now() }];
            if (event.node_id) {
              upsertAgentStep({
                id: event.node_id,
                node_id: event.node_id,
                node_type: event.node_type ?? "status",
                label: event.label ?? localizeStatus(event.message),
                status: event.status ?? "running",
                started_at: event.started_at ?? Date.now(),
                duration_ms: event.duration_ms,
                input: event.input,
                output: event.output,
              });
            }
            updateStreamingAssistant(assistantTurnId, (turn) => ({
              ...turn,
              steps: [...steps],
              status: "streaming",
            }));
            return;
          }

          if (event.type === "thinking") {
            steps = [...steps, { id: crypto.randomUUID(), kind: "thinking", text: event.text, ts: Date.now() }];
            updateStreamingAssistant(assistantTurnId, (turn) => ({ ...turn, steps: [...steps] }));
            return;
          }

          if (event.type === "tool_start") {
            if (event.node_id) {
              upsertAgentStep({
                id: event.node_id,
                node_id: event.node_id,
                node_type: event.node_type ?? "tool",
                label: event.label ?? TOOL_LABEL[event.tool] ?? event.tool,
                status: "running",
                started_at: event.started_at ?? Date.now(),
                input: event.input,
                tool: event.tool,
                meta: event.meta,
              });
            }
            toolCalls = [
              ...toolCalls,
              {
                id: crypto.randomUUID(),
                tool: event.tool,
                input: event.input,
                status: "start",
                ts: Date.now(),
              },
            ];
            updateStreamingAssistant(assistantTurnId, (turn) => ({ ...turn, toolCalls: [...toolCalls] }));
            return;
          }

          if (event.type === "tool_result") {
            if (event.node_id) {
              upsertAgentStep({
                id: event.node_id,
                node_id: event.node_id,
                node_type: event.node_type ?? "tool",
                label: event.label ?? TOOL_LABEL[event.tool] ?? event.tool,
                status: event.status ?? "success",
                started_at: event.started_at ?? Date.now(),
                duration_ms: event.duration_ms,
                output: event.output,
                tool: event.tool,
                meta: event.meta,
              });
            }
            toolCalls = toolCalls.map((item) =>
              item.tool === event.tool && item.status === "start"
                ? { ...item, output: event.output, status: "result" as const }
                : item
            );
            updateStreamingAssistant(assistantTurnId, (turn) => ({ ...turn, toolCalls: [...toolCalls] }));
            return;
          }

          if (event.type === "sources") {
            sources = event.sources.map(normalizeSource);
            updateStreamingAssistant(assistantTurnId, (turn) => ({ ...turn, sources: [...sources] }));
            return;
          }

          if (event.type === "delta") {
            buffer += event.text;
            updateStreamingAssistant(assistantTurnId, (turn) => ({ ...turn, content: buffer }));
            return;
          }

          if (event.type === "asset") {
            setStreamingAsset(event.asset);
            return;
          }

          if (event.type === "error") {
            throw new Error(event.message || "Agent execution failed");
          }
        }
      );

      updateStreamingAssistant(assistantTurnId, (turn) => ({
        ...turn,
        content: buffer,
        sources,
        agentSteps,
        steps,
        toolCalls,
        status: "done",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent execution failed";
      setStreamError(message);
      updateStreamingAssistant(assistantTurnId, (turn) => ({
        ...turn,
        content: `Error: ${message}`,
        status: "error",
      }));
    } finally {
      setIsSending(false);
    }
  }

  function handleNewChat() {
    setTurns([]);
    setComposerText("");
    setIsSending(false);
    setCurrentTurnId(null);
    setStreamError("");
    setStreamingAsset(null);
  }

  return (
    <div className="page-shell flex bg-[var(--bg-page)] text-[var(--text-primary)]">
      <Sidebar
        onNewChat={handleNewChat}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isOpen={sidebarOpen}
        templates={templates}
        activeTemplateId={activeTemplate?.id ?? null}
        onSelectTemplate={(template) => {
          setActiveTemplate(template);
          if (template.workflow_id === "image_generation") setMode("agent");
          else setMode("rag");
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

        <main className="flex min-h-0 flex-1 flex-col">
          {!hasConversation ? (
            <section className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-4xl flex-col px-3 py-4 sm:px-4 lg:px-6">
                {activeTemplate && (
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                      Template: {activeTemplate.name}
                    </span>
                  </div>
                )}

                <div className="flex min-h-[60dvh] items-center justify-center">
                  <div className="w-full">
                    <QuerySection
                      loading={isSending}
                      onSend={(text) => handleSend(text)}
                      onStop={() => {}}
                      uploadedFiles={uploadedFiles}
                      uploadStatus={upload.status}
                      onFilesSelect={handleFilesSelect}
                      onPhotosSelect={handlePhotosSelect}
                      text={composerText}
                      onTextChange={setComposerText}
                      model={model}
                      onModelChange={setModel}
                    />
                  </div>
                </div>

                <div ref={bottomRef} />
              </div>
            </section>
          ) : (
            <>
              <section className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-4xl flex-col px-3 py-4 sm:px-4 lg:px-6 min-h-full">
                  {activeTemplate && (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                        Template: {activeTemplate.name}
                      </span>
                    </div>
                  )}

                  <div className="space-y-5 flex-1">
                    {turns.map((turn) =>
                      turn.role === "user" ? (
                      <div key={turn.id} className="flex justify-end">
                        <div className="max-w-[min(85%,48rem)] rounded-2xl bg-[var(--bg-surface-strong)] px-4 py-3 text-sm leading-7 shadow-[0_6px_18px_rgba(44,36,30,0.04)]">
                          {turn.content}
                        </div>
                      </div>
                      ) : (
                        <AssistantMessageView key={turn.id} turn={turn} />
                      )
                    )}

                    {streamError && (
                      <div className="rounded-2xl border border-red-900/30 bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                        {streamError}
                      </div>
                    )}
                  </div>

                  <div ref={bottomRef} />
                </div>
              </section>

              <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 lg:px-6 pb-2">
                <div className="rounded-[28px]">
                  <QuerySection
                    loading={isSending}
                    onSend={(text) => handleSend(text)}
                    onStop={() => {}}
                    uploadedFiles={uploadedFiles}
                    uploadStatus={upload.status}
                    onFilesSelect={handleFilesSelect}
                    onPhotosSelect={handlePhotosSelect}
                    text={composerText}
                    onTextChange={setComposerText}
                    model={model}
                    onModelChange={setModel}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
