'use client';

import React, { useState } from 'react';
import { AppProvider, useApp } from '@/lib/context';
import Header from './Header';
import VideoGenerator from './VideoGenerator';
import VideoPlayer from './VideoPlayer';
import VideoGallery from './VideoGallery';
import Settings from './Settings';

const AppContent: React.FC = () => {
  const { state } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'gallery'>('generate');

  const currentVideo = state.generationState.currentVideo;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'generate' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Generator */}
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    生成动漫视频
                  </h2>
                  <VideoGenerator />
                </div>
              </div>

              {/* Right Column - Video Player */}
              <div className="space-y-6">
                {currentVideo ? (
                  <VideoPlayer video={currentVideo} />
                ) : (
                  <div className="bg-white rounded-lg shadow-sm p-8 text-center">
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
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          尚未生成视频
                        </h3>
                        <p className="text-gray-500 mt-2">
                          生成您的第一个动漫视频以在此处查看。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Videos Preview */}
                {state.videos.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        最近的视频
                      </h3>
                      <button
                        onClick={() => setActiveTab('gallery')}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        查看全部
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {state.videos.slice(0, 4).map((video) => (
                        <div
                          key={video.id}
                          className="relative aspect-video bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setActiveTab('gallery')}
                        >
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                              <svg
                                className="w-6 h-6 text-gray-400 mx-auto mb-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div className="text-xs text-gray-500">视频</div>
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all flex items-center justify-center">
                            <svg
                              className="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity"
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <VideoGallery />
          )}
        </div>
      </main>

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

const MainApp: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default MainApp;
