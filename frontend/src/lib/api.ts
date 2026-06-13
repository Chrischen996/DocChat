import { ChatMessage, ChatResponse, DocumentListResponse, QueryResponse, UploadResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "sources"; sources: QueryResponse["sources"]; retrieval_ms?: number }
  | { type: "delta"; text: string }
  | { type: "done"; retrieval_ms?: number; generation_ms?: number; total_ms?: number }
  | { type: "error"; message: string };

async function streamNdjson(
  url: string,
  body: unknown,
  onEvent: (event: StreamEvent) => void
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(err.detail || "请求失败");
  }

  if (!res.body) {
    throw new Error("当前浏览器不支持流式响应");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      onEvent(JSON.parse(trimmed) as StreamEvent);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    onEvent(JSON.parse(buffer.trim()) as StreamEvent);
  }
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "上传失败" }));
    throw new Error(err.detail || "上传失败");
  }

  return res.json();
}

export async function queryDocuments(
  question: string,
  collectionName?: string,
  history: ChatMessage[] = []
): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      collection_name: collectionName,
      history,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "查询失败" }));
    throw new Error(err.detail || "查询失败");
  }

  return res.json();
}

export async function chatWithAssistant(
  message: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "聊天失败" }));
    throw new Error(err.detail || "聊天失败");
  }

  return res.json();
}

export async function streamChatWithAssistant(
  message: string,
  history: ChatMessage[],
  onEvent: (event: StreamEvent) => void
) {
  await streamNdjson(`${API_BASE}/api/chat/stream`, { message, history }, onEvent);
}

export async function streamQueryDocuments(
  question: string,
  history: ChatMessage[],
  onEvent: (event: StreamEvent) => void,
  collectionName?: string
) {
  await streamNdjson(
    `${API_BASE}/api/query/stream`,
    {
      question,
      collection_name: collectionName,
      history,
    },
    onEvent
  );
}

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}

export async function generateImage(
  prompt: string
): Promise<{ image_data: string; format: string }> {
  const res = await fetch(`${API_BASE}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "文生图请求失败" }));
    throw new Error(err.detail || "文生图请求失败");
  }

  return res.json();
}

export async function listDocuments(): Promise<DocumentListResponse> {
  const res = await fetch(`${API_BASE}/api/documents`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "获取文档列表失败" }));
    throw new Error(err.detail || "获取文档列表失败");
  }

  return res.json();
}

export async function deleteDocument(fileName: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(fileName)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "删除文档失败" }));
    throw new Error(err.detail || "删除文档失败");
  }
}
