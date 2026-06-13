"use client";

import { useState } from "react";
import { streamChatWithAssistant, streamQueryDocuments } from "@/lib/api";
import { AssistantMode, ChatMessage, QueryResponse } from "@/types";

type QueryStatus = "idle" | "loading" | "success" | "error";

export interface QARecord {
  question: string;
  response: QueryResponse;
  mode: AssistantMode;
}

function buildRecentHistory(
  history: QARecord[],
  mode: AssistantMode
): ChatMessage[] {
  const chatHistory: ChatMessage[] = history.flatMap((item) => [
    { role: "user", content: item.question },
    {
      role: "assistant",
      content:
        mode === "document"
          ? item.response.answer.slice(0, 500)
          : item.response.answer,
    },
  ]);

  return mode === "document" ? chatHistory.slice(-4) : chatHistory.slice(-12);
}

export function useQuery() {
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [data, setData] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [history, setHistory] = useState<QARecord[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string>("");
  const [failedQuestion, setFailedQuestion] = useState<string>("");
  const [streamingAnswer, setStreamingAnswer] = useState<QueryResponse | null>(
    null
  );
  const [streamingStatus, setStreamingStatus] = useState<string>("");

  async function ask(question: string, mode: AssistantMode = "assistant") {
    setStatus("loading");
    setError("");
    setData(null);
    setFailedQuestion("");
    setPendingQuestion(question);
    setStreamingAnswer({ answer: "", sources: [] });
    setStreamingStatus(mode === "document" ? "正在检索文档片段..." : "正在连接模型...");

    let answer = "";
    let sources: QueryResponse["sources"] = [];
    let streamError = "";

    try {
      const recentHistory = buildRecentHistory(history, mode);
      const onEvent = (event: {
        type: string;
        text?: string;
        sources?: QueryResponse["sources"];
        message?: string;
      }) => {
        if (event.type === "status" && event.message) {
          setStreamingStatus(event.message);
          return;
        }

        if (event.type === "sources" && event.sources) {
          sources = event.sources;
          setStreamingStatus("已找到相关片段，正在生成回答...");
          setStreamingAnswer((prev) => ({
            answer: prev?.answer ?? "",
            sources,
          }));
          return;
        }

        if (event.type === "delta" && event.text) {
          answer += event.text;
          setStreamingStatus("");
          setStreamingAnswer({ answer, sources });
          return;
        }

        if (event.type === "error") {
          streamError = event.message || "请求失败";
        }
      };

      if (mode === "document") {
        await streamQueryDocuments(question, recentHistory, onEvent);
      } else {
        await streamChatWithAssistant(question, recentHistory, onEvent);
      }

      if (streamError) {
        throw new Error(streamError);
      }

      const result = { answer, sources };
      setData(result);
      setStatus("success");
      setPendingQuestion("");
      setStreamingAnswer(null);
      setStreamingStatus("");
      setHistory((prev) => [...prev, { question, response: result, mode }]);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "请求失败";
      setError(msg);
      setFailedQuestion(question);
      setPendingQuestion("");
      setStreamingAnswer(null);
      setStreamingStatus("");
      setStatus("error");
      return null;
    }
  }

  function clearHistory() {
    setData(null);
    setError("");
    setHistory([]);
    setPendingQuestion("");
    setFailedQuestion("");
    setStreamingAnswer(null);
    setStreamingStatus("");
    setStatus("idle");
  }

  return {
    status,
    data,
    error,
    history,
    pendingQuestion,
    failedQuestion,
    streamingAnswer,
    streamingStatus,
    ask,
    clearHistory,
    setPendingQuestion,
  };
}
