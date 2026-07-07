export interface UploadResponse {
  file_name: string;
  status: string;
  message: string;
  chunks_indexed: number;
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  default_prompt: string;
  workflow_id: string;
}

export interface TemplateListResponse {
  templates: TemplateInfo[];
  total: number;
}

export interface SourceNode {
  source_id?: string | null;
  text: string;
  score: number | null;
  file_name: string | null;
  document_title?: string | null;
  chunk_index?: number | null;
  page_number?: number | null;
  file_path?: string | null;
}

export interface QueryResponse {
  answer: string;
  sources: SourceNode[];
}

export type ChatMode = "rag" | "agent" | "deep_research" | "image" | "assistant";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  answer: string;
}

export interface QueryRequest {
  question: string;
  collection_name?: string;
  history?: ChatMessage[];
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  model?: string | null;
}

export interface DocumentInfo {
  file_name: string;
  upload_time: string;
  chunks_indexed: number;
}

export interface DocumentListResponse {
  documents: DocumentInfo[];
  total: number;
}

export interface ImageGenerateResponse {
  image_data: string;
  format: string;
}

export interface GeneratedAsset {
  id: string;
  asset_type: string;
  title: string;
  content: string;
  image_data: string;
  format: string;
  source_template_id: string | null;
  source_question: string | null;
}

export interface AgentRequest {
  input: string;
  template_id?: string | null;
  mode?: ChatMode;
  model?: string | null;
  history?: ChatMessage[];
}

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  description?: string;
}

export interface AgentResponse {
  answer: string;
  sources: SourceNode[];
  asset: GeneratedAsset | null;
  mode: ChatMode | string;
  model?: string | null;
  total_ms: number;
  events?: TraceStep[];
  react_steps?: unknown[];
}

export type TraceStep =
  | { type: "status"; message: string; mode?: string }
  | { type: "thinking"; text: string; mode?: string }
  | { type: "tool_start"; tool: string; input?: unknown; mode?: string }
  | { type: "tool_result"; tool: string; output?: unknown; mode?: string }
  | { type: "sources"; sources: SourceNode[]; retrieval_ms?: number; mode?: string }
  | { type: "delta"; text: string }
  | { type: "asset"; asset: GeneratedAsset }
  | { type: "done"; total_ms?: number }
  | { type: "error"; message: string };

export type StreamEvent = TraceStep;

export interface ToolCallItem {
  id: string;
  tool: string;
  input?: unknown;
  output?: unknown;
  status: "start" | "result";
  ts: number;
}

export interface ThinkingStep {
  id: string;
  kind: "status" | "thinking";
  text: string;
  ts: number;
}

export interface AssistantTurn {
  id: string;
  role: "assistant";
  content: string;
  sources: SourceNode[];
  steps: ThinkingStep[];
  toolCalls: ToolCallItem[];
  feedback?: -1 | 1;
  feedbackTag?: string;
  parentId?: string | null;
  mode: ChatMode;
  status?: "streaming" | "done" | "error";
}

export interface UserTurn {
  id: string;
  role: "user";
  content: string;
  mode: ChatMode;
  parentId?: string | null;
}

export type ConversationTurn = UserTurn | AssistantTurn;

export interface FeedbackRequest {
  message_id: string;
  rating: -1 | 1;
  tag?: string | null;
  comment?: string | null;
  mode?: string | null;
  source_ids?: string[];
}

export interface FeedbackResponse {
  status: string;
  total: number;
}
