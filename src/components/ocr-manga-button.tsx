"use client";

import { useEffect, useRef, useState } from "react";

interface Summary {
  total: number;
  ready: number;
  queued: number;
  running: number;
  failed: number;
}

interface OcrMangaButtonProps {
  mangaId: number;
  initialSummary: Summary;
}

export function OcrMangaButton({
  mangaId,
  initialSummary,
}: OcrMangaButtonProps) {
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inFlight = summary.queued > 0 || summary.running > 0;

  useEffect(() => {
    if (!inFlight) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/manga/${mangaId}/ocr`);
        if (res.ok) {
          const data = (await res.json()) as Summary;
          setSummary(data);
        }
      } catch {
        // ignore transient errors
      }
    }, 5000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [inFlight, mangaId]);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/manga/${mangaId}/ocr`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) setSummary(data.summary as Summary);
      }
    } finally {
      setBusy(false);
    }
  }

  const allReady = summary.total > 0 && summary.ready === summary.total;
  let label: string;
  if (allReady) {
    label = `All ${summary.total} volumes OCR'd`;
  } else if (inFlight) {
    label = `OCR'ing ${summary.ready}/${summary.total}${
      summary.queued + summary.running > 0
        ? ` · ${summary.queued + summary.running} queued`
        : ""
    }`;
  } else if (summary.failed > 0) {
    label = `OCR ${summary.ready}/${summary.total} (${summary.failed} failed) · Retry`;
  } else {
    label = summary.ready > 0
      ? `OCR remaining ${summary.total - summary.ready} volumes`
      : "OCR all volumes";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || allReady}
      title="Run mokuro OCR over every volume of this manga (low priority)"
      className={`inline-flex w-fit items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
        allReady
          ? "cursor-default border-surface-600 bg-surface-700 text-surface-300"
          : "cursor-pointer border-surface-500 bg-surface-700 text-surface-100 hover:border-accent-400 hover:text-accent-200"
      } ${busy ? "opacity-60" : ""}`}
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
          d="M4 7h16M4 12h16M4 17h10"
        />
      </svg>
      {label}
    </button>
  );
}
