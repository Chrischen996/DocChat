import {
  AgentRequest,
  AgentResponse,
  ChatMessage,
  ChatMode,
  ChatResponse,
  DocumentListResponse,
  FeedbackRequest,
  FeedbackResponse,
  QueryResponse,
  StreamEvent,
  TemplateListResponse,
  UploadResponse,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function parseError(res: Response, fallback: string) {
  const err = await res.json().catch(() => ({ detail: fallback }));
  return err.detail || fallback;
}

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
    throw new Error(await parseError(res, "Request failed"));
  }

  if (!res.body) {
    throw new Error("Streaming is not supported in this browser");
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
    throw new Error(await parseError(res, "Upload failed"));
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
    throw new Error(await parseError(res, "Query failed"));
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
    throw new Error(await parseError(res, "Chat failed"));
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

export async function streamAgent(
  input: string,
  mode: ChatMode,
  templateId: string | null,
  model: string | null,
  history: ChatMessage[],
  onEvent: (event: StreamEvent) => void
) {
  await streamNdjson(
    `${API_BASE}/api/agent/stream`,
    { input, mode, model, template_id: templateId, history } satisfies AgentRequest,
    onEvent
  );
}

export async function runAgent(
  input: string,
  mode: ChatMode,
  templateId?: string | null,
  model?: string | null,
  history: ChatMessage[] = []
): Promise<AgentResponse> {
  const res = await fetch(`${API_BASE}/api/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, mode, model, template_id: templateId, history } satisfies AgentRequest),
  });

  if (!res.ok) {
    throw new Error(await parseError(res, "Agent run failed"));
  }

  return res.json();
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
    throw new Error(await parseError(res, "Image generation failed"));
  }

  return res.json();
}

export async function listDocuments(): Promise<DocumentListResponse> {
  const res = await fetch(`${API_BASE}/api/documents`);

  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to load documents"));
  }

  return res.json();
}

export async function listTemplates(): Promise<TemplateListResponse> {
  const res = await fetch(`${API_BASE}/api/templates`);

  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to load templates"));
  }

  return res.json();
}

export async function deleteDocument(fileName: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(fileName)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(await parseError(res, "Delete failed"));
  }
}

export async function sendFeedback(payload: FeedbackRequest): Promise<FeedbackResponse> {
  const res = await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res, "Feedback failed"));
  }

  return res.json();
}
