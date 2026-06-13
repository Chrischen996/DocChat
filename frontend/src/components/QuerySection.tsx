"use client";

import { useEffect, useRef, useState } from "react";
import UploadMenu from "@/components/UploadMenu";
import { UploadResponse } from "@/types";

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".docx",
  ".xlsx",
  ".xls",
  ".pptx",
];

interface QuerySectionProps {
  loading: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  uploadedFiles: UploadResponse[];
  uploadStatus: "idle" | "uploading" | "success" | "error";
  onFilesSelect: (files: File[]) => void;
  onPhotosSelect: (files: File[]) => void;
  text: string;
  onTextChange: (text: string) => void;
}

export default function QuerySection({
  loading,
  onSend,
  onStop,
  uploadedFiles,
  uploadStatus,
  onFilesSelect,
  onPhotosSelect,
  text,
  onTextChange,
}: QuerySectionProps) {
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    onTextChange("");
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
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      onPhotosSelect(files);
      e.target.value = "";
    }
  }

  function triggerFileUpload() {
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  function triggerPhotoUpload() {
    setTimeout(() => photoInputRef.current?.click(), 50);
  }

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-page)] px-2 pb-3 pt-3 sm:px-3 md:px-4 lg:px-6">
      <div className="mx-auto w-full max-w-[min(100%,44rem)]">
        <div
          className={`surface-card overflow-visible rounded-[24px] transition-all ${
            focused
              ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft),0_20px_46px_rgba(46,41,36,0.08)]"
              : ""
          }`}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={
              uploadedFiles.length > 0
                ? "Ask about your uploaded documents..."
                : "Message DocChat..."
            }
            rows={3}
            disabled={loading}
            className="w-full resize-none border-none bg-transparent px-4 pt-4 pb-3 text-[15px] leading-7 text-[var(--text-primary)] placeholder:text-[#a79a8f] outline-none disabled:opacity-50 sm:px-5"
            style={{ minHeight: "104px" }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-light)] bg-[var(--bg-surface)] px-3 py-3 sm:flex-nowrap sm:px-4">
            <div className="flex items-center gap-2">
              <UploadMenu
                loading={loading}
                onFileUpload={triggerFileUpload}
                onImageUpload={triggerPhotoUpload}
                buttonClassName="surface-panel flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-sidebar-hover)] disabled:opacity-40"
                buttonTitle="Add files or images"
                menuPlacement="bottom"
                menuAlign="start"
              />

              <span className="hidden text-xs text-[var(--text-tertiary)] sm:inline">
                {uploadedFiles.length > 0 ? `${uploadedFiles.length} files ready` : "Ready to chat"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {uploadStatus === "uploading" && (
                <span className="hidden text-xs text-[var(--text-tertiary)] sm:inline">
                  Processing...
                </span>
              )}

              {loading ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="flex h-9 items-center gap-1 rounded-full bg-[var(--accent)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!text.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-colors hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] disabled:text-[var(--text-tertiary)]"
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
  );
}
