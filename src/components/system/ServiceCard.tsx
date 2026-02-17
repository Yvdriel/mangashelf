"use client";

import { useState, useCallback } from "react";
import type { ServiceStatus } from "./StatusPage";

interface ServiceCardProps {
  service: ServiceStatus;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024)
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

const statusColors: Record<string, string> = {
  connected: "bg-green-500",
  unreachable: "bg-red-500",
  error: "bg-red-500",
  degraded: "bg-yellow-500",
};

const statusLabels: Record<string, string> = {
  connected: "Connected",
  unreachable: "Unreachable",
  error: "Error",
  degraded: "Degraded",
};

export function ServiceCard({ service }: ServiceCardProps) {
  const [testing, setTesting] = useState(false);
  const [current, setCurrent] = useState(service);

  // Update when parent data changes
  if (service.lastChecked !== current.lastChecked && !testing) {
    setCurrent(service);
  }

  const handleTest = useCallback(async () => {
    setTesting(true);
    try {
      const res = await fetch(
        `/api/system/services/${current.name.toLowerCase()}/test`,
      );
      if (res.ok) {
        setCurrent(await res.json());
      }
    } catch {
      // Keep current state
    } finally {
      setTesting(false);
    }
  }, [current.name]);

  const details = current.details || {};

  return (
    <div className="rounded-lg border border-surface-600 bg-surface-700 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-3 w-3 rounded-full ${statusColors[current.status] || "bg-gray-500"}`}
          />
          <h3 className="font-medium text-surface-50">{current.name}</h3>
        </div>
        <button
          onClick={handleTest}
          disabled={testing}
          className="rounded px-2 py-1 text-xs text-surface-300 transition-colors hover:bg-surface-600 hover:text-surface-100 disabled:opacity-50"
        >
          {testing ? "Testing..." : "Test"}
        </button>
      </div>

      {/* Status line */}
      <div className="mb-3 flex items-center gap-3 text-sm">
        <span
          className={
            current.status === "connected"
              ? "text-green-400"
              : current.status === "degraded"
                ? "text-yellow-400"
                : "text-red-400"
          }
        >
          {statusLabels[current.status]}
        </span>
        {current.responseTimeMs !== undefined && (
          <span className="text-surface-300">{current.responseTimeMs}ms</span>
        )}
        {current.version && (
          <span className="text-surface-300">v{current.version}</span>
        )}
      </div>

      {/* Error message */}
      {current.message && current.status !== "connected" && (
        <p className="mb-3 text-sm text-surface-300">{current.message}</p>
      )}

      {/* Service-specific details */}
      <div className="space-y-1.5 text-sm text-surface-200">
        {current.name === "Deluge" && current.status === "connected" && (
          <>
            {details.freeBytes != null && (
              <div className="flex justify-between">
                <span className="text-surface-300">Free space</span>
                <span>{formatBytes(details.freeBytes as number)}</span>
              </div>
            )}
            {details.activeTorrents != null && (
              <div className="flex justify-between">
                <span className="text-surface-300">Active torrents</span>
                <span>{details.activeTorrents as number}</span>
              </div>
            )}
            {(details.downloadSpeed as number) > 0 && (
              <div className="flex justify-between">
                <span className="text-surface-300">Download</span>
                <span>{formatSpeed(details.downloadSpeed as number)}</span>
              </div>
            )}
            {(details.uploadSpeed as number) > 0 && (
              <div className="flex justify-between">
                <span className="text-surface-300">Upload</span>
                <span>{formatSpeed(details.uploadSpeed as number)}</span>
              </div>
            )}
          </>
        )}

        {current.name === "Jackett" && current.status !== "unreachable" && (
          <>
            {details.configuredIndexers != null && (
              <div className="flex justify-between">
                <span className="text-surface-300">Indexers</span>
                <span>{details.configuredIndexers as number} configured</span>
              </div>
            )}
          </>
        )}

        {current.name === "AniList" && current.status !== "unreachable" && (
          <>
            {details.rateLimitRemaining != null && (
              <div className="flex justify-between">
                <span className="text-surface-300">Rate limit</span>
                <span>
                  {details.rateLimitRemaining as number}
                  {details.rateLimitLimit
                    ? ` / ${details.rateLimitLimit}`
                    : ""}{" "}
                  remaining
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
