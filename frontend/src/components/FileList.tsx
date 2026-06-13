"use client";

import { useState } from "react";
import { deleteDocument } from "@/lib/api";
import { UploadResponse } from "@/types";

interface FileListProps {
  files: UploadResponse[];
  onDelete?: (fileName: string) => void;
}

export default function FileList({ files, onDelete }: FileListProps) {
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  async function handleDelete(fileName: string) {
    if (deletingFile) return; // 防止重复点击
    setDeletingFile(fileName);
    try {
      await deleteDocument(fileName);
      onDelete?.(fileName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
      alert(msg);
    } finally {
      setDeletingFile(null);
    }
  }

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-[#ded7cd] bg-[#fffefa] p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[#403a34]">已上传文档</h2>
        <p className="py-4 text-center text-xs text-[#8b8178]">暂无文档</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#ded7cd] bg-[#fffefa] p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-[#403a34]">
        已上传文档 ({files.length})
      </h2>
      <ul className="space-y-2">
        {files.map((file, i) => (
          <li
            key={file.file_name || i}
            className="flex items-center gap-3 rounded-md border border-[#ece5dc] bg-[#fbfaf7] p-2 transition-colors hover:border-[#d7cbbd]"
          >
            <svg
              className="h-5 w-5 shrink-0 text-[#b65f4a]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M4 18h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[#403a34]">{file.file_name}</p>
              <p className="text-xs text-[#8b8178]">
                {file.chunks_indexed} 个文本块
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(file.file_name)}
              disabled={deletingFile === file.file_name}
              className="shrink-0 rounded-md p-1.5 text-[#9b9188] transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
              title="删除文档"
            >
              {deletingFile === file.file_name ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
