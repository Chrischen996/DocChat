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
  // Optional additional fields from providers
  task_id?: string;
  status?: 'completed' | 'processing' | 'failed';
  resolution?: string;
  duration?: number | string;
  ratio?: string;
  framespersecond?: number;
  created_at?: number;
  updated_at?: number;
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
  // When proxied, store both original and proxy URLs
  originalUrl?: string;
  prompt: string;
  imageUrl?: string;
  createdAt: Date;
  resolution: string;
  duration: string;
  aspectRatio: string;
  // Metadata surfaced from provider
  model?: 'fal-ai' | 'doubao';
  seed?: number;
  ratio?: string;
  framesPerSecond?: number;
  taskId?: string;
  status?: 'completed' | 'processing' | 'failed';
}

export interface AppSettings {
  apiKey: string;
  doubaoApiKey: string;
  defaultModel: 'fal-ai' | 'doubao';
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

// Doubao API Types
export interface DoubaoApiResponse {
  video: {
    url: string;
    width: number;
    height: number;
    content_type: string;
  };
  task_id: string;
  status: 'completed' | 'processing' | 'failed';
  prompt: string;
  // passthrough meta
  resolution?: string;
  duration?: number | string;
  ratio?: string;
  framespersecond?: number;
  created_at?: number;
  updated_at?: number;
}

// Doubao 1.5 Pro Chat API Types
export interface DoubaoChat {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface DoubaoTestResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Model Configuration
export interface ModelConfig {
  name: string;
  displayName: string;
  description: string;
  supportedResolutions: string[];
  supportedDurations: string[];
  costPer5Sec: number;
  provider: 'fal-ai' | 'doubao';
}

export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  'fal-ai-pro': {
    name: 'fal-ai-pro',
    displayName: 'Fal.ai Seedance Pro',
    description: 'High-quality 1080p anime video generation',
    supportedResolutions: ['480p', '720p', '1080p'],
    supportedDurations: ['5', '10'],
    costPer5Sec: 0.74,
    provider: 'fal-ai'
  },
  'fal-ai-lite': {
    name: 'fal-ai-lite',
    displayName: 'Fal.ai Seedance Lite',
    description: 'Cost-effective 720p anime video generation',
    supportedResolutions: ['480p', '720p'],
    supportedDurations: ['5', '10'],
    costPer5Sec: 0.18,
    provider: 'fal-ai'
  },
  'doubao-1.5-pro': {
    name: 'doubao-1.5-pro',
    displayName: 'Doubao 1.5 Pro',
    description: 'ByteDance Doubao 1.5 Pro - 50x cheaper than GPT-4 with enhanced multimodal capabilities',
    supportedResolutions: ['480p', '720p', '1080p'],
    supportedDurations: ['5', '10'],
    costPer5Sec: 0.015, // Significantly reduced cost based on ¥0.8/¥2 per million tokens
    provider: 'doubao'
  }
};
