"use client";

import { UploadResponse } from "@/types";
import UploadMenu from "@/components/UploadMenu";

interface CenteredComposerProps {
  loading: boolean;
  text: string;
  onTextChange: (text: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  uploadedFiles: UploadResponse[];
  uploadStatus: "idle" | "uploading" | "success" | "error";
  onFilesSelect: (files: File[]) => void;
  onPhotosSelect: (files: File[]) => void;
}

export default function CenteredComposer({
  loading,
  text,
  onTextChange,
  onSend,
  onStop,
  uploadedFiles,
  uploadStatus,
  onFilesSelect,
  onPhotosSelect,
}: CenteredComposerProps) {
  return (
    <div className="mx-auto flex w-full max-w-[46rem] flex-col items-center px-3 sm:px-4 lg:px-6">
      <div className="w-full max-w-[44rem] overflow-visible rounded-[24px] border border-[rgba(255,255,255,0.04)] bg-[color-mix(in srgb, var(--bg-surface-strong) 82%, transparent)] shadow-[0_14px_32px_rgba(44,36,30,0.11)] backdrop-blur-2xl">
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const trimmed = text.trim();
              if (trimmed && !loading) onSend(trimmed);
            }
          }}
          placeholder="How can I help you today?"
          rows={2}
          disabled={loading}
          className="min-h-[120px] w-full resize-none border-none bg-transparent px-4 pt-4 text-[16px] leading-7 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none ring-0 shadow-none focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none disabled:opacity-60 sm:min-h-[132px] sm:px-5 sm:pt-5 [&:focus-visible]:!shadow-none [&:focus-visible]:!outline-none"
        />

        <div className="flex items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.04)] px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-center gap-2">
            <UploadMenu
              buttonClassName="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-[rgba(255,255,255,0.03)] bg-[color-mix(in srgb, var(--bg-surface) 68%, transparent)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-sidebar-hover)]"
              onFileUpload={() => {
                const input = document.querySelector(
                  'input[data-docchat-file-input="true"]'
                ) as HTMLInputElement | null;
                input?.click();
              }}
              onImageUpload={() => {
                const input = document.querySelector(
                  'input[data-docchat-photo-input="true"]'
                ) as HTMLInputElement | null;
                input?.click();
              }}
              buttonTitle="Add files or photos"
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
                className="flex h-9.5 items-center gap-1 rounded-full bg-[var(--accent)] px-3 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const trimmed = text.trim();
                  if (trimmed) onSend(trimmed);
                }}
                disabled={!text.trim()}
                className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-colors hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] disabled:text-[var(--text-tertiary)]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
        {["Write", "Learn", "Code", "Life stuff", "Claude's choice"].map((item) => (
          <span
            key={item}
            className="rounded-full border border-[rgba(255,255,255,0.03)] bg-[color-mix(in srgb, var(--bg-surface) 72%, transparent)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)]"
          >
            {item}
          </span>
        ))}
      </div>

      <input
        data-docchat-file-input="true"
        type="file"
        multiple
        accept=".pdf,.txt,.md,.markdown,.csv,.json,.docx,.xlsx,.xls,.pptx"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFilesSelect(files);
          e.target.value = "";
        }}
        className="hidden"
      />
      <input
        data-docchat-photo-input="true"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onPhotosSelect(files);
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}
