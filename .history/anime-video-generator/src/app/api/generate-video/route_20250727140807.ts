import { NextRequest, NextResponse } from 'next/server';
import * as fal from '@fal-ai/client';
import { VideoGenerationRequest, VideoGenerationResponse } from '@/types';
import { DoubaoClient, MockDoubaoClient } from '@/lib/doubao-client';

// Configure Fal client
fal.config({
  credentials: process.env.FAL_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body: VideoGenerationRequest = await request.json();
    const { prompt, image_url, resolution = '1080p', duration = '5', aspect_ratio = '16:9' } = body;

    // Validate required fields
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.FAL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 500 }
      );
    }

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

  } catch (error: any) {
    console.error('Video generation error:', error);
    
    let errorMessage = 'Failed to generate video';
    
    if (error.message?.includes('rate limit')) {
      errorMessage = 'API rate limit exceeded. Please try again later.';
    } else if (error.message?.includes('invalid prompt')) {
      errorMessage = 'Invalid prompt. Please try a more detailed description.';
    } else if (error.message?.includes('quota')) {
      errorMessage = 'API quota exceeded. Please check your Fal.ai account.';
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
