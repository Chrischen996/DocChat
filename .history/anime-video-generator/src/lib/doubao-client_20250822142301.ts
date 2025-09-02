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
    camera_fixed?: boolean;
    watermark?: boolean;
  }): Promise<DoubaoApiResponse> {
    // 创建视频生成任务 - 使用正确的模型名称和参数格式
    const textContent = request.prompt;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'doubao-seedance-1-0-lite-t2v-250428', // 使用正确的模型名称
        content: [
          {
            type: 'text',
            text: `${textContent} --resolution 1080p  --duration 5 --camerafixed false --watermark true`
          }
        ],
        resolution: request.resolution || '720p',
        duration: request.duration || '5',
        camera_fixed: request.camera_fixed !== undefined ? request.camera_fixed : false,
        watermark: request.watermark !== undefined ? request.watermark : true
      }),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: 'Unknown error' };
      }
      
      // Handle specific Doubao API error formats
      if (errorData.error?.code === 'AccountOverdueError') {
        throw new Error(`Account overdue: ${errorData.error.message}`);
      }
      
      throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
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
    aspect_ratio?: string;
    camera_fixed?: boolean;
    watermark?: boolean;
  }): Promise<DoubaoApiResponse> {
    // 创建图像转视频任务 - 使用正确的模型名称和参数格式
    const textContent = request.prompt;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'doubao-seedance-1-0-lite-t2v-250428', // 使用正确的模型名称
        content: [
          {
            type: 'text',
            text: textContent
          }
        ],
        resolution: request.resolution || '720p',
        duration: request.duration || '5',
        camera_fixed: request.camera_fixed !== undefined ? request.camera_fixed : false,
        watermark: request.watermark !== undefined ? request.watermark : true
      }),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: 'Unknown error' };
      }
      
      // Handle specific Doubao API error formats
      if (errorData.error?.code === 'AccountOverdueError') {
        throw new Error(`Account overdue: ${errorData.error.message}`);
      }
      
      throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
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
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: 'Unknown error' };
      }
      
      // Handle specific Doubao API error formats
      if (errorData.error?.code === 'AccountOverdueError') {
        throw new Error(`Account overdue: ${errorData.error.message}`);
      }
      
      throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return this.convertToStandardResponse(result, '');
  }

  // 轮询任务完成状态
  async pollTaskCompletion(taskId: string, prompt: string, maxAttempts: number = 30): Promise<DoubaoApiResponse> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const taskStatus = await this.getTaskStatus(taskId);

        if (taskStatus.status === 'completed') {
          return taskStatus;
        } else if (taskStatus.status === 'failed') {
          throw new Error('Task failed to complete');
        }

        // 等待10秒后重试
        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error('Task polling timeout - maximum attempts reached');
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
      // Test with video generation API directly
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'doubao-seedance-1-0-pro-250528',
          content: [
            {
              type: 'text',
              text: 'test'
            }
          ],
          resolution: '480p',
          duration: '1',
          camera_fixed: false,
          watermark: true
        }),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private convertToStandardResponse(doubaoResponse: any, prompt: string): DoubaoApiResponse {
    // Convert Doubao API response to our standard format
    return {
      video: {
        url: doubaoResponse.result?.video_url || doubaoResponse.data?.video_url || doubaoResponse.video_url || '',
        width: doubaoResponse.result?.width || doubaoResponse.data?.width || 1280,
        height: doubaoResponse.result?.height || doubaoResponse.data?.height || 720,
        content_type: 'video/mp4'
      },
      task_id: doubaoResponse.id || doubaoResponse.task_id || `doubao_${Date.now()}`,
      status: this.mapStatus(doubaoResponse.status || doubaoResponse.state),
      prompt: prompt
    };
  }

  private mapStatus(doubaoStatus: string): 'completed' | 'processing' | 'failed' {
    switch (doubaoStatus?.toLowerCase()) {
      case 'succeeded':
      case 'success':
      case 'completed':
      case 'done':
        return 'completed';
      case 'processing':
      case 'running':
      case 'pending':
      case 'created':
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
