"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import WelcomeScreen from "@/components/WelcomeScreen";
import QuerySection from "@/components/QuerySection";
import AnswerDisplay from "@/components/AnswerDisplay";
import SourceList from "@/components/SourceList";
import ImageDisplay from "@/components/ImageDisplay";
import { useUpload } from "@/hooks/useUpload";
import { useQuery } from "@/hooks/useQuery";
import {
  AssistantMode,
  MessageItem,
  SourceNode,
  UploadResponse,
} from "@/types";
import { generateImage, listDocuments } from "@/lib/api";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:image/...;base64, prefix
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function UserMessage({
  question,
}: {
  question: string;
}) {
  return (
    <div className="message-enter flex justify-end">
      <div className="max-w-[min(42rem,100%)] break-words text-sm leading-7 text-[var(--text-primary)]">
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const upload = useUpload();
  const query = useQuery();

  // 自动判断模式：有文档时走 RAG，无文档时纯对话
  const activeMode: AssistantMode = uploadedFiles.length > 0 ? "document" : "assistant";

  // 加载已持久化的文档列表
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
  }, []);

  // 消息变化时自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, query.streamingAnswer, query.streamingStatus, query.error]);

  function handleDeleteDocument(fileName: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.file_name !== fileName));
  }

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

      const names = results.map((file) => file.file_name).join("、");
      const summaryPrompt =
        results.length === 1
          ? `请总结刚上传的文档《${names}》，包括核心内容、关键结论和可继续追问的问题。`
          : `请综合总结刚上传的 ${results.length} 个文档：${names}。请分别概括每个文档的核心内容，再给出整体结论和可继续追问的问题。`;

      await handleQuery(summaryPrompt, "document");
    }
  }

  async function handleImageGeneration(prompt: string) {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt, mode: "image" },
    ]);
    query.setPendingQuestion(prompt);

    try {
      const result = await generateImage(prompt);
      setMessages((prev) => [
        ...prev,
        {
          role: "image",
          prompt,
          image_data: result.image_data,
          format: result.format,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "文生图失败";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${msg}` },
      ]);
    } finally {
      query.setPendingQuestion("");
    }
  }

  async function handleQuery(question: string, activeMode: AssistantMode) {
    if (activeMode === "image") {
      await handleImageGeneration(question);
      return;
    }

    const result = await query.ask(question, activeMode);

    if (result) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question, mode: activeMode },
        {
          role: "assistant",
          content: result.answer,
          sources: result.sources,
        },
      ]);
    }
  }

  function handleNewChat() {
    setMessages([]);
    query.clearHistory();
  }

  function handleSuggestionClick(text: string) {
    handleQuery(text, activeMode);
  }

  const hasMessages = messages.length > 0;

  // 流式消息状态
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
    <div className="flex h-screen min-h-0 bg-[var(--bg-page)]">
      {/* Sidebar */}
      <Sidebar
        onNewChat={handleNewChat}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isOpen={sidebarOpen}
      />

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Chat area */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto min-w-0 max-w-3xl px-4 py-6 sm:px-6">
              {/* Welcome screen (empty state) */}
              {!hasMessages && !streamingMessage && (
                <div className="flex min-h-[70vh] items-center justify-center">
                  <WelcomeScreen
                    hasDocs={uploadedFiles.length > 0}
                    onSuggestionClick={handleSuggestionClick}
                  />
                </div>
              )}

              {/* Messages */}
              {hasMessages && (
                <div className="space-y-8 pb-2">
                  {messages.map((item, index) => (
                    <div key={`msg-${index}`}>
                      {item.role === "user" && (
                        <UserMessage question={item.content} />
                      )}
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
                    </div>
                  ))}
                </div>
              )}

              {/* Streaming message */}
              {streamingMessage && (
                <div className="space-y-8 pb-2">
                  {/* Show user question */}
                  {!hasMessages && (
                    <div className="flex min-h-[70vh] items-center justify-center">
                      <div className="w-full max-w-3xl space-y-6">
                        <UserMessage
                          question={streamingMessage.question}
                        />
                        {streamingMessage.answer ? (
                          <AssistantMessage
                            content={streamingMessage.answer}
                            sources={streamingMessage.sources}
                            anchorPrefix="streaming"
                          />
                        ) : (
                          <div className="message-enter">
                            <div className="flex items-center gap-1 py-1">
                              <span className="streaming-dot inline-block h-2 w-2 rounded-full bg-[var(--text-tertiary)]" />
                              <span className="streaming-dot inline-block h-2 w-2 rounded-full bg-[var(--text-tertiary)]" />
                              <span className="streaming-dot inline-block h-2 w-2 rounded-full bg-[var(--text-tertiary)]" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Streaming when messages already exist */}
                  {hasMessages && (
                    <>
                      <UserMessage
                        question={streamingMessage.question}
                      />
                      {streamingMessage.answer ? (
                        <AssistantMessage
                          content={streamingMessage.answer}
                          sources={streamingMessage.sources}
                          anchorPrefix="streaming"
                        />
                      ) : (
                        <div className="message-enter">
                          <div className="flex items-center gap-1 py-1">
                            <span className="streaming-dot inline-block h-2 w-2 rounded-full bg-[var(--text-tertiary)]" />
                            <span className="streaming-dot inline-block h-2 w-2 rounded-full bg-[var(--text-tertiary)]" />
                            <span className="streaming-dot inline-block h-2 w-2 rounded-full bg-[var(--text-tertiary)]" />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Error message */}
              {query.status === "error" && query.failedQuestion && (
                <div className="space-y-8 pb-2">
                  {!hasMessages && !streamingMessage && (
                    <div className="flex min-h-[70vh] items-center justify-center">
                      <div className="w-full max-w-3xl">
                        <UserMessage question={query.failedQuestion} />
                        <div className="mt-4">
                          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {query.error}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {hasMessages && (
                    <>
                      <UserMessage question={query.failedQuestion} />
                      <div>
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {query.error}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="shrink-0">
            <QuerySection
              loading={query.status === "loading"}
              onSend={(text) => handleQuery(text, activeMode)}
              onStop={() => {}}
              uploadedFiles={uploadedFiles}
              uploadStatus={upload.status}
              uploadCurrentFileName={upload.currentFileName}
              uploadCompletedCount={upload.completedCount}
              uploadTotalCount={upload.totalCount}
              onFilesSelect={handleFilesSelect}
              onDeleteDocument={handleDeleteDocument}
              onPhotosSelect={handlePhotosSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
