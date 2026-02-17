"use client";

import { useState, useCallback } from "react";
import type { SystemInfo, VersionCheckResult } from "./StatusPage";

interface SystemAboutProps {
  system: SystemInfo;
  versionCheck: VersionCheckResult;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(" ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function SystemAbout({ system, versionCheck }: SystemAboutProps) {
  const [vacuuming, setVacuuming] = useState(false);
  const [vacuumResult, setVacuumResult] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);
  const [confirmVacuum, setConfirmVacuum] = useState(false);

  const handleVacuum = useCallback(async () => {
    if (!confirmVacuum) {
      setConfirmVacuum(true);
      return;
    }
    setVacuuming(true);
    setConfirmVacuum(false);
    try {
      const res = await fetch("/api/system/database/vacuum", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setVacuumResult(
          data.savedBytes > 0
            ? `Saved ${formatBytes(data.savedBytes)}`
            : "No space reclaimed",
        );
      } else {
        setVacuumResult("Failed");
      }
    } catch {
      setVacuumResult("Failed");
    } finally {
      setVacuuming(false);
      setTimeout(() => setVacuumResult(null), 5000);
    }
  }, [confirmVacuum]);

  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    try {
      const res = await fetch("/api/system/cleanup/staging", {
        method: "POST",
      });
      if (res.ok) {
        setCleanResult("Cleaned up");
      } else {
        setCleanResult("Failed");
      }
    } catch {
      setCleanResult("Failed");
    } finally {
      setCleaning(false);
      setTimeout(() => setCleanResult(null), 5000);
    }
  }, []);

  const config = system.config as Record<string, unknown>;

  return (
    <div className="rounded-lg border border-surface-600 bg-surface-700">
      {/* Info grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        <div>
          <p className="text-xs text-surface-300">Version</p>
          <div className="flex items-center gap-2">
            <p
              className="text-sm text-surface-50"
              title={system.commitSha ?? undefined}
            >
              {system.version}
            </p>
            {versionCheck.updateAvailable === true && (
              <a
                href="https://github.com/Yvdriel/mangashelf/pkgs/container/mangashelf"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[11px] font-medium text-yellow-300 transition-colors hover:bg-yellow-500/25"
                title={
                  versionCheck.latest
                    ? `Latest: ${versionCheck.latest.commitSha}`
                    : "A newer version is available"
                }
              >
                Update available
              </a>
            )}
            {versionCheck.updateAvailable === false && (
              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-300">
                Up to date
              </span>
            )}
            {versionCheck.updateAvailable === null && system.commitSha && (
              <span className="rounded-full bg-surface-500/30 px-2 py-0.5 text-[11px] font-medium text-surface-300">
                Unknown
              </span>
            )}
          </div>
        </div>
        {system.buildDate && (
          <div>
            <p className="text-xs text-surface-300">Build Date</p>
            <p className="text-sm text-surface-50">
              {new Date(system.buildDate).toLocaleDateString()}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-surface-300">Node.js</p>
          <p className="text-sm text-surface-50">{system.nodeVersion}</p>
        </div>
        <div>
          <p className="text-xs text-surface-300">Platform</p>
          <p className="text-sm text-surface-50">
            {system.platform} / {system.architecture}
          </p>
        </div>
        <div>
          <p className="text-xs text-surface-300">Uptime</p>
          <p className="text-sm text-surface-50">
            {formatUptime(system.uptime)}
          </p>
        </div>
        <div>
          <p className="text-xs text-surface-300">Started</p>
          <p className="text-sm text-surface-50">
            {new Date(system.startedAt).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-surface-300">Environment</p>
          <p className="text-sm text-surface-50">{system.environment}</p>
        </div>
        <div>
          <p className="text-xs text-surface-300">Docker</p>
          <p className="text-sm text-surface-50">
            {system.docker ? "Yes" : "No"}
          </p>
        </div>
        <div>
          <p className="text-xs text-surface-300">Auto Download</p>
          <p className="text-sm text-surface-50">
            {config.autoDownload ? "Enabled" : "Disabled"}
          </p>
        </div>
      </div>

      {/* Config details */}
      <div className="border-t border-surface-600 p-4">
        <p className="mb-2 text-xs font-medium text-surface-300">
          Configuration
        </p>
        <div className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <span className="text-surface-300">Manga Dir:</span>
            <span className="text-surface-200 truncate">
              {config.mangaDir as string}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-surface-300">Database:</span>
            <span className="text-surface-200 truncate">
              {config.dbPath as string}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-surface-300">Monitor Interval:</span>
            <span className="text-surface-200">
              {config.monitorInterval as number}s
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-surface-300">Import Interval:</span>
            <span className="text-surface-200">
              {config.downloadCheckInterval as number}s
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 border-t border-surface-600 p-4">
        <button
          onClick={handleCleanup}
          disabled={cleaning}
          className="rounded-md border border-surface-500 px-3 py-1.5 text-sm text-surface-200 transition-colors hover:bg-surface-600 hover:text-surface-50 disabled:opacity-50"
        >
          {cleaning
            ? "Cleaning..."
            : cleanResult
              ? cleanResult
              : "Clean Up Staging"}
        </button>

        <button
          onClick={handleVacuum}
          disabled={vacuuming}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
            confirmVacuum
              ? "border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/10"
              : "border-surface-500 text-surface-200 hover:bg-surface-600 hover:text-surface-50"
          }`}
        >
          {vacuuming
            ? "Running..."
            : vacuumResult
              ? vacuumResult
              : confirmVacuum
                ? "Click again to confirm"
                : "Vacuum Database"}
        </button>
      </div>
    </div>
  );
}
