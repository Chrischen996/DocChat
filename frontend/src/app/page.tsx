"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function AssistantMessageView({ turn }: { turn: AssistantTurn }) {
  return (
    <div className="message-enter">
      <AnswerDisplay
        answer={turn.content}
        loading={turn.status === "streaming"}
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
