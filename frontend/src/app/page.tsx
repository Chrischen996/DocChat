"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import CenteredComposer from "@/components/CenteredComposer";
import QuerySection from "@/components/QuerySection";
import AnswerDisplay from "@/components/AnswerDisplay";
import SourceList from "@/components/SourceList";
import ImageDisplay from "@/components/ImageDisplay";
import { useUpload } from "@/hooks/useUpload";
import { useQuery } from "@/hooks/useQuery";
import {
  GeneratedAsset,
  MessageItem,
  SourceNode,
  TemplateInfo,
  UploadResponse,
} from "@/types";
import {
  listDocuments,
  listTemplates,
  streamAgent,
} from "@/lib/api";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function UserMessage({ question }: { question: string }) {
  return (
    <div className="message-enter flex justify-end">
      <div className="max-w-[min(85%,40rem)] break-words rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm leading-7 text-[var(--text-primary)] shadow-[0_6px_18px_rgba(44,36,30,0.04)] backdrop-blur-xl">
        {question}
      </div>
    </div>
  );
}

function AssistantMessage({
  content,
  sources,
  anchorPrefix,
}: {
  content: string;
  sources?: SourceNode[];
  anchorPrefix: string;
}) {
  return (
    <div className="message-enter space-y-2">
      <AnswerDisplay
        answer={content}
        loading={false}
        error=""
        sourceAnchorPrefix={anchorPrefix}
      />
      {sources && sources.length > 0 && (
        <SourceList sources={sources} anchorPrefix={anchorPrefix} />
      )}
    </div>
  );
}

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadResponse[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<TemplateInfo | null>(null);
  const [composerText, setComposerText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const upload = useUpload();
  const query = useQuery();

  useEffect(() => {
    listDocuments()
      .then((res) => {
        const docs: UploadResponse[] = res.documents.map((d) => ({
          file_name: d.file_name,
          status: "success",
          message: "",
          chunks_indexed: d.chunks_indexed,
        }));
        setUploadedFiles(docs);
      })
      .catch(() => {});

    listTemplates()
      .then((res) => {
        setTemplates(res.templates);
        setActiveTemplate(res.templates[0] ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, query.streamingAnswer, query.streamingStatus, query.error]);

  async function handlePhotosSelect(files: File[]) {
    for (const file of files) {
      const base64 = await fileToBase64(file);
      setMessages((prev) => [
        ...prev,
        {
          role: "image",
          prompt: file.name,
          image_data: base64,
          format: file.type.split("/")[1] || "png",
        },
      ]);
    }
  }

  async function handleFilesSelect(files: File[]) {
    const results = await upload.uploadMany(files);
    if (results.length > 0) {
      setUploadedFiles((prev) => [...results, ...prev]);
    }
  }

  async function handleAgentSend(input: string) {
    if (!activeTemplate) return;

    const history = messages
      .filter((item): item is Extract<MessageItem, { role: "user" | "assistant" }> =>
        item.role === "user" || item.role === "assistant"
      )
      .map((item) => ({ role: item.role, content: item.content }));

    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "", sources: [] }]);
    setComposerText("");

    try {
      let assistantText = "";
      let assistantSources: SourceNode[] = [];
      let latestAsset: GeneratedAsset | null = null;

      await streamAgent(input, activeTemplate.id, history, (event) => {
        if (event.type === "status") return;

        if (event.type === "sources") {
          assistantSources = event.sources;
        }

        if (event.type === "delta") {
          assistantText += event.text;
        }

        if (event.type === "asset") {
          latestAsset = event.asset;
        }

        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i].role === "assistant") {
              next[i] = {
                role: "assistant",
                content: assistantText,
                sources: assistantSources,
              };
              break;
            }
          }
          return next;
        });
      });

      if (latestAsset) {
        const asset = latestAsset;
        setMessages((prev) => [...prev, { role: "asset", asset }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Agent 执行失败";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${msg}` }]);
    }
  }

  function handleNewChat() {
    setMessages([]);
    query.clearHistory();
  }

  const hasMessages = messages.length > 0;
  const streamingMessage =
    query.status === "loading" && query.pendingQuestion
      ? {
          question: query.pendingQuestion,
          answer: query.streamingAnswer?.answer ?? null,
          sources: query.streamingAnswer?.sources ?? [],
          loadingLabel: query.streamingStatus,
        }
      : null;

  return (
    <div className="page-shell flex bg-[var(--bg-page)] text-[var(--text-primary)]">
      <Sidebar
        onNewChat={handleNewChat}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isOpen={sidebarOpen}
        templates={templates}
        activeTemplateId={activeTemplate?.id ?? null}
        onSelectTemplate={(template) => setActiveTemplate(template)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
          onNewChat={handleNewChat}
          sidebarOpen={sidebarOpen}
        />

        {!hasMessages && !streamingMessage ? (
          <main className="flex min-h-0 flex-1 flex-col justify-center">
            <div className="flex items-center justify-center px-2 py-1 sm:px-4">
              <CenteredComposer
                loading={query.status === "loading"}
                text={composerText}
                onTextChange={setComposerText}
                onSend={(text) => handleAgentSend(text)}
                onStop={() => {}}
                uploadedFiles={uploadedFiles}
                uploadStatus={upload.status}
                onFilesSelect={handleFilesSelect}
                onPhotosSelect={handlePhotosSelect}
              />
            </div>
          </main>
        ) : (
          <main className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-[min(100%,56rem)] flex-col px-2 py-4 sm:px-4 md:px-6 lg:px-8">
                <div className="space-y-8 pb-6">
                  {messages.map((item, index) => (
                    <div key={`msg-${index}`}>
                      {item.role === "user" && <UserMessage question={item.content} />}
                      {item.role === "assistant" && (
                        <AssistantMessage
                          content={item.content}
                          sources={item.sources}
                          anchorPrefix={`msg-${index}`}
                        />
                      )}
                      {item.role === "image" && (
                        <ImageDisplay
                          imageData={item.image_data}
                          format={item.format}
                          prompt={item.prompt}
                        />
                      )}
                      {item.role === "asset" && item.asset.image_data && (
                        <ImageDisplay
                          imageData={item.asset.image_data}
                          format={item.asset.format || "png"}
                          prompt={item.asset.title}
                        />
                      )}
                    </div>
                  ))}

                  {streamingMessage && (
                    <div className="space-y-8">
                      <UserMessage question={streamingMessage.question} />
                      {streamingMessage.answer ? (
                        <AssistantMessage
                          content={streamingMessage.answer}
                          sources={streamingMessage.sources}
                          anchorPrefix="streaming"
                        />
                      ) : (
                        <div className="message-enter">
                          <div className="flex items-center gap-1 py-1 text-[var(--text-tertiary)]">
                            <span className="streaming-dot inline-block h-2 w-2 rounded-full bg-current" />
                            <span className="streaming-dot inline-block h-2 w-2 rounded-full bg-current" />
                            <span className="streaming-dot inline-block h-2 w-2 rounded-full bg-current" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {query.status === "error" && query.failedQuestion && (
                    <div className="space-y-4">
                      <UserMessage question={query.failedQuestion} />
                      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {query.error}
                      </div>
                    </div>
                  )}
                </div>

                <div ref={bottomRef} />
              </div>
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--bg-page)]">
              <QuerySection
                loading={query.status === "loading"}
                onSend={(text) => handleAgentSend(text)}
                onStop={() => {}}
                uploadedFiles={uploadedFiles}
                uploadStatus={upload.status}
                onFilesSelect={handleFilesSelect}
                onPhotosSelect={handlePhotosSelect}
                text={composerText}
                onTextChange={setComposerText}
              />
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
