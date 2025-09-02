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
  'doubao-pro': {
    name: 'doubao-pro',
    displayName: 'Doubao Pro',
    description: 'ByteDance Doubao high-quality model',
    supportedResolutions: ['480p', '720p', '1080p'],
    supportedDurations: ['5', '10'],
    costPer5Sec: 0.50,
    provider: 'doubao'
  }
};
