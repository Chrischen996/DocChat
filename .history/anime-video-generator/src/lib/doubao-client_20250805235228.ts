// Doubao API Client for ByteDance's Doubao model
import { DoubaoApiResponse, VideoGenerationRequest } from '@/types';

export class DoubaoClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Note: Replace with actual Doubao API endpoint when available
    this.baseUrl = 'https://api.doubao.bytedance.com/v1';
  }

  async generateTextToVideo(request: {
    prompt: string;
    resolution?: string;
    duration?: string;
    aspect_ratio?: string;
  }): Promise<DoubaoApiResponse> {
    const response = await fetch(`${this.baseUrl}/text-to-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `${request.prompt}, anime style`,
        resolution: request.resolution || '1080p',
        duration: parseInt(request.duration || '5'),
        aspect_ratio: request.aspect_ratio || '16:9',
        style: 'anime',
        quality: 'high'
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async generateImageToVideo(request: {
    prompt: string;
    image_url: string;
    resolution?: string;
    duration?: string;
  }): Promise<DoubaoApiResponse> {
    const response = await fetch(`${this.baseUrl}/image-to-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `${request.prompt}, anime style`,
        image_url: request.image_url,
        resolution: request.resolution || '1080p',
        duration: parseInt(request.duration || '5'),
        style: 'anime',
        quality: 'high'
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async getTaskStatus(taskId: string): Promise<DoubaoApiResponse> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Mock implementation for development/testing
export class MockDoubaoClient extends DoubaoClient {
  constructor(apiKey: string) {
    super(apiKey);
  }

  async generateTextToVideo(request: any): Promise<DoubaoApiResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      video: {
        url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        width: 1280,
        height: 720,
        content_type: 'video/mp4'
      },
      task_id: `doubao_${Date.now()}`,
      status: 'completed',
      prompt: request.prompt
    };
  }

  async generateImageToVideo(request: any): Promise<DoubaoApiResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      video: {
        url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        width: 1280,
        height: 720,
        content_type: 'video/mp4'
      },
      task_id: `doubao_img_${Date.now()}`,
      status: 'completed',
      prompt: request.prompt
    };
  }

  async validateApiKey(): Promise<boolean> {
    // Mock validation - accept any non-empty key
    return this.apiKey.length > 0;
  }
}
