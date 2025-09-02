'use client';

import React, { useState, createContext, useContext, useEffect } from 'react';
import { AppProvider, useApp } from '@/lib/context';
import Header from './Header';
import VideoGenerator from './VideoGenerator';
import VideoPlayer from './VideoPlayer';
import VideoGallery from './VideoGallery';
import Settings from './Settings';

// Create a simple i18n context
const I18nContext = createContext((key: string) => key);

// This hook is compatible with next-intl's useTranslations
export function useTranslations(namespace?: string) {
  const t = useContext(I18nContext);
  
  if (!namespace) {
    return t;
  }
  
  // Return a function that prepends the namespace to the key
  return (key: string, ...args: any[]) => {
    return t(`${namespace}.${key}`);
  };
}

// Simple t function with fallback
function createTranslator(messages: any) {
  return function t(key: string): string {
    const keys = key.split('.');
    let result: any = messages;
    for (const k of keys) {
      if (!result || typeof result !== 'object') {
        return key; // Return key if path is invalid
      }
      result = result[k];
      if (result === undefined) {
        return key; // Return key if not found
      }
    }
    return result;
  };
}

// Default empty translator
const defaultT = (key: string) => key;

const AppContent: React.FC = () => {
  const { state } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'gallery'>('generate');
  const t = useContext(I18nContext);

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
                    {t('generator.title')}
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
                          {t('videoPlayer.noVideo.title')}
                        </h3>
                        <p className="text-gray-500 mt-2">
                          {t('videoPlayer.noVideo.message')}
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
                        Recent Videos
                      </h3>
                      <button
                        onClick={() => setActiveTab('gallery')}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View All
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {state.videos.slice(0, 4).map((video) => (
                        <div
                          key={video.id}
                          className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setActiveTab('gallery')}
                        >
                          <video
                            src={video.url}
                            className="w-full h-full object-cover"
                            poster={video.imageUrl}
                          />
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
  const [translator, setTranslator] = useState(defaultT);

  useEffect(() => {
    // Dynamically load translations
    const loadTranslations = async () => {
      try {
        // More comprehensive hardcoded translations
        const zhMessages = {
          "common": {
            "loading": "加载中...",
            "error": "错误",
            "success": "成功",
            "cancel": "取消",
            "save": "保存",
            "close": "关闭",
            "delete": "删除",
            "edit": "编辑",
            "download": "下载",
            "upload": "上传",
            "generate": "生成",
            "retry": "重试",
            "clear": "清除"
          },
          "generator": {
            "title": "生成动漫视频",
            "generationType": {
              "label": "生成类型",
              "textToVideo": "文本转视频",
              "imageToVideo": "图片转视频"
            },
            "prompt": {
              "label": "提示词",
              "placeholder": "描述您想要生成的动漫视频...",
              "helperText": "请详细描述角色、动作、风格和场景以获得最佳效果"
            },
            "imageUpload": {
              "label": "上传图片",
              "dragDrop": "点击上传或拖拽文件"
            },
            "model": {
              "label": "模型",
              "fal": "Fal.ai（快速）",
              "doubao": "豆包 Seedance（高质量）"
            },
            "resolution": {
              "label": "分辨率",
              "480p": "480p（轻量版）",
              "720p": "720p（轻量版）",
              "1080p": "1080p（专业版）"
            },
            "duration": {
              "label": "时长",
              "5s": "5秒",
              "10s": "10秒"
            },
            "aspectRatio": {
              "label": "宽高比",
              "16:9": "16:9（横屏）",
              "9:16": "9:16（竖屏）",
              "1:1": "1:1（方形）"
            },
            "generateButton": "生成视频",
            "generating": "生成中...",
            "errors": {
              "title": "生成错误"
            },
            "warnings": {
              "apiKeyRequired": {
                "title": "需要API密钥",
                "message": "请在设置中配置您的 API 密钥以生成视频。"
              }
            }
          },
          "videoPlayer": {
            "noVideo": {
              "title": "尚未生成视频",
              "message": "生成您的第一个动漫视频以在此处查看。"
            }
          },
          "header": {
            "title": "动漫视频生成器"
          },
          "languageSwitcher": {
            "label": "语言",
            "english": "English",
            "chinese": "中文"
          }
        };
        
        setTranslator(() => createTranslator(zhMessages));
      } catch (error) {
        console.error('Failed to load translations:', error);
      }
    };

    loadTranslations();
  }, []);

  return (
    <I18nContext.Provider value={translator}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </I18nContext.Provider>
  );
};

export default MainApp;
