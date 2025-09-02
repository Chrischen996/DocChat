'use client';

import React, { useState } from 'react';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { useApiKey } from '@/hooks/useApiKey';
import Button from './ui/Button';
import Textarea from './ui/Textarea';
import Select from './ui/Select';
import FileUpload from './ui/FileUpload';
import Progress from './ui/Progress';
import { GenerationType } from '@/types';

const VideoGenerator: React.FC = () => {
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
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('1080p');
  const [duration, setDuration] = useState<'5' | '10'>('5');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }

    clearError();

    if (generationType === 'text-to-video') {
      await generateTextToVideo(prompt, {
        resolution,
        duration,
        aspect_ratio: aspectRatio,
      });
    } else if (generationType === 'image-to-video' && imagePreview) {
      // For image-to-video, we need to upload the image first
      // In a real implementation, you'd upload to a service and get a URL
      // For now, we'll use the data URL
      await generateImageToVideo(prompt, imagePreview, {
        resolution,
        duration,
      });
    }
  };

  const canGenerate = hasValidApiKey() && 
    prompt.trim().length > 0 && 
    (generationType === 'text-to-video' || (generationType === 'image-to-video' && uploadedImage));

  const resolutionOptions = [
    { value: '480p', label: '480p (Lite - ~$0.18)' },
    { value: '720p', label: '720p (Lite - ~$0.18)' },
    { value: '1080p', label: '1080p (Pro - ~$0.74)' },
  ];

  const durationOptions = [
    { value: '5', label: '5 seconds' },
    { value: '10', label: '10 seconds' },
  ];

  const aspectRatioOptions = [
    { value: '16:9', label: '16:9 (Landscape)' },
    { value: '9:16', label: '9:16 (Portrait)' },
    { value: '1:1', label: '1:1 (Square)' },
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
          Text to Video
        </button>
        <button
          onClick={() => setGenerationType('image-to-video')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            generationType === 'image-to-video'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Image to Video
        </button>
      </div>

      {/* Image Upload (for image-to-video) */}
      {generationType === 'image-to-video' && (
        <div className="space-y-4">
          <FileUpload
            label="Upload Image"
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
        label="Prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          generationType === 'text-to-video'
            ? 'Describe the anime video you want to generate...'
            : 'Describe how you want the image to be animated...'
        }
        rows={4}
        helperText={`${prompt.length}/500 characters`}
        maxLength={500}
      />

      {/* Example Prompts */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Example Prompts
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
    </div>
  );
};

export default VideoGenerator;
