"use client";

import { useState } from "react";

export function ScanButton() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleScan() {
    setScanning(true);
    setResult(null);
    try {
      const res = await fetch("/api/library/scan", { method: "POST" });
      const data = await res.json();
      setResult(`+${data.added} added, ${data.updated} updated`);
      setTimeout(() => {
        setResult(null);
        window.location.reload();
      }, 1500);
    } catch {
      setResult("Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-xs text-surface-200 animate-in fade-in">
          {result}
        </span>
      )}
      <button
        onClick={handleScan}
        disabled={scanning}
        className="rounded-md bg-surface-600 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {scanning ? "Scanning..." : "Scan Library"}
      </button>
    </div>
  );
}
