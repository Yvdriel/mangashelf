"use client";

import { useState, useRef, useCallback } from "react";

interface FileDropZoneProps {
  onUploadComplete: (sessionId: string, stagingPath: string) => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FileDropZone({
  onUploadComplete,
  disabled,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setUploading(true);
      setProgress(0);
      setError(null);

      const formData = new FormData();
      for (const file of files) {
        // Use webkitRelativePath if available (directory upload), else just the file name
        const key =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name;
        formData.append(key, file);
      }

      try {
        // Use XMLHttpRequest for upload progress
        const result = await new Promise<{
          sessionId: string;
          stagingPath: string;
        }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              try {
                const err = JSON.parse(xhr.responseText);
                reject(new Error(err.error || `Upload failed (${xhr.status})`));
              } catch {
                reject(new Error(`Upload failed (${xhr.status})`));
              }
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Upload failed — network error"));
          });

          xhr.open("POST", "/api/import/upload");
          xhr.send(formData);
        });

        setProgress(100);
        onUploadComplete(result.sessionId, result.stagingPath);
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      } finally {
        setUploading(false);
      }
    },
    [onUploadComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled || uploading) return;

      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(files);
      handleUpload(files);
    },
    [disabled, uploading, handleUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      handleUpload(files);
    },
    [handleUpload],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !uploading) setIsDragging(true);
    },
    [disabled, uploading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-accent-400 bg-accent-400/5"
            : uploading
              ? "border-surface-500 bg-surface-800"
              : "border-surface-500 bg-surface-800 hover:border-surface-400"
        }`}
      >
        {uploading ? (
          <div className="w-full space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-200">
                Uploading {selectedFiles.length} file
                {selectedFiles.length !== 1 ? "s" : ""}...
              </span>
              <span className="text-accent-300 font-medium">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-600 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-surface-300 text-center">
              {formatSize(selectedFiles.reduce((sum, f) => sum + f.size, 0))}{" "}
              total
            </p>
          </div>
        ) : (
          <>
            <svg
              className="h-10 w-10 text-surface-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm text-surface-200 mb-1">
              Drag and drop files here
            </p>
            <p className="text-xs text-surface-400 mb-4">
              Archives (.zip, .rar, .7z, .cbz, .cbr) or image folders — max 5 GB
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="rounded-lg border border-surface-500 px-4 py-2 text-sm text-surface-200 hover:bg-surface-700 transition-colors disabled:opacity-50"
              >
                Choose Files
              </button>
              <button
                onClick={() => dirInputRef.current?.click()}
                disabled={disabled}
                className="rounded-lg border border-surface-500 px-4 py-2 text-sm text-surface-200 hover:bg-surface-700 transition-colors disabled:opacity-50"
              >
                Choose Folder
              </button>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".zip,.rar,.7z,.cbz,.cbr,.jpg,.jpeg,.png,.webp"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={dirInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in the standard types
        webkitdirectory=""
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
