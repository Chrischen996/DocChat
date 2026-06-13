"use client";

import { DragEvent, useRef, useState } from "react";

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

interface UploadSectionProps {
  uploading: boolean;
  currentFileName?: string;
  completedCount?: number;
  totalCount?: number;
  onFilesSelect: (files: File[]) => void;
  result: { file_name: string; message: string; chunks_indexed: number } | null;
  error: string;
}

function isAccepted(file: File) {
  const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
  return ACCEPTED_EXTENSIONS.includes(extension);
}

export default function UploadSection({
  uploading,
  currentFileName = "",
  completedCount = 0,
  totalCount = 0,
  onFilesSelect,
  result,
  error,
}: UploadSectionProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(isAccepted);
    if (files.length > 0) {
      onFilesSelect(files);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter(isAccepted);
    if (files.length > 0) {
      onFilesSelect(files);
      e.target.value = "";
    }
  }

  const progressText =
    totalCount > 1
      ? `${completedCount}/${totalCount}${currentFileName ? ` · ${currentFileName}` : ""}`
      : currentFileName;

  return (
    <div className="rounded-lg border border-[#ded7cd] bg-[#fffefa] p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-[#403a34]">上传文档</h2>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border border-dashed p-6 text-center transition-colors ${
          dragging
            ? "border-[#6c8f75] bg-[#eef7f0]"
            : "border-[#d6cfc5] bg-[#fbfaf7] hover:border-[#b8ada2]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleInputChange}
          className="hidden"
        />

        {uploading ? (
          <div className="text-[#6f675f]">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#d4cbc0] border-t-[#6f4f3f]" />
            <p className="text-sm">正在解析文档</p>
            {progressText && (
              <p className="mt-1 truncate text-xs text-[#8b8178]">{progressText}</p>
            )}
          </div>
        ) : (
          <div className="text-[#6f675f]">
            <svg
              className="mx-auto mb-3 h-9 w-9 text-[#9b9188]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 16v-8m0 0l-3 3m3-3l3 3M9 20H5a2 2 0 01-2-2V6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v2"
              />
            </svg>
            <p className="text-sm font-medium text-[#403a34]">选择一个或多个文档</p>
            <p className="mt-1 text-xs text-[#8b8178]">
              PDF、Word、Excel、PPT、文本等
            </p>
          </div>
        )}
      </div>

      {result && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <p className="truncate font-medium">{result.file_name}</p>
          <p className="mt-1 text-xs">{result.message}</p>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
