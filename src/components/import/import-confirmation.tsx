"use client";

import type { ImportAnalysis } from "@/lib/import-types";

interface VolumeConfig {
  id: string;
  volumeNumber: number;
  action: "import" | "skip" | "replace";
  included: boolean;
}

interface AniListMatch {
  anilistId: number;
  title: string;
  coverUrl: string;
  totalVolumes: number | null;
}

interface ImportConfirmationProps {
  analysis: ImportAnalysis;
  volumeConfigs: VolumeConfig[];
  anilistMatch: AniListMatch | null;
  manualTitle: string;
  mode: "copy" | "move";
  onModeChange: (mode: "copy" | "move") => void;
  addToManager: boolean;
  onAddToManagerChange: (v: boolean) => void;
  monitor: boolean;
  onMonitorChange: (v: boolean) => void;
  onConfirm: () => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function ImportConfirmation({
  analysis,
  volumeConfigs,
  anilistMatch,
  manualTitle,
  mode,
  onModeChange,
  addToManager,
  onAddToManagerChange,
  monitor,
  onMonitorChange,
  onConfirm,
}: ImportConfirmationProps) {
  const title = anilistMatch?.title || manualTitle;

  const toImport = volumeConfigs.filter(
    (v) => v.included && v.action === "import",
  );
  const toReplace = volumeConfigs.filter(
    (v) => v.included && v.action === "replace",
  );
  const toSkip = volumeConfigs.filter(
    (v) => !v.included || v.action === "skip",
  );

  const importVolumes = [...toImport, ...toReplace];

  const totalPages = importVolumes.reduce((sum, vc) => {
    const vol = analysis.volumes.find((v) => v.id === vc.id);
    return sum + (vol?.pageCount || 0);
  }, 0);

  const totalSize = importVolumes.reduce((sum, vc) => {
    const vol = analysis.volumes.find((v) => v.id === vc.id);
    return sum + (vol?.totalSizeBytes || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
        <div className="flex items-start gap-4">
          {anilistMatch?.coverUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={anilistMatch.coverUrl}
              alt=""
              className="h-24 w-16 rounded-lg object-cover shrink-0"
            />
          )}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-surface-50">{title}</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-200">
              <span>
                {importVolumes.length} volume
                {importVolumes.length !== 1 ? "s" : ""} to import
              </span>
              <span>{totalPages.toLocaleString()} pages</span>
              <span>{formatSize(totalSize)}</span>
            </div>
            {anilistMatch && (
              <p className="text-xs text-surface-300">
                AniList ID: {anilistMatch.anilistId}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Import settings */}
      <div className="rounded-xl border border-surface-600 bg-surface-800 p-5 space-y-4">
        <h3 className="text-sm font-medium text-surface-50">Import Settings</h3>

        {/* Copy vs Move — only shown for filesystem imports */}
        {analysis.sourceType !== "upload" && (
          <div className="space-y-2">
            <label className="text-xs text-surface-300">File handling</label>
            <div className="flex gap-3">
              <label
                className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  mode === "copy"
                    ? "border-accent-400/40 bg-accent-400/5"
                    : "border-surface-600 hover:border-surface-500"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value="copy"
                  checked={mode === "copy"}
                  onChange={() => onModeChange("copy")}
                  className="h-4 w-4 text-accent-400 focus:ring-accent-400/50"
                />
                <div>
                  <p className="text-sm font-medium text-surface-50">Copy</p>
                  <p className="text-xs text-surface-300">
                    Keep original files in place
                  </p>
                </div>
              </label>
              <label
                className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  mode === "move"
                    ? "border-accent-400/40 bg-accent-400/5"
                    : "border-surface-600 hover:border-surface-500"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value="move"
                  checked={mode === "move"}
                  onChange={() => onModeChange("move")}
                  className="h-4 w-4 text-accent-400 focus:ring-accent-400/50"
                />
                <div>
                  <p className="text-sm font-medium text-surface-50">Move</p>
                  <p className="text-xs text-surface-300">
                    Delete originals after import
                  </p>
                </div>
              </label>
            </div>
            {mode === "move" && (
              <p className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-400">
                Original files will be permanently deleted after a successful
                import.
              </p>
            )}
          </div>
        )}

        {/* Manager integration */}
        {anilistMatch && (
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={addToManager}
                onChange={(e) => onAddToManagerChange(e.target.checked)}
                className="h-4 w-4 rounded border-surface-500 bg-surface-700 text-accent-400 focus:ring-accent-400/50"
              />
              <div>
                <p className="text-sm text-surface-50">Add to manager</p>
                <p className="text-xs text-surface-300">
                  Track this manga in the manager for future volume monitoring
                </p>
              </div>
            </label>

            {addToManager && (
              <label className="ml-7 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={monitor}
                  onChange={(e) => onMonitorChange(e.target.checked)}
                  className="h-4 w-4 rounded border-surface-500 bg-surface-700 text-accent-400 focus:ring-accent-400/50"
                />
                <div>
                  <p className="text-sm text-surface-50">
                    Monitor for new volumes
                  </p>
                  <p className="text-xs text-surface-300">
                    Automatically check for missing volumes periodically
                  </p>
                </div>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Skipped volumes */}
      {toSkip.length > 0 && (
        <div className="rounded-xl border border-surface-600 bg-surface-800 p-4">
          <h4 className="text-xs font-medium text-surface-300 mb-2">
            Skipping {toSkip.length} volume{toSkip.length !== 1 ? "s" : ""}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {toSkip.map((v) => (
              <span
                key={v.id}
                className="rounded bg-surface-700 px-2 py-0.5 text-xs text-surface-300"
              >
                v{String(v.volumeNumber).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Replace warning */}
      {toReplace.length > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
          <h4 className="text-xs font-medium text-yellow-400 mb-2">
            Replacing {toReplace.length} existing volume
            {toReplace.length !== 1 ? "s" : ""}
          </h4>
          <p className="text-xs text-yellow-400/80">
            Existing volumes will be moved to a trash folder before replacement.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {toReplace.map((v) => (
              <span
                key={v.id}
                className="rounded bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-400"
              >
                v{String(v.volumeNumber).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Import button */}
      <div className="flex justify-end">
        <button
          onClick={onConfirm}
          disabled={importVolumes.length === 0}
          className="rounded-lg bg-accent-400 px-8 py-3 text-sm font-semibold text-surface-900 transition-colors hover:bg-accent-300 disabled:opacity-50"
        >
          Import {importVolumes.length} volume
          {importVolumes.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
