'use client';

import React, { useState } from 'react';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { useApiKey } from '@/hooks/useApiKey';
import { useApp } from '@/lib/context';
import Button from './ui/Button';
import Textarea from './ui/Textarea';
import Select from './ui/Select';
import FileUpload from './ui/FileUpload';
import Progress from './ui/Progress';
import { GenerationType } from '@/types';

const VideoGenerator: React.FC = () => {
  const { state } = useApp();
  const {
    generationState,
    isGenerating,
    progress,
    error,
    uploadedImage,
    imagePreview,
    generateTextToVideo,
    generateImageToVideo,
    handleImageUpload,
    clearUploadedImage,
    clearError,
  } = useVideoGeneration();

  const { hasValidApiKey } = useApiKey();

  const [generationType, setGenerationType] = useState<GenerationType>('text-to-video');
  const [selectedModel, setSelectedModel] = useState<'fal-ai' | 'doubao'>(state.settings.defaultModel);
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('1080p');
  const [duration, setDuration] = useState<'5' | '10'>('5');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }

    clearError();

    // Create request with selected model
    const baseRequest = {
      prompt,
      resolution,
      duration,
      model: selectedModel,
    };

    if (generationType === 'text-to-video') {
      await generateTextToVideo(prompt, {
        ...baseRequest,
        aspect_ratio: aspectRatio,
      });
    } else if (generationType === 'image-to-video' && imagePreview) {
      // For image-to-video, we need to upload the image first
      // In a real implementation, you'd upload to a service and get a URL
      // For now, we'll use the data URL
      await generateImageToVideo(prompt, imagePreview, {
        ...baseRequest,
      });
    }
  };

  const canGenerate = hasValidApiKey(selectedModel) &&
    prompt.trim().length > 0 &&
    (generationType === 'text-to-video' || (generationType === 'image-to-video' && uploadedImage));

  const resolutionOptions = [
    { value: '480p', label: '480p（轻量版）' },
    { value: '720p', label: '720p（轻量版）' },
    { value: '1080p', label: '1080p（专业版）' },
  ];

  const durationOptions = [
    { value: '5', label: '5秒' },
    { value: '10', label: '10秒' },
  ];

  const aspectRatioOptions = [
    { value: '16:9', label: '16:9（横屏）' },
    { value: '9:16', label: '9:16（竖屏）' },
    { value: '1:1', label: '1:1（方形）' },
  ];

  const modelOptions = [
    { value: 'fal-ai', label: 'Fal.ai（快速）' },
    { value: 'doubao', label: '豆包 Seedance（高质量）' },
  ];

  const examplePrompts = [
    'An anime character with blue hair running through a magical forest',
    'Anime-style young girl dancing in a neon-lit city at night',
    'A cute anime cat sitting on a windowsill watching the rain',
    'Anime warrior with glowing sword fighting in an epic battle',
    'Peaceful anime scene of cherry blossoms falling in a Japanese garden',
  ];

  return (
    <div className="space-y-6">
      {/* Generation Type Selector */}
      <div className="flex space-x-4">
        <button
          onClick={() => setGenerationType('text-to-video')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            generationType === 'text-to-video'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          文本转视频
        </button>
        <button
          onClick={() => setGenerationType('image-to-video')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            generationType === 'image-to-video'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          图片转视频
        </button>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Select
          label="模型"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value as 'fal-ai' | 'doubao')}
          options={modelOptions}
        />
        <p className="text-xs text-gray-500">
          选择不同的AI模型进行视频生成。价格和质量可能有所不同。
        </p>
      </div>

      {/* Image Upload (for image-to-video) */}
      {generationType === 'image-to-video' && (
        <div className="space-y-4">
          <FileUpload
            label="上传图片"
            onFileSelect={handleImageUpload}
            accept="image/*"
            maxSize={10}
          />
          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Uploaded preview"
                className="max-w-xs rounded-lg shadow-md"
              />
              <button
                onClick={clearUploadedImage}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Prompt Input */}
      <Textarea
        label="提示词"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="描述您想要生成的动漫视频..."
        rows={4}
        helperText={`${prompt.length}/500 字符`}
        maxLength={500}
        className="mb-2 text-black"
      />

      {/* Example Prompts */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          示例提示词
        </label>
        <div className="flex flex-wrap gap-2">
          {examplePrompts.map((example, index) => (
            <button
              key={index}
              onClick={() => setPrompt(example)}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Generation Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="分辨率"
          value={resolution}
          onChange={(e) => setResolution(e.target.value as any)}
          options={resolutionOptions}
        />

        <Select
          label="时长"
          value={duration}
          onChange={(e) => setDuration(e.target.value as any)}
          options={durationOptions}
        />

        {generationType === 'text-to-video' && (
          <Select
            label="宽高比"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as any)}
            options={aspectRatioOptions}
          />
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                生成错误
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={clearError}
                  className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Display */}
      {isGenerating && (
        <div className="space-y-4">
          <Progress
            value={progress}
            showLabel
            label="生成中..."
          />
          <div className="text-center text-sm text-gray-600">
            这可能需要最多60秒的时间，请稍候...
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate}
          loading={isGenerating}
          size="lg"
          className="px-8"
        >
          {isGenerating ? '生成中...' : '生成视频'}
        </Button>
      </div>

      {/* API Key Warning */}
      {!hasValidApiKey(selectedModel) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                需要API密钥
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>请在设置中配置您的 {selectedModel === 'doubao' ? '豆包' : 'Fal.ai'} API 密钥以生成视频。</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoGenerator;
