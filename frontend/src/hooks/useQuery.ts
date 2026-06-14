"use client";

import { useState } from "react";
import { streamAgent } from "@/lib/api";
import { ChatMode, ChatMessage, StreamEvent } from "@/types";

type QueryStatus = "idle" | "loading" | "success" | "error";

export interface QARecord {
  question: string;
  answer: string;
  mode: ChatMode;
}

export function useQuery() {
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [history, setHistory] = useState<QARecord[]>([]);
  const [streamingAnswer, setStreamingAnswer] = useState<string>("");
  const [streamingStatus, setStreamingStatus] = useState<string>("");

  async function ask(question: string, mode: ChatMode = "agent") {
    setStatus("loading");
    setStreamingAnswer("");
    setStreamingStatus("");

    const recentHistory: ChatMessage[] = history.flatMap((item) => [
      { role: "user", content: item.question },
      { role: "assistant", content: item.answer },
    ]);

    let answer = "";

    try {
      await streamAgent(question, mode, null, null, recentHistory, (event: StreamEvent) => {
        if (event.type === "status") {
          setStreamingStatus(event.message);
          return;
        }

        if (event.type === "thinking") {
          setStreamingStatus(event.text);
          return;
        }

        if (event.type === "delta") {
          answer += event.text;
          setStreamingAnswer(answer);
        }
      });

      setHistory((prev) => [...prev, { question, answer, mode }]);
      setStatus("success");
      setStreamingStatus("");
      return { answer };
    } catch (error) {
      setStatus("error");
      setStreamingStatus(error instanceof Error ? error.message : "Request failed");
      return null;
    }
  }

  function clearHistory() {
    setHistory([]);
    setStreamingAnswer("");
    setStreamingStatus("");
    setStatus("idle");
  }

  return {
    status,
    history,
    streamingAnswer,
    streamingStatus,
    ask,
    clearHistory,
  };
}
