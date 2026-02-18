"use client";

import { useState } from "react";
import type { HealthCheck } from "./StatusPage";

interface HealthBannerProps {
  checks: HealthCheck[];
}

const DISMISS_KEY = "mangashelf-dismissed-health-checks";

function getDismissedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    // Reset daily
    if (parsed.date !== new Date().toDateString()) return new Set();
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function setDismissedIds(ids: Set<string>) {
  try {
    localStorage.setItem(
      DISMISS_KEY,
      JSON.stringify({ date: new Date().toDateString(), ids: [...ids] }),
    );
  } catch {
    // Ignore
  }
}

const severityConfig = {
  error: {
    border: "border-l-red-500",
    bg: "bg-red-500/5",
    icon: (
      <svg
        className="h-5 w-5 shrink-0 text-red-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
  warning: {
    border: "border-l-yellow-500",
    bg: "bg-yellow-500/5",
    icon: (
      <svg
        className="h-5 w-5 shrink-0 text-yellow-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  info: {
    border: "border-l-blue-500",
    bg: "bg-blue-500/5",
    icon: (
      <svg
        className="h-5 w-5 shrink-0 text-blue-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
};

export function HealthBanner({ checks }: HealthBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    typeof window !== "undefined" ? getDismissedIds() : new Set(),
  );

  const visibleChecks = checks.filter(
    (c) => !(c.severity === "info" && dismissed.has(c.id)),
  );

  if (visibleChecks.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
        <svg
          className="h-5 w-5 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm font-medium text-green-300">
          All systems operational
        </span>
      </div>
    );
  }

  function handleDismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    setDismissedIds(next);
  }

  return (
    <div className="space-y-2">
      {visibleChecks.map((check) => {
        const config = severityConfig[check.severity];
        return (
          <div
            key={check.id}
            className={`flex items-start gap-3 rounded-lg border border-surface-600 border-l-4 ${config.border} ${config.bg} px-4 py-3`}
          >
            {config.icon}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-surface-50">
                {check.title}
              </p>
              <p className="mt-0.5 text-sm text-surface-200">{check.message}</p>
            </div>
            {check.severity === "info" && (
              <button
                onClick={() => handleDismiss(check.id)}
                className="shrink-0 text-surface-300 hover:text-surface-100"
                title="Dismiss"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
