"use client";

import { useState, useEffect, useCallback } from "react";

interface BrowseEntry {
  name: string;
  type: "directory" | "file";
  size: number;
  childCount?: number;
  contentHint?: "images" | "archives" | "mixed" | null;
}

interface Breadcrumb {
  name: string;
  path: string;
}

interface BrowseResponse {
  currentPath: string;
  entries: BrowseEntry[];
  breadcrumbs: Breadcrumb[];
  allowedRoots: { name: string; path: string }[];
}

interface FilesystemBrowserProps {
  onSelect: (path: string) => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FilesystemBrowser({
  onSelect,
  disabled,
}: FilesystemBrowserProps) {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(async (dirPath?: string) => {
    setLoading(true);
    setError(null);

    try {
      const url = dirPath
        ? `/api/import/browse?path=${encodeURIComponent(dirPath)}`
        : `/api/import/browse`;
      const res = await fetch(url);

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to browse directory");
        return;
      }

      setData(await res.json());
    } catch (e) {
      setError(`Failed to browse: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    browse();
  }, [browse]);

  const currentPath = data?.currentPath || "";
  const hasImportableContent = data?.entries.some(
    (e) =>
      (e.type === "directory" && e.contentHint) ||
      (e.type === "file" && /\.(zip|rar|7z|cbz|cbr)$/i.test(e.name)),
  );

  // Check if the current directory itself contains images
  const currentDirHasContent = data?.entries.some(
    (e) => e.type === "file" && /\.(jpg|jpeg|png|webp)$/i.test(e.name),
  );

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 overflow-hidden">
      {/* Root selector + breadcrumbs */}
      <div className="border-b border-surface-600 px-4 py-3">
        {data?.allowedRoots && data.allowedRoots.length > 1 && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-surface-300">Roots:</span>
            {data.allowedRoots.map((root) => (
              <button
                key={root.path}
                onClick={() => browse(root.path)}
                disabled={disabled}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  currentPath.startsWith(root.path)
                    ? "bg-accent-400/15 text-accent-300"
                    : "bg-surface-700 text-surface-200 hover:bg-surface-600"
                }`}
              >
                {root.name}
              </button>
            ))}
          </div>
        )}

        {/* Breadcrumbs */}
        {data?.breadcrumbs && (
          <div className="flex items-center gap-1 text-sm overflow-x-auto">
            {data.breadcrumbs.map((crumb, i) => (
              <div
                key={crumb.path}
                className="flex items-center gap-1 shrink-0"
              >
                {i > 0 && <span className="text-surface-400">/</span>}
                <button
                  onClick={() => browse(crumb.path)}
                  disabled={disabled}
                  className={`rounded px-1 py-0.5 transition-colors ${
                    i === data.breadcrumbs.length - 1
                      ? "font-medium text-surface-50"
                      : "text-surface-200 hover:text-surface-50 hover:bg-surface-700"
                  }`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && <div className="px-4 py-3 text-sm text-red-400">{error}</div>}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <svg
            className="h-6 w-6 animate-spin text-accent-300"
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
        </div>
      )}

      {/* Entry list */}
      {!loading && data && (
        <div className="max-h-[28rem] overflow-y-auto">
          {data.entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-surface-300">
              This directory is empty
            </div>
          ) : (
            <div className="divide-y divide-surface-700">
              {data.entries.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-700/50"
                >
                  {entry.type === "directory" ? (
                    <>
                      <button
                        onClick={() => browse(`${currentPath}/${entry.name}`)}
                        disabled={disabled}
                        className="flex flex-1 items-center gap-3 min-w-0"
                      >
                        <svg
                          className="h-5 w-5 shrink-0 text-accent-300/70"
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
                        <span className="truncate text-sm font-medium text-surface-50">
                          {entry.name}
                        </span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.contentHint && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              entry.contentHint === "images"
                                ? "bg-green-500/15 text-green-400"
                                : entry.contentHint === "archives"
                                  ? "bg-blue-500/15 text-blue-400"
                                  : "bg-yellow-500/15 text-yellow-400"
                            }`}
                          >
                            {entry.contentHint}
                          </span>
                        )}
                        {entry.childCount !== undefined && (
                          <span className="text-xs text-surface-300">
                            {entry.childCount} items
                          </span>
                        )}
                        <svg
                          className="h-4 w-4 text-surface-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </>
                  ) : /\.(zip|rar|7z|cbz|cbr)$/i.test(entry.name) ? (
                    <>
                      <button
                        onClick={() => onSelect(`${currentPath}/${entry.name}`)}
                        disabled={disabled}
                        className="flex flex-1 items-center gap-3 min-w-0"
                      >
                        <svg
                          className="h-5 w-5 shrink-0 text-blue-400/70"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                          />
                        </svg>
                        <span className="truncate text-sm font-medium text-surface-50">
                          {entry.name}
                        </span>
                      </button>
                      <span className="text-xs text-surface-300 shrink-0">
                        {formatSize(entry.size)}
                      </span>
                    </>
                  ) : (
                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      <svg
                        className="h-5 w-5 shrink-0 text-surface-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                      <span className="truncate text-sm text-surface-200">
                        {entry.name}
                      </span>
                      <span className="ml-auto text-xs text-surface-300 shrink-0">
                        {formatSize(entry.size)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Select button */}
      {!loading && data && (hasImportableContent || currentDirHasContent) && (
        <div className="border-t border-surface-600 px-4 py-3">
          <button
            onClick={() => onSelect(currentPath)}
            disabled={disabled}
            className="w-full rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-medium text-surface-900 transition-colors hover:bg-accent-300 disabled:opacity-50"
          >
            Select this folder
          </button>
        </div>
      )}
    </div>
  );
}
