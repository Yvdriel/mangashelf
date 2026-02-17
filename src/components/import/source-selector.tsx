"use client";

import { useState } from "react";
import { FilesystemBrowser } from "./filesystem-browser";
import { FileDropZone } from "./file-drop-zone";
import type { ImportAnalysis } from "@/lib/import-types";

interface SourceSelectorProps {
  onAnalysisComplete: (analysis: ImportAnalysis) => void;
}

export function SourceSelector({ onAnalysisComplete }: SourceSelectorProps) {
  const [mode, setMode] = useState<"choose" | "browse" | "upload">("choose");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyzeSource(sourcePath: string, sessionId?: string) {
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/import/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath, sessionId }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Analysis failed");
        return;
      }

      const analysis: ImportAnalysis = await res.json();
      onAnalysisComplete(analysis);
    } catch (e) {
      setError(`Analysis failed: ${e}`);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleFolderSelect(folderPath: string) {
    analyzeSource(folderPath);
  }

  function handleUploadComplete(sessionId: string, stagingPath: string) {
    analyzeSource(stagingPath, sessionId);
  }

  if (mode === "browse") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-surface-50">
            Browse Server Files
          </h2>
          <button
            onClick={() => setMode("choose")}
            className="text-sm text-surface-200 hover:text-surface-50 transition-colors"
          >
            Back to options
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {analyzing && (
          <div className="rounded-lg border border-accent-400/30 bg-accent-400/10 px-4 py-3 text-sm text-accent-300">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Analyzing folder contents...
            </div>
          </div>
        )}

        <FilesystemBrowser onSelect={handleFolderSelect} disabled={analyzing} />
      </div>
    );
  }

  if (mode === "upload") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-surface-50">Upload Files</h2>
          <button
            onClick={() => setMode("choose")}
            className="text-sm text-surface-200 hover:text-surface-50 transition-colors"
          >
            Back to options
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {analyzing && (
          <div className="rounded-lg border border-accent-400/30 bg-accent-400/10 px-4 py-3 text-sm text-accent-300">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Analyzing uploaded files...
            </div>
          </div>
        )}

        <FileDropZone
          onUploadComplete={handleUploadComplete}
          disabled={analyzing}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-surface-50">
        Choose Import Source
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Browse Server */}
        <button
          onClick={() => setMode("browse")}
          className="group flex flex-col items-center gap-4 rounded-xl border border-surface-600 bg-surface-800 p-8 text-left transition-all hover:border-accent-400/40 hover:bg-surface-700"
        >
          <div className="rounded-xl bg-accent-400/10 p-4 transition-colors group-hover:bg-accent-400/20">
            <svg
              className="h-8 w-8 text-accent-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-base font-medium text-surface-50">
              Browse Server
            </h3>
            <p className="mt-1 text-sm text-surface-200">
              Select folders from the server filesystem — NAS drives, external
              storage, or existing collections
            </p>
          </div>
        </button>

        {/* Upload Files */}
        <button
          onClick={() => setMode("upload")}
          className="group flex flex-col items-center gap-4 rounded-xl border border-surface-600 bg-surface-800 p-8 text-left transition-all hover:border-accent-400/40 hover:bg-surface-700"
        >
          <div className="rounded-xl bg-accent-400/10 p-4 transition-colors group-hover:bg-accent-400/20">
            <svg
              className="h-8 w-8 text-accent-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-base font-medium text-surface-50">
              Upload Files
            </h3>
            <p className="mt-1 text-sm text-surface-200">
              Drag and drop archives or folders from your computer
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
