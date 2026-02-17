"use client";

import { useState, useEffect, useCallback } from "react";
import { HealthBanner } from "./HealthBanner";
import { ServiceCard } from "./ServiceCard";
import { TaskTable } from "./TaskTable";
import { DiskUsage } from "./DiskUsage";
import { StatsGrid } from "./StatsGrid";
import { SystemAbout } from "./SystemAbout";

interface SystemStatus {
  services: {
    deluge: ServiceStatus;
    jackett: ServiceStatus;
    anilist: ServiceStatus;
  };
  disk: {
    library: DiskInfo;
    database: { path: string; sizeBytes: number };
    staging: { path: string; activeSessions: number; totalSizeBytes: number };
    downloads?: { freeBytes: number };
  };
  database: DatabaseStats;
  tasks: TaskState[];
  system: SystemInfo;
  health: HealthCheck[];
  version: VersionCheckResult;
}

export interface ServiceStatus {
  name: string;
  status: "connected" | "unreachable" | "error" | "degraded";
  message?: string;
  responseTimeMs?: number;
  version?: string;
  details?: Record<string, unknown>;
  lastChecked: string;
}

export interface DiskInfo {
  path: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  libraryBytes: number;
  percentUsed: number;
}

export interface DatabaseStats {
  manga: { total: number; withAnilistMatch: number; withoutMatch: number };
  volumes: { total: number; totalPages: number };
  managedManga: { total: number; monitored: number; unmonitored: number };
  managedVolumes: {
    total: number;
    imported: number;
    missing: number;
    downloading: number;
    failed: number;
  };
  users: { total: number; admins: number };
  imports: { total: number; lastImportAt: string | null };
}

export interface TaskState {
  name: string;
  description: string;
  intervalMs: number;
  enabled: boolean;
  status: "idle" | "running" | "disabled";
  lastRun?: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
    result: string;
    success: boolean;
    error?: string;
  };
  nextRun?: string;
}

export interface SystemInfo {
  version: string;
  commitSha: string | null;
  buildDate: string | null;
  nodeVersion: string;
  platform: string;
  architecture: string;
  uptime: number;
  startedAt: string;
  environment: string;
  docker: boolean;
  config: Record<string, unknown>;
}

export interface VersionCheckResult {
  current: {
    commitSha: string;
    shortSha: string;
    buildDate: string | null;
  } | null;
  latest: {
    commitSha: string;
    shortSha: string;
  } | null;
  updateAvailable: boolean | null;
  checkedAt: string | null;
}

export interface HealthCheck {
  id: string;
  severity: "error" | "warning" | "info";
  category: string;
  title: string;
  message: string;
}

export function StatusPage() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async (force = false) => {
    try {
      const url = force
        ? "/api/system/status?force=true"
        : "/api/system/status";
      const res = await fetch(url);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently fail — existing data remains
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      await fetchStatus();
      if (mounted) setLoading(false);
    }
    init();
    const interval = setInterval(() => fetchStatus(), 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchStatus]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStatus(true);
    setRefreshing(false);
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">System Status</h1>
        </div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-surface-700"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">System Status</h1>
        <div className="rounded-lg border border-surface-600 bg-surface-700 p-6 text-center text-surface-200">
          Failed to load system status. Check the server logs.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">System Status</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-md border border-surface-500 px-3 py-1.5 text-sm text-surface-200 transition-colors hover:bg-surface-700 hover:text-surface-50 disabled:opacity-50"
        >
          <svg
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Health Checks */}
      <HealthBanner checks={data.health} />

      {/* Services */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-surface-100">Services</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ServiceCard service={data.services.deluge} />
          <ServiceCard service={data.services.jackett} />
          <ServiceCard service={data.services.anilist} />
        </div>
      </section>

      {/* Background Tasks */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-surface-100">
          Background Tasks
        </h2>
        <TaskTable tasks={data.tasks} onRefresh={() => fetchStatus(true)} />
      </section>

      {/* Storage */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-surface-100">Storage</h2>
        <DiskUsage disk={data.disk} />
      </section>

      {/* Library Stats */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-surface-100">
          Library Statistics
        </h2>
        <StatsGrid stats={data.database} />
      </section>

      {/* System About */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-surface-100">About</h2>
        <SystemAbout system={data.system} versionCheck={data.version} />
      </section>
    </div>
  );
}
