"use client";

import { useState } from "react";

interface ImageDisplayProps {
  imageData: string;
  format: string;
  prompt: string;
}

export default function ImageDisplay({
  imageData,
  format,
  prompt,
}: ImageDisplayProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const dataUrl = `data:image/${format};base64,${imageData}`;

  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-indigo-500 text-xs font-semibold text-white shadow-sm">
        🎨
      </div>
      <div className="min-w-0 max-w-3xl flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">文生图</span>
          {" · "}
          {prompt}
        </div>
        <div className="flex items-center justify-center bg-slate-50 p-4">
          {failed ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-slate-400">
              <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              <span>图片加载失败</span>
            </div>
          ) : (
            <>
              {!loaded && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
                  <span className="text-xs text-slate-400">加载中...</span>
                </div>
              )}
              <img
                src={dataUrl}
                alt={prompt}
                onLoad={() => setLoaded(true)}
                onError={() => { setLoaded(true); setFailed(true); }}
                className={`max-h-96 w-full rounded-lg object-contain transition-opacity duration-300 ${
                  loaded ? "opacity-100" : "opacity-0 absolute"
                }`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
