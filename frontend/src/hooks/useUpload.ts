"use client";

import { useState } from "react";
import { uploadFile } from "@/lib/api";
import { UploadResponse } from "@/types";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export interface UploadFailure {
  file_name: string;
  error: string;
}

export function useUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [results, setResults] = useState<UploadResponse[]>([]);
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [error, setError] = useState<string>("");
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  async function upload(file: File) {
    const batch = await uploadMany([file]);
    return batch[0] ?? null;
  }

  async function uploadMany(files: File[]) {
    if (files.length === 0) return [];

    setStatus("uploading");
    setError("");
    setResult(null);
    setResults([]);
    setFailures([]);
    setCompletedCount(0);
    setTotalCount(files.length);

    const successful: UploadResponse[] = [];
    const failed: UploadFailure[] = [];

    for (const file of files) {
      setCurrentFileName(file.name);

      try {
        const data = await uploadFile(file);
        successful.push(data);
        setResult(data);
        setResults([...successful]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "上传失败";
        failed.push({ file_name: file.name, error: msg });
        setFailures([...failed]);
      } finally {
        setCompletedCount(successful.length + failed.length);
      }
    }

    setCurrentFileName("");

    if (failed.length > 0) {
      setError(`${failed.length} 个文件上传失败`);
    }

    setStatus(successful.length > 0 ? "success" : "error");
    return successful;
  }

  function reset() {
    setStatus("idle");
    setResult(null);
    setResults([]);
    setFailures([]);
    setError("");
    setCurrentFileName("");
    setCompletedCount(0);
    setTotalCount(0);
  }

  return {
    status,
    result,
    results,
    failures,
    error,
    currentFileName,
    completedCount,
    totalCount,
    upload,
    uploadMany,
    reset,
  };
}
