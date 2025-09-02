// API Types
export interface FalApiResponse {
  video: {
    url: string;
    width: number;
    height: number;
    content_type: string;
  };
  seed: number;
  has_nsfw_concepts: boolean[];
  prompt: string;
}

export interface VideoGenerationRequest {
  prompt: string;
  image_url?: string;
  resolution?: '480p' | '720p' | '1080p';
  duration?: '5' | '10';
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  model?: 'fal-ai' | 'doubao';
}

export interface VideoGenerationResponse {
  success: boolean;
  data?: FalApiResponse;
  error?: string;
}

// App State Types
export interface GeneratedVideo {
  id: string;
  url: string;
  prompt: string;
  imageUrl?: string;
  createdAt: Date;
  resolution: string;
  duration: string;
  aspectRatio: string;
}

export interface AppSettings {
  apiKey: string;
  defaultResolution: '480p' | '720p' | '1080p';
  defaultDuration: '5' | '10';
  defaultAspectRatio: '16:9' | '9:16' | '1:1';
  saveDirectory: string;
}

// UI State Types
export interface GenerationState {
  isGenerating: boolean;
  progress: number;
  currentVideo: GeneratedVideo | null;
  error: string | null;
}

export type GenerationType = 'text-to-video' | 'image-to-video';
