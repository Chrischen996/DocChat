// Doubao API Client for ByteDance's Doubao 1.5 Pro model
import { DoubaoApiResponse, VideoGenerationRequest } from '@/types';

export class DoubaoClient {
  private apiKey: string;
  private baseUrl: string;
  private chatCompletionsUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Updated to use the latest Doubao 1.5 Pro API endpoints
    this.baseUrl = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
    this.chatCompletionsUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  }

  async generateTextToVideo(request: {
    prompt: string;
    resolution?: string;
    duration?: string;
    aspect_ratio?: string;
  }): Promise<DoubaoApiResponse> {
    // 创建视频生成任务
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'doubao-seedance-1-0-lite-i2v-250428',
        content: [
          {
            type: 'text',
            text: `${request.prompt} --resolution ${request.resolution || '720p'} --duration ${request.duration || '5'} --camerafixed false --watermark true`
          }
        ]
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    // 如果任务创建成功，轮询任务状态直到完成
    if (result.id) {
      return await this.pollTaskCompletion(result.id, request.prompt);
    }
    
    return this.convertToStandardResponse(result, request.prompt);
  }

  async generateImageToVideo(request: {
    prompt: string;
    image_url: string;
    resolution?: string;
    duration?: string;
  }): Promise<DoubaoApiResponse> {
    // 创建图像转视频任务
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'doubao-seedance-1-0-lite-i2v-250428',
        content: [
          {
            type: 'text',
            text: `${request.prompt} --resolution ${request.resolution || '720p'} --duration ${request.duration || '5'} --camerafixed false --watermark true`
          },
          {
            type: 'image_url',
            image_url: {
              url: request.image_url
            }
          }
        ]
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    // 如果任务创建成功，轮询任务状态直到完成
    if (result.id) {
      return await this.pollTaskCompletion(result.id, request.prompt);
    }
    
    return this.convertToStandardResponse(result, request.prompt);
  }

  async getTaskStatus(taskId: string): Promise<DoubaoApiResponse> {
    const response = await fetch(`${this.baseUrl}/${taskId}`, {
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

    const result = await response.json();
    return this.convertToStandardResponse(result, '');
  }

  // New method to test chat completions API (Doubao 1.5 Pro feature)
  async testChatCompletion(message: string = "Hello"): Promise<any> {
    try {
      const response = await fetch(this.chatCompletionsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'doubao-1.5-pro-32k', // Use Doubao 1.5 Pro 32k context model
          messages: [
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 0.9
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Test with the new chat completions API for better validation
      const response = await this.testChatCompletion("test");
      return response && response.choices && response.choices.length > 0;
    } catch (error) {
      // Fallback to video generation API test
      try {
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'doubao-1.5-pro-seedance',
            content: [
              {
                type: 'text',
                text: 'test --resolution 480p --duration 1 --camerafixed false --watermark true'
              }
            ]
          }),
        });

        return response.ok;
      } catch (fallbackError) {
        return false;
      }
    }
  }

  private convertToStandardResponse(doubaoResponse: any, prompt: string): DoubaoApiResponse {
    // Convert Doubao API response to our standard format
    return {
      video: {
        url: doubaoResponse.data?.video_url || doubaoResponse.video_url || '',
        width: doubaoResponse.data?.width || 1280,
        height: doubaoResponse.data?.height || 720,
        content_type: 'video/mp4'
      },
      task_id: doubaoResponse.task_id || doubaoResponse.id || `doubao_${Date.now()}`,
      status: this.mapStatus(doubaoResponse.status || doubaoResponse.state),
      prompt: prompt
    };
  }

  private mapStatus(doubaoStatus: string): 'completed' | 'processing' | 'failed' {
    switch (doubaoStatus?.toLowerCase()) {
      case 'success':
      case 'completed':
      case 'done':
        return 'completed';
      case 'processing':
      case 'running':
      case 'pending':
        return 'processing';
      case 'failed':
      case 'error':
        return 'failed';
      default:
        return 'processing';
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
