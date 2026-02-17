"use client";

import type { DetectedVolume } from "@/lib/import-types";

interface VolumeConfig {
  id: string;
  volumeNumber: number;
  action: "import" | "skip" | "replace";
  included: boolean;
}

interface VolumePreviewCardProps {
  volume: DetectedVolume;
  config: VolumeConfig;
  onConfigChange: (config: VolumeConfig) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function VolumePreviewCard({
  volume,
  config,
  onConfigChange,
}: VolumePreviewCardProps) {
  const status =
    volume.pageCount === 0
      ? "empty"
      : volume.existsInLibrary
        ? "exists"
        : config.volumeNumber === 0
          ? "unmapped"
          : "ready";

  const statusConfig = {
    ready: {
      badge: "Ready",
      badgeClass: "bg-green-500/15 text-green-400",
    },
    exists: {
      badge: `Exists (${volume.existingPageCount ?? "?"} pages)`,
      badgeClass: "bg-yellow-500/15 text-yellow-400",
    },
    unmapped: {
      badge: "No volume #",
      badgeClass: "bg-orange-500/15 text-orange-400",
    },
    empty: {
      badge: "No images",
      badgeClass: "bg-red-500/15 text-red-400",
    },
  }[status];

  return (
    <div
      className={`rounded-lg border bg-surface-800 transition-opacity ${
        config.included ? "border-surface-600" : "border-surface-700 opacity-50"
      }`}
    >
      <div className="p-3 space-y-3">
        {/* Header: checkbox, volume number, status */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.included}
              onChange={(e) =>
                onConfigChange({ ...config, included: e.target.checked })
              }
              className="h-4 w-4 rounded border-surface-500 bg-surface-700 text-accent-400 focus:ring-accent-400/50"
            />
          </label>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-surface-300">Vol</span>
              <input
                type="number"
                min={0}
                value={config.volumeNumber || ""}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    volumeNumber: parseInt(e.target.value, 10) || 0,
                  })
                }
                placeholder="#"
                className="w-14 rounded bg-surface-700 border border-surface-600 px-2 py-1 text-sm text-surface-50 text-center focus:border-accent-400/50 focus:outline-none"
              />
            </div>

            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusConfig.badgeClass}`}
            >
              {statusConfig.badge}
            </span>
          </div>

          {/* Conflict action for existing volumes */}
          {volume.existsInLibrary && config.included && (
            <select
              value={config.action}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  action: e.target.value as "import" | "skip" | "replace",
                })
              }
              className="rounded bg-surface-700 border border-surface-600 px-2 py-1 text-xs text-surface-200 focus:border-accent-400/50 focus:outline-none"
            >
              <option value="skip">Skip</option>
              <option value="replace">Replace</option>
            </select>
          )}
        </div>

        {/* Thumbnail previews */}
        {volume.previewPages.length > 0 && (
          <div className="flex gap-1.5">
            {volume.previewPages.map((url, i) => (
              <div
                key={i}
                className="relative aspect-[2/3] w-16 overflow-hidden rounded bg-surface-700"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Preview page ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-surface-300">
          <span>{volume.pageCount} pages</span>
          <span>{formatSize(volume.totalSizeBytes)}</span>
          <span
            className="truncate text-surface-400"
            title={volume.sourceLabel}
          >
            {volume.sourceLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
