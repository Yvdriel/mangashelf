"use client";

import { useState, useEffect } from "react";

export function HealthBadge({ inline = false }: { inline?: boolean }) {
  const [counts, setCounts] = useState<{
    errors: number;
    warnings: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchHealth() {
      try {
        const res = await fetch("/api/system/health");
        if (res.ok && mounted) {
          const data = await res.json();
          setCounts(data.counts);
        }
      } catch {
        // Silently fail
      }
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!counts || (counts.errors === 0 && counts.warnings === 0)) {
    return null;
  }

  const total = counts.errors + counts.warnings;
  const color = counts.errors > 0 ? "bg-red-500" : "bg-yellow-500";

  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${color} ${inline ? "ml-auto" : "absolute -right-1 -top-1"}`}
    >
      {total}
    </span>
  );
}
