'use client';

import React from 'react';
import { useTranslations } from '@/components/MainApp';
import { useApp } from '@/lib/context';
import { useApiKey } from '@/hooks/useApiKey';
import Button from './ui/Button';
import LanguageSwitcher from './LanguageSwitcher';

interface HeaderProps {
  onOpenSettings: () => void;
  activeTab: 'generate' | 'gallery';
  onTabChange: (tab: 'generate' | 'gallery') => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSettings, activeTab, onTabChange }) => {
  const t = useTranslations('header');
  const tNav = useTranslations('navigation');
  const { state } = useApp();
  const { hasValidApiKey } = useApiKey();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
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
              <h1 className="text-xl font-bold text-gray-900">
                {t('title')}
              </h1>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onTabChange('generate')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'generate'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tNav('generate')}
            </button>
            <button
              onClick={() => onTabChange('gallery')}
              className={`px-4 py-2 rounded-md font-medium transition-colors relative ${
                activeTab === 'gallery'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tNav('gallery')}
              {state.videos.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {state.videos.length > 99 ? '99+' : state.videos.length}
                </span>
              )}
            </button>
          </div>

          {/* Right Side - Status and Settings */}
          <div className="flex items-center space-x-4">
            {/* API Key Status */}
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  hasValidApiKey() ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {hasValidApiKey() ? 'API Connected' : 'API Not Configured'}
              </span>
            </div>

            {/* Generation Status */}
            {state.generationState.isGenerating && (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-blue-600">Generating...</span>
              </div>
            )}

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Settings Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              className="flex items-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>{tNav('settings')}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
