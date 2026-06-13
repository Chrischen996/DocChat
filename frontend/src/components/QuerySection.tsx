"use client";

import { useRef, useEffect, useState } from "react";
import { UploadResponse } from "@/types";

const ACCEPTED_EXTENSIONS = [
  ".pdf", ".txt", ".md", ".markdown", ".csv", ".json",
  ".docx", ".xlsx", ".xls", ".pptx",
];

interface QuerySectionProps {
  loading: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  // File upload (documents for RAG)
  uploadedFiles: UploadResponse[];
  uploadStatus: "idle" | "uploading" | "success" | "error";
  uploadCurrentFileName: string;
  uploadCompletedCount: number;
  uploadTotalCount: number;
  onFilesSelect: (files: File[]) => void;
  onDeleteDocument: (fileName: string) => void;
  // Photo upload (images for chat display)
  onPhotosSelect: (files: File[]) => void;
}

export default function QuerySection({
  loading,
  onSend,
  onStop,
  uploadedFiles,
  uploadStatus,
  uploadCurrentFileName,
  uploadCompletedCount,
  uploadTotalCount,
  onFilesSelect,
  onDeleteDocument,
  onPhotosSelect,
}: QuerySectionProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close plus menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) {
        setPlusOpen(false);
      }
    }
    if (plusOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [plusOpen]);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      onFilesSelect(files);
      e.target.value = "";
    }
    setPlusOpen(false);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      onPhotosSelect(files);
      e.target.value = "";
    }
    setPlusOpen(false);
  }

  function triggerFileUpload() {
    setPlusOpen(false);
    // Use setTimeout to let the menu close before the file dialog opens
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  function triggerPhotoUpload() {
    setPlusOpen(false);
    setTimeout(() => photoInputRef.current?.click(), 50);
  }

  return (
    <div className="shrink-0 px-3 pb-3 pt-1">
      <div
        className={`mx-auto max-w-3xl overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
          focused
            ? "border-[var(--accent)]/30 shadow-[0_0_0_2px_rgba(90,90,90,0.08)]"
            : "border-[var(--border)] hover:border-[var(--text-tertiary)]/50"
        }`}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={uploadedFiles.length > 0 ? "基于已上传的文档提问..." : "给 DocChat 发送消息..."}
          rows={1}
          disabled={loading}
          className="w-full resize-none border-none bg-transparent px-4 pt-3 pb-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none disabled:opacity-50"
          style={{ minHeight: "24px" }}
        />

        {/* Bottom row */}
        <div className="flex items-center justify-between px-3 pb-2">
          {/* Left: + button with popup */}
          <div ref={plusRef} className="relative">
            <button
              type="button"
              onClick={() => setPlusOpen(!plusOpen)}
              disabled={loading}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--text-secondary)] disabled:opacity-40"
              title="添加文件或图片"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>

            {/* Popup menu */}
            {plusOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-40 overflow-hidden rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={triggerFileUpload}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-light)]"
                >
                  <svg className="h-4 w-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  文件上传
                </button>
                <button
                  type="button"
                  onClick={triggerPhotoUpload}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-light)]"
                >
                  <svg className="h-4 w-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  图片上传
                </button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={photoInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>

          {/* Center: upload progress */}
          {uploadStatus === "uploading" && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              解析中...
            </span>
          )}

          {/* File count indicator */}
          {uploadedFiles.length > 0 && uploadStatus !== "uploading" && (
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {uploadedFiles.length} 个文档
            </span>
          )}

          {/* Right: send/stop button */}
          <div className="ml-auto flex items-center gap-2">
            {loading ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-7 items-center gap-1 rounded-lg bg-[#b65f4a] px-2.5 text-xs font-medium text-white transition-colors hover:bg-[#a0523e]"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                停止
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-colors hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] disabled:text-[var(--text-tertiary)]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
