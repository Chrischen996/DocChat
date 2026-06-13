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
  text: string;
  score: number | null;
  file_name: string | null;
}

export interface QueryResponse {
  answer: string;
  sources: SourceNode[];
}

export type AssistantMode = "assistant" | "document" | "image";

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
  history?: ChatMessage[];
}

export interface AgentResponse {
  answer: string;
  sources: SourceNode[];
  asset: GeneratedAsset | null;
  mode: AssistantMode | string;
  total_ms: number;
}

export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "sources"; sources: SourceNode[]; retrieval_ms?: number }
  | { type: "delta"; text: string }
  | { type: "asset"; asset: GeneratedAsset }
  | { type: "done"; total_ms?: number }
  | { type: "error"; message: string };

export type MessageItem =
  | { role: "user"; content: string; mode?: AssistantMode }
  | { role: "assistant"; content: string; sources?: SourceNode[] }
  | { role: "image"; prompt: string; image_data: string; format: string }
  | { role: "asset"; asset: GeneratedAsset };
