"use client";

import { useState, useCallback } from "react";
import type { TaskState } from "./StatusPage";

interface TaskTableProps {
  tasks: TaskState[];
  onRefresh: () => void;
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);

  const seconds = Math.floor(abs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let label: string;
  if (days > 0) label = `${days}d`;
  else if (hours > 0) label = `${hours}h`;
  else if (minutes > 0) label = `${minutes}m`;
  else label = `${seconds}s`;

  return future ? `in ${label}` : `${label} ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

const statusDot: Record<string, string> = {
  idle: "bg-green-500",
  running: "bg-blue-500 animate-pulse",
  disabled: "bg-surface-400",
};

const taskDisplayNames: Record<string, string> = {
  "library-scan": "Library Scan",
  "monitoring-cycle": "Monitoring Cycle",
  "download-progress": "Download Progress",
  "auto-import": "Auto Import",
  "staging-cleanup": "Staging Cleanup",
};

export function TaskTable({ tasks, onRefresh }: TaskTableProps) {
  const [runningTask, setRunningTask] = useState<string | null>(null);

  const handleRunNow = useCallback(
    async (taskName: string) => {
      setRunningTask(taskName);
      try {
        await fetch(`/api/system/tasks/${taskName}/run`, { method: "POST" });
        // Wait a moment for the task to start, then refresh
        setTimeout(onRefresh, 1000);
      } catch {
        // Ignore
      } finally {
        setRunningTask(null);
      }
    },
    [onRefresh],
  );

  // Filter out high-frequency tasks from the main display
  const displayTasks = tasks.filter((t) => t.name !== "download-progress");

  return (
    <div className="overflow-x-auto rounded-lg border border-surface-600 bg-surface-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-600 text-left text-surface-300">
            <th className="px-4 py-3 font-medium">Task</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">
              Last Run
            </th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">
              Duration
            </th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">
              Next Run
            </th>
            <th className="hidden px-4 py-3 font-medium lg:table-cell">
              Result
            </th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-600">
          {displayTasks.map((task) => (
            <tr key={task.name} className="text-surface-200">
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium text-surface-50">
                    {taskDisplayNames[task.name] || task.name}
                  </p>
                  <p className="text-xs text-surface-300 hidden sm:block">
                    {task.description}
                  </p>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      task.status === "running"
                        ? statusDot.running
                        : task.lastRun && !task.lastRun.success
                          ? "bg-red-500"
                          : statusDot[task.status] || statusDot.idle
                    }`}
                  />
                  <span className="capitalize">
                    {task.status === "idle" &&
                    task.lastRun &&
                    !task.lastRun.success
                      ? "Failed"
                      : task.status}
                  </span>
                </div>
              </td>
              <td
                className="hidden px-4 py-3 sm:table-cell"
                title={
                  task.lastRun?.completedAt
                    ? new Date(task.lastRun.completedAt).toLocaleString()
                    : undefined
                }
              >
                {task.lastRun
                  ? relativeTime(task.lastRun.completedAt)
                  : "Never"}
              </td>
              <td className="hidden px-4 py-3 md:table-cell">
                {task.lastRun ? formatDuration(task.lastRun.durationMs) : "-"}
              </td>
              <td
                className="hidden px-4 py-3 sm:table-cell"
                title={
                  task.nextRun
                    ? new Date(task.nextRun).toLocaleString()
                    : undefined
                }
              >
                {task.nextRun ? relativeTime(task.nextRun) : "-"}
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">
                {task.lastRun ? (
                  <span
                    className={`text-xs ${task.lastRun.success ? "text-surface-300" : "text-red-400"}`}
                    title={task.lastRun.result}
                  >
                    {task.lastRun.result.length > 60
                      ? task.lastRun.result.slice(0, 60) + "..."
                      : task.lastRun.result}
                  </span>
                ) : (
                  <span className="text-xs text-surface-300">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleRunNow(task.name)}
                  disabled={
                    task.status === "running" || runningTask === task.name
                  }
                  className="rounded px-2.5 py-1 text-xs font-medium text-accent-300 transition-colors hover:bg-accent-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {runningTask === task.name ? "Starting..." : "Run Now"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
