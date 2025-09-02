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
  // Check if API key is configured
  if (!process.env.FAL_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Fal.ai API key not configured' },
      { status: 500 }
    );
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

async function handleDoubaoGeneration({ prompt, image_url, resolution, duration }: {
  prompt: string;
  image_url?: string;
  resolution: string;
  duration: string;
}) {
  // Check if Doubao API key is configured
  if (!process.env.DOUBAO_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Doubao API key not configured' },
      { status: 500 }
    );
  }

  // Use mock client for development - replace with real client when Doubao API is available
  const client = new MockDoubaoClient(process.env.DOUBAO_API_KEY);

  console.log('Generating video with Doubao:', { prompt, image_url, resolution, duration });

  let result;
  if (image_url) {
    result = await client.generateImageToVideo({
      prompt,
      image_url,
      resolution,
      duration,
    });
  } else {
    result = await client.generateTextToVideo({
      prompt,
      resolution,
      duration,
      aspect_ratio: '16:9', // Default for Doubao
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
    },
  };

  return NextResponse.json(response);
}
