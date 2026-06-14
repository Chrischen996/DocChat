"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UploadMenu from "@/components/UploadMenu";
import { ChatMode, ModelOption, UploadResponse } from "@/types";

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

const MODE_OPTIONS: { value: ChatMode; label: string }[] = [
  { value: "agent", label: "Agent" },
  { value: "rag", label: "RAG" },
];

const MODEL_OPTIONS: ModelOption[] = [
  { id: "agnes-default", label: "Agens", provider: "Agens" },
  { id: "deepseek-r1", label: "DeepSeek R1", provider: "Agens" },
  { id: "deepseek-v3", label: "DeepSeek V3", provider: "Agens" },
  { id: "gpt-5", label: "GPT-5", provider: "OpenAI" },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "OpenAI" },
  { id: "claude-sonnet-4", label: "Claude 4 Sonnet", provider: "Anthropic" },
  { id: "claude-opus-4", label: "Claude 4 Opus", provider: "Anthropic" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google" },
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
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  model: string;
  onModelChange: (model: string) => void;
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
  mode,
  onModeChange,
  model,
  onModelChange,
}: QuerySectionProps) {
  const [focused, setFocused] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [text]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (composerRef.current && !composerRef.current.contains(event.target as Node)) {
        setModeOpen(false);
        setModelOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const groupedModels = useMemo(() => {
    return MODEL_OPTIONS.reduce<Record<string, ModelOption[]>>((acc, item) => {
      acc[item.provider] ??= [];
      acc[item.provider].push(item);
      return acc;
    }, {});
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

  return (
    <div className="shrink-0 px-2 pb-1 pt-2 sm:px-3 md:px-4">
      <div
        ref={composerRef}
        className={`relative overflow-visible rounded-[16px] bg-[var(--bg-card)] shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-2xl transition-all ${
          focused ? "shadow-[0_2px_12px_rgba(0,0,0,0.15)]" : ""
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
            uploadedFiles.length > 0 ? "Ask about your uploaded documents..." : "Message DocChat..."
          }
          rows={3}
          disabled={loading}
          className="w-full resize-none border-none bg-transparent px-4 pt-4 pb-3 text-[15px] leading-7 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none disabled:opacity-50 sm:px-5"
          style={{ minHeight: "110px" }}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-light)] px-3 py-3 sm:flex-nowrap sm:px-4">
          <div className="flex items-center gap-2">
            <UploadMenu
              loading={loading}
              onFileUpload={() => fileInputRef.current?.click()}
              onImageUpload={() => photoInputRef.current?.click()}
              buttonClassName="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-strong)] disabled:opacity-40"
              buttonTitle="Add files or images"
              menuPlacement="bottom"
              menuAlign="start"
            />

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setModelOpen(false);
                  setModeOpen((next) => !next);
                }}
                className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-strong)]"
                aria-expanded={modeOpen}
              >
                <span>{MODE_OPTIONS.find((item) => item.value === mode)?.label ?? "Agent"}</span>
                <svg className="h-3.5 w-3.5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {modeOpen && (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-32 overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onModeChange(option.value);
                        setModeOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--accent-light)] ${
                        mode === option.value ? "bg-[var(--accent-light)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      <span>{option.label}</span>
                      {mode === option.value && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setModeOpen(false);
                  setModelOpen((next) => !next);
                }}
                className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-strong)]"
                aria-expanded={modelOpen}
              >
                <span>{MODEL_OPTIONS.find((item) => item.id === model)?.label ?? "Agens"}</span>
                <svg className="h-3.5 w-3.5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {modelOpen && (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                  {Object.entries(groupedModels).map(([provider, items]) => (
                    <div key={provider} className="py-2">
                      <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                        {provider}
                      </div>
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onModelChange(item.id);
                            setModelOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--accent-light)] ${
                            model === item.id ? "bg-[var(--accent-light)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                          }`}
                        >
                          <div>
                            <div className="font-medium">{item.label}</div>
                            {item.description && <div className="text-xs text-[var(--text-tertiary)]">{item.description}</div>}
                          </div>
                          {model === item.id && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-colors hover:bg-[var(--accent-hover)]"
                aria-label="Stop"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-colors hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] disabled:text-[var(--text-tertiary)]"
                aria-label="Send message"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 11l6-6 6 6" />
                </svg>
              </button>
            )}
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
