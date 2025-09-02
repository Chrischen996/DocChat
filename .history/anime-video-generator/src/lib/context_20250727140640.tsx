'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { GeneratedVideo, AppSettings, GenerationState } from '@/types';
import { storage } from './utils';

// Define the app state
interface AppState {
  settings: AppSettings;
  generationState: GenerationState;
  videos: GeneratedVideo[];
}

// Define actions
type AppAction =
  | { type: 'SET_API_KEY'; payload: string }
  | { type: 'SET_DOUBAO_API_KEY'; payload: string }
  | { type: 'SET_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'START_GENERATION' }
  | { type: 'SET_GENERATION_PROGRESS'; payload: number }
  | { type: 'GENERATION_SUCCESS'; payload: GeneratedVideo }
  | { type: 'GENERATION_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'ADD_VIDEO'; payload: GeneratedVideo }
  | { type: 'REMOVE_VIDEO'; payload: string }
  | { type: 'LOAD_SAVED_DATA'; payload: { settings: AppSettings; videos: GeneratedVideo[] } };

// Initial state
const initialState: AppState = {
  settings: {
    apiKey: '',
    defaultResolution: '1080p',
    defaultDuration: '5',
    defaultAspectRatio: '16:9',
    saveDirectory: '',
  },
  generationState: {
    isGenerating: false,
    progress: 0,
    currentVideo: null,
    error: null,
  },
  videos: [],
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_API_KEY':
      const newSettings = { ...state.settings, apiKey: action.payload };
      storage.set('app_settings', newSettings);
      return {
        ...state,
        settings: newSettings,
      };

    case 'SET_SETTINGS':
      const updatedSettings = { ...state.settings, ...action.payload };
      storage.set('app_settings', updatedSettings);
      return {
        ...state,
        settings: updatedSettings,
      };

    case 'START_GENERATION':
      return {
        ...state,
        generationState: {
          isGenerating: true,
          progress: 0,
          currentVideo: null,
          error: null,
        },
      };

    case 'SET_GENERATION_PROGRESS':
      return {
        ...state,
        generationState: {
          ...state.generationState,
          progress: action.payload,
        },
      };

    case 'GENERATION_SUCCESS':
      const newVideos = [action.payload, ...state.videos];
      storage.set('generated_videos', newVideos);
      return {
        ...state,
        generationState: {
          isGenerating: false,
          progress: 100,
          currentVideo: action.payload,
          error: null,
        },
        videos: newVideos,
      };

    case 'GENERATION_ERROR':
      return {
        ...state,
        generationState: {
          isGenerating: false,
          progress: 0,
          currentVideo: null,
          error: action.payload,
        },
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        generationState: {
          ...state.generationState,
          error: null,
        },
      };

    case 'ADD_VIDEO':
      const videosWithNew = [action.payload, ...state.videos];
      storage.set('generated_videos', videosWithNew);
      return {
        ...state,
        videos: videosWithNew,
      };

    case 'REMOVE_VIDEO':
      const filteredVideos = state.videos.filter(video => video.id !== action.payload);
      storage.set('generated_videos', filteredVideos);
      return {
        ...state,
        videos: filteredVideos,
      };

    case 'LOAD_SAVED_DATA':
      return {
        ...state,
        settings: action.payload.settings,
        videos: action.payload.videos,
      };

    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load saved data on mount
  useEffect(() => {
    const savedSettings = storage.get('app_settings') || initialState.settings;
    const savedVideos = storage.get('generated_videos') || [];
    
    dispatch({
      type: 'LOAD_SAVED_DATA',
      payload: { settings: savedSettings, videos: savedVideos },
    });
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
