"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ToolCallItem, ThinkingStep } from "@/types";
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
};

function ReActTrace({
  steps,
  toolCalls,
}: {
  steps: ThinkingStep[];
  toolCalls: ToolCallItem[];
}) {
  const [open, setOpen] = useState(false);
  const totalCalls = toolCalls.filter((c) => c.status === "start").length;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--accent-light)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] transition-colors text-left"
      >
        <span className="text-[10px]">{open ? "▼" : "▶"}</span>
        <span className="font-medium">推理过程</span>
        {totalCalls > 0 && (
          <span className="ml-1 rounded-full bg-[var(--accent-soft)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
            {totalCalls} 次工具调用
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 py-2.5 space-y-2 bg-[var(--bg-surface)]">
          {steps.map((step) => (
            <div key={step.id} className="flex gap-2 items-start">
              <span className="mt-0.5 shrink-0 text-[11px]">
                {step.kind === "thinking" ? "💭" : "●"}
              </span>
              <span className="text-[var(--text-secondary)] leading-5 break-words">
                {step.text}
              </span>
            </div>
          ))}

          {toolCalls.map((call) => (
            <div
              key={call.id}
              className="border-l-2 border-[var(--accent)] pl-2.5 space-y-0.5"
            >
              <div className="font-semibold text-[var(--text-primary)]">
                {TOOL_LABEL[call.tool] ?? `🔧 ${call.tool}`}
              </div>
              {call.input !== undefined && call.input !== "" && (
                <div className="text-[var(--text-secondary)] break-words">
                  输入:{" "}
                  {typeof call.input === "string"
                    ? call.input
                    : JSON.stringify(call.input, null, 2)}
                </div>
              )}
              {call.status === "result" && (
                <div className="text-green-600 dark:text-green-400 text-[10px] font-medium">
                  ✓ 已完成
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantMessageView({ turn }: { turn: AssistantTurn }) {
  const isStreaming = turn.status === "streaming";
  const hasTrace =
    !isStreaming && (turn.steps.length > 0 || turn.toolCalls.length > 0);
  const latestStepText = turn.steps.at(-1)?.text ?? "";
  const activeToolCall = isStreaming
    ? turn.toolCalls.findLast((c) => c.status === "start")
    : null;

  return (
    <div className="message-enter space-y-2">
      {/* 流式推理中：显示当前工具/状态 */}
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
            <span>{latestStepText || "Thinking..."}</span>
          )}
        </div>
      )}

      {/* 完成后：可折叠的推理轨迹面板 */}
      {hasTrace && (
        <ReActTrace steps={turn.steps} toolCalls={turn.toolCalls} />
      )}

      {/* 最终答案 */}
      <AnswerDisplay
        answer={turn.content}
        loading={isStreaming && !turn.content}
        error=""
        sourceAnchorPrefix={turn.id}
      />
    </div>
  );
}

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadResponse[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<TemplateInfo | null>(null);
  const [mode, setMode] = useState<ChatMode>("agent");
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

  const lastAssistantTurn = useMemo(
    () => [...turns].reverse().find((turn): turn is AssistantTurn => turn.role === "assistant"),
    [turns]
  );

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
    let steps: { id: string; kind: "status" | "thinking"; text: string; ts: number }[] = [];
    let toolCalls: {
      id: string;
      tool: string;
      input?: unknown;
      output?: unknown;
      status: "start" | "result";
      ts: number;
    }[] = [];

    try {
      await streamAgent(
        normalized,
        mode,
        activeTemplate?.id ?? null,
        model,
        history,
        (event: StreamEvent) => {
          if (event.type === "status") {
            steps = [...steps, { id: crypto.randomUUID(), kind: "status", text: event.message, ts: Date.now() }];
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

  const assistantTurn = lastAssistantTurn;

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
                      mode={mode}
                      onModeChange={setMode}
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
                    mode={mode}
                    onModeChange={setMode}
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
