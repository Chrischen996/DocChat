export interface UploadResponse {
  file_name: string;
  status: string;
  message: string;
  chunks_indexed: number;
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

export type MessageItem =
  | { role: "user"; content: string; mode?: AssistantMode }
  | { role: "assistant"; content: string; sources?: SourceNode[] }
  | { role: "image"; prompt: string; image_data: string; format: string };
