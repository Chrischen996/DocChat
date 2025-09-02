'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApp } from '@/lib/context';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { GeneratedVideo } from '@/types';
import VideoPlayer from './VideoPlayer';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { formatUtils } from '@/lib/utils';

const VideoGallery: React.FC = () => {
  const t = useTranslations('gallery');
  const { state, dispatch } = useApp();
  const { downloadVideo } = useVideoGeneration();
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'resolution'>('newest');
  const [filterBy, setFilterBy] = useState<'all' | '480p' | '720p' | '1080p'>('all');

  const handleVideoClick = (video: GeneratedVideo) => {
    setSelectedVideo(video);
    setIsPlayerOpen(true);
  };

  const handleDeleteVideo = (videoId: string) => {
    if (confirm('Are you sure you want to delete this video?')) {
      dispatch({ type: 'REMOVE_VIDEO', payload: videoId });
    }
  };

  const handleDownloadVideo = async (video: GeneratedVideo) => {
    await downloadVideo(video);
  };

  // Filter and sort videos
  const filteredAndSortedVideos = React.useMemo(() => {
    let filtered = state.videos;

    // Apply filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(video => video.resolution === filterBy);
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'resolution':
          const resolutionOrder = { '1080p': 3, '720p': 2, '480p': 1 };
          return resolutionOrder[b.resolution as keyof typeof resolutionOrder] -
                 resolutionOrder[a.resolution as keyof typeof resolutionOrder];
        default:
          return 0;
      }
    });

    return sorted;
  }, [state.videos, sortBy, filterBy]);

  if (state.videos.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <div className="space-y-4">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-medium text-gray-900">
              {t('empty.title')}
            </h3>
            <p className="text-gray-500 mt-2">
              {t('empty.message')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
            <p className="text-gray-600 mt-1">
              {t('videoCount', { count: state.videos.length })}
            </p>
          </div>

          {/* Filters and Sort */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Filter:</label>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                <option value="all">All Resolutions</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="resolution">By Resolution</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredAndSortedVideos.map((video) => (
          <div
            key={video.id}
            className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Video Thumbnail */}
            <div
              className="relative aspect-video bg-gray-100 cursor-pointer group"
              onClick={() => handleVideoClick(video)}
            >
              <video
                src={video.url}
                className="w-full h-full object-cover"
                poster={video.imageUrl}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              {/* Resolution Badge */}
              <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                {video.resolution}
              </div>
            </div>

            {/* Video Info */}
            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-medium text-gray-900 line-clamp-2 text-sm">
                  {video.prompt}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {formatUtils.formatDate(video.createdAt)}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{video.duration}s</span>
                <span>{video.aspectRatio}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadVideo(video)}
                  className="text-xs"
                >
                  Download
                </Button>
                <button
                  onClick={() => handleDeleteVideo(video.id)}
                  className="text-red-600 hover:text-red-800 text-xs font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Video Player Modal */}
      <Modal
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        size="xl"
      >
        {selectedVideo && (
          <VideoPlayer video={selectedVideo} />
        )}
      </Modal>
    </div>
  );
};

export default VideoGallery;
