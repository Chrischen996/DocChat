'use client';

import React, { createContext, useContext } from 'react';

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

// Comprehensive hardcoded translations
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

// Create the translator
const translator = createTranslator(zhMessages);

// Provider component
export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nContext.Provider value={translator}>
      {children}
    </I18nContext.Provider>
  );
} 