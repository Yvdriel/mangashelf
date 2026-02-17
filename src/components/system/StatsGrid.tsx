"use client";

import type { DatabaseStats } from "./StatusPage";

interface StatsGridProps {
  stats: DatabaseStats;
}

interface StatCardProps {
  label: string;
  value: number | string;
  sublabel?: string;
}

function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <div className="rounded-lg border border-surface-600 bg-surface-700 px-4 py-3">
      <p className="text-2xl font-semibold text-surface-50">{value}</p>
      <p className="text-sm text-surface-300">{label}</p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-surface-400">{sublabel}</p>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <StatCard label="Manga" value={stats.manga.total} />
      <StatCard label="Volumes" value={stats.volumes.total} />
      <StatCard label="Pages" value={formatNumber(stats.volumes.totalPages)} />
      <StatCard
        label="Managed"
        value={stats.managedManga.total}
        sublabel={`${stats.managedManga.monitored} monitored`}
      />
      <StatCard label="Missing" value={stats.managedVolumes.missing} />
      <StatCard label="Downloading" value={stats.managedVolumes.downloading} />
      <StatCard
        label="Users"
        value={stats.users.total}
        sublabel={`${stats.users.admins} admin${stats.users.admins !== 1 ? "s" : ""}`}
      />
    </div>
  );
}
