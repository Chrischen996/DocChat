'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { VideoGenerationRequest, GeneratedVideo } from '@/types';
import { generateId, fileUtils } from '@/lib/utils';

export const useVideoGeneration = () => {
  const { state, dispatch } = useApp();
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const generateVideo = useCallback(async (request: VideoGenerationRequest): Promise<void> => {
    debugger
    // Check API key based on selected model
    const requiredApiKey = request.model === 'doubao' ? state.settings.doubaoApiKey : state.settings.apiKey;
    
    console.log('Debug: generateVideo called with model:', request.model);
    console.log('Debug: doubaoApiKey:', state.settings.doubaoApiKey);
    console.log('Debug: falaiApiKey:', state.settings.apiKey);
    console.log('Debug: requiredApiKey:', requiredApiKey);
    
    if (!requiredApiKey) {
      const modelName = request.model === 'doubao' ? '豆包' : 'Fal.ai';
      dispatch({
        type: 'GENERATION_ERROR',
        payload: `${modelName} API key is required. Please configure it in settings.`,
      });
      return;
    }

    dispatch({ type: 'START_GENERATION' });

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        dispatch({
          type: 'SET_GENERATION_PROGRESS',
          payload: Math.min(state.generationState.progress + 10, 90),
        });
      }, 3000);

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      clearInterval(progressInterval);

      const result = await response.json();

      if (!result.success) {
        dispatch({
          type: 'GENERATION_ERROR',
          payload: result.error || 'Failed to generate video',
        });
        return;
      }

      // Create a GeneratedVideo object
      const generatedVideo: GeneratedVideo = {
        id: generateId(),
        url: result.data.video.url,
        prompt: request.prompt,
        imageUrl: request.image_url,
        createdAt: new Date(),
        resolution: request.resolution || '1080p',
        duration: request.duration || '5',
        aspectRatio: request.aspect_ratio || '16:9',
      };

      dispatch({
        type: 'GENERATION_SUCCESS',
        payload: generatedVideo,
      });

    } catch (error: any) {
      dispatch({
        type: 'GENERATION_ERROR',
        payload: error.message || 'An unexpected error occurred',
      });
    }
  }, [state.settings.apiKey, state.settings.doubaoApiKey, state.generationState.progress, dispatch]);

  const generateTextToVideo = useCallback(async (
    prompt: string,
    options?: {
      resolution?: '480p' | '720p' | '1080p';
      duration?: '5' | '10';
      aspect_ratio?: '16:9' | '9:16' | '1:1';
      model?: 'fal-ai' | 'doubao';
    }
  ) => {
    const request: VideoGenerationRequest = {
      prompt,
      resolution: options?.resolution || state.settings.defaultResolution,
      duration: options?.duration || state.settings.defaultDuration,
      aspect_ratio: options?.aspect_ratio || state.settings.defaultAspectRatio,
      model: options?.model || state.settings.defaultModel,
    };

    await generateVideo(request);
  }, [generateVideo, state.settings]);

  const generateImageToVideo = useCallback(async (
    prompt: string,
    imageUrl: string,
    options?: {
      resolution?: '480p' | '720p' | '1080p';
      duration?: '5' | '10';
      model?: 'fal-ai' | 'doubao';
    }
  ) => {
    const request: VideoGenerationRequest = {
      prompt,
      image_url: imageUrl,
      resolution: options?.resolution || state.settings.defaultResolution,
      duration: options?.duration || state.settings.defaultDuration,
      model: options?.model || state.settings.defaultModel,
    };

    await generateVideo(request);
  }, [generateVideo, state.settings]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!fileUtils.validateImageFile(file)) {
      dispatch({
        type: 'GENERATION_ERROR',
        payload: 'Please select a valid image file (JPG, PNG, WEBP, GIF, AVIF)',
      });
      return;
    }

    try {
      const dataUrl = await fileUtils.getImageDataUrl(file);
      setUploadedImage(file);
      setImagePreview(dataUrl);
      dispatch({ type: 'CLEAR_ERROR' });
    } catch (error) {
      dispatch({
        type: 'GENERATION_ERROR',
        payload: 'Failed to process the uploaded image',
      });
    }
  }, [dispatch]);

  const clearUploadedImage = useCallback(() => {
    setUploadedImage(null);
    setImagePreview(null);
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, [dispatch]);

  const downloadVideo = useCallback(async (video: GeneratedVideo) => {
    try {
      const filename = `anime-video-${video.id}.mp4`;
      await fileUtils.downloadVideo(video.url, filename);
    } catch (error) {
      dispatch({
        type: 'GENERATION_ERROR',
        payload: 'Failed to download video',
      });
    }
  }, [dispatch]);

  return {
    // State
    generationState: state.generationState,
    currentVideo: state.generationState.currentVideo,
    isGenerating: state.generationState.isGenerating,
    progress: state.generationState.progress,
    error: state.generationState.error,
    uploadedImage,
    imagePreview,
    
    // Actions
    generateTextToVideo,
    generateImageToVideo,
    handleImageUpload,
    clearUploadedImage,
    clearError,
    downloadVideo,
  };
};
