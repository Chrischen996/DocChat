import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { VideoGenerationRequest, VideoGenerationResponse } from '@/types';
import { DoubaoClient, MockDoubaoClient } from '@/lib/doubao-client';

// Configure Fal client
fal.config({
  credentials: process.env.FAL_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body: VideoGenerationRequest = await request.json();
    const { prompt, image_url, resolution = '1080p', duration = '5', aspect_ratio = '16:9', model = 'fal-ai' } = body;

    // Validate required fields
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Route to appropriate model handler
    if (model === 'doubao') {
      debugger;
      return await handleDoubaoGeneration({ prompt, image_url, resolution, duration, aspect_ratio });
    } else {
      return await handleFalAiGeneration({ prompt, image_url, resolution, duration, aspect_ratio });
    }

  } catch (error: any) {
    console.error('Video generation error:', error);

    let errorMessage = 'Failed to generate video';

    if (error.message?.includes('rate limit')) {
      errorMessage = 'API rate limit exceeded. Please try again later.';
    } else if (error.message?.includes('invalid prompt')) {
      errorMessage = 'Invalid prompt. Please try a more detailed description.';
    } else if (error.message?.includes('quota')) {
      errorMessage = 'API quota exceeded. Please check your account.';
    } else if (error.message?.includes('overdue') || error.message?.includes('Forbidden')) {
      errorMessage = 'API account has overdue balance. Please check your account status.';
    } else if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
      errorMessage = 'Invalid API key. Please check your API key in settings.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    const response: VideoGenerationResponse = {
      success: false,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: 500 });
  }
}

async function handleFalAiGeneration({ prompt, image_url, resolution, duration, aspect_ratio }: {
  prompt: string;
  image_url?: string;
  resolution: string;
  duration: string;
  aspect_ratio: string;
}) {
  // Use mock response in development if no API key is configured
  if (!process.env.FAL_API_KEY || process.env.FAL_API_KEY === 'your_fal_api_key_here') {
    console.log('Using mock Fal.ai response for development');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockResponse: VideoGenerationResponse = {
      success: true,
      data: {
        video: {
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          width: 1280,
          height: 720,
          content_type: 'video/mp4'
        },
        seed: 12345,
        has_nsfw_concepts: [false],
        prompt: prompt,
        task_id: `fal_mock_${Date.now()}`,
        status: 'completed'
      }
    };
    
    return NextResponse.json(mockResponse);
  }

  // Configure Fal client
  fal.config({
    credentials: process.env.FAL_API_KEY,
  });

  // Determine which endpoint to use based on whether image_url is provided
  const endpoint = image_url
    ? 'fal-ai/bytedance/seedance/v1/pro/image-to-video'
    : 'fal-ai/bytedance/seedance/v1/pro/text-to-video';

  // Prepare the input based on generation type
  const input = image_url
    ? {
        image_url,
        prompt: `${prompt}, anime style`,
        resolution,
        duration,
      }
    : {
        prompt: `${prompt}, anime style`,
        resolution,
        duration,
        aspect_ratio,
      };

  console.log(`Generating video with ${endpoint}:`, input);

  // Call Fal.ai API
  const result = await fal.subscribe(endpoint, {
    input,
    logs: true,
    onQueueUpdate: (update) => {
      console.log('Queue update:', update);
    },
  });

  console.log('Generation result:', result);

  const response: VideoGenerationResponse = {
    success: true,
    data: result,
  };

  return NextResponse.json(response);
}

async function handleDoubaoGeneration({ prompt, image_url, resolution, duration, aspect_ratio }: {
  prompt: string;
  image_url?: string;
  resolution: string;
  duration: string;
  aspect_ratio?: string;
}) {
  // Use mock client in development if no API key is configured
  let client;
  if (!process.env.DOUBAO_API_KEY || process.env.DOUBAO_API_KEY === 'your_doubao_api_key_here') {
    console.log('Using mock Doubao client for development');
    client = new MockDoubaoClient('mock-key');
  } else {
    client = new DoubaoClient(process.env.DOUBAO_API_KEY);
  }

  console.log('Generating video with Doubao:', { prompt, image_url, resolution, duration });

  let result;
  try {
    if (image_url) {
      result = await client.generateImageToVideo({
        prompt,
        image_url,
        resolution,
        duration,
        aspect_ratio: aspect_ratio || '16:9',
      });
    } else {
      result = await client.generateTextToVideo({
        prompt,
        resolution,
        duration,
        aspect_ratio: aspect_ratio || '16:9',
      });
    }

    console.log('Doubao generation result:', result);

    // Convert Doubao response to match Fal.ai format
    const response: VideoGenerationResponse = {
      success: true,
      data: {
        video: result.video,
        seed: 0, // Doubao doesn't provide seed
        has_nsfw_concepts: [false],
        prompt: result.prompt,
        task_id: result.task_id,
        status: result.status,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Doubao generation error:', error);
    
    let errorMessage = 'Failed to generate video with Doubao';
    if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
      errorMessage = 'Invalid Doubao API key. Please check your API key in settings.';
    } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
      errorMessage = 'Doubao API quota exceeded. Please check your account.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
