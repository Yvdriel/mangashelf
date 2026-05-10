"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { updateProgress, getPageImageUrl } from "@/lib/api";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  OcrOverlay,
  type MokuroBlock,
  type MokuroFile,
} from "@/components/ocr-overlay";
import { useAnki, SendError, formatSendError } from "@/hooks/use-anki";
import {
  AnkiCardDialog,
  type AnkiCardDialogTarget,
} from "@/components/anki-card-dialog";

interface ReaderProps {
  mangaId: number;
  mangaTitle: string;
  volumeNumber: number;
  volumeId: number;
  pageCount: number;
  startPage: number;
  nextVolumeNumber: number | null;
  prevVolumeNumber: number | null;
  ocrEnabled: boolean;
  textViewEnabled: boolean;
}

const WINDOW_SIZE = 5;
const PROGRESS_DEBOUNCE_MS = 500;
const OVERLAY_HIDE_DELAY = 2000;

export function Reader({
  mangaId,
  mangaTitle,
  volumeNumber,
  volumeId,
  pageCount,
  startPage,
  nextVolumeNumber,
  prevVolumeNumber,
  ocrEnabled,
  textViewEnabled,
}: ReaderProps) {
  const router = useRouter();
  const { enabled: ankiEnabled, sendCard, settings: ankiSettings } = useAnki();
  const [currentPage, setCurrentPage] = useState(startPage);
  const [showOverlay, setShowOverlay] = useState(true);
  const [ocrData, setOcrData] = useState<MokuroFile | null>(null);
  const [ocrDebug, setOcrDebug] = useState(false);
  const [ankiTarget, setAnkiTarget] = useState<AnkiCardDialogTarget | null>(
    null,
  );
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const initialScrollDone = useRef(false);
  const lastSavedPage = useRef(-1);

  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, i) => i),
    [pageCount],
  );

  // Debounced progress save
  const saveProgress = useCallback(
    (page: number) => {
      if (page === lastSavedPage.current) return;
      clearTimeout(progressTimerRef.current);
      progressTimerRef.current = setTimeout(() => {
        lastSavedPage.current = page;
        updateProgress(mangaId, volumeId, page);
      }, PROGRESS_DEBOUNCE_MS);
    },
    [mangaId, volumeId],
  );

  // IntersectionObserver for page tracking
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let visiblePage = -1;

        for (const entry of entries) {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            visiblePage = Number(entry.target.getAttribute("data-page"));
          }
        }

        if (maxRatio > 0.5 && visiblePage >= 0) {
          setCurrentPage(visiblePage);
          saveProgress(visiblePage);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1.0] },
    );

    return () => observerRef.current?.disconnect();
  }, [saveProgress]);

  // Observe page elements as they mount
  const setPageRef = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(page, el);
      observerRef.current?.observe(el);
    } else {
      const prev = pageRefs.current.get(page);
      if (prev) observerRef.current?.unobserve(prev);
      pageRefs.current.delete(page);
    }
  }, []);

  // Scroll to initial position
  useEffect(() => {
    if (initialScrollDone.current || startPage === 0) {
      initialScrollDone.current = true;
      return;
    }

    const timer = setTimeout(() => {
      const el = pageRefs.current.get(startPage);
      if (el) {
        el.scrollIntoView({ behavior: "instant" as ScrollBehavior });
        initialScrollDone.current = true;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [startPage]);

  // Overlay auto-hide
  useEffect(() => {
    function resetOverlayTimer() {
      setShowOverlay(true);
      clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = setTimeout(
        () => setShowOverlay(false),
        OVERLAY_HIDE_DELAY,
      );
    }

    resetOverlayTimer();

    return () => clearTimeout(overlayTimerRef.current);
  }, []);

  const handleTap = useCallback(() => {
    setShowOverlay(true);
    clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(
      () => setShowOverlay(false),
      OVERLAY_HIDE_DELAY,
    );
  }, []);

  const handleBlockSelect = useCallback(
    async (block: MokuroBlock, _idx: number, pageIdx: number) => {
      if (ankiSettings.showPreviewDialog) {
        setAnkiTarget({ block, pageIdx });
        return;
      }
      const blockText = block.lines.join("");
      const id = toast.loading("Sending to Anki…");
      try {
        const result = await sendCard({
          mangaId,
          volumeNumber,
          mangaTitle,
          pageIdx,
          blockText,
          blockBox: block.box,
        });
        toast.success(
          result.mode === "create"
            ? `Card added to ${result.deck}`
            : `Updated last card in ${result.deck}`,
          { id },
        );
      } catch (err) {
        const message =
          err instanceof SendError ? formatSendError(err) : String(err);
        toast.error(message, { id, duration: 8000 });
      }
    },
    [
      ankiSettings.showPreviewDialog,
      mangaId,
      volumeNumber,
      mangaTitle,
      sendCard,
    ],
  );

  // Fetch OCR JSON once per volume when OCR is enabled. The reader is a fresh
  // route render whenever the user navigates here, so `ocrEnabled` is stable
  // for the component lifetime.
  useEffect(() => {
    if (!ocrEnabled) return;
    let cancelled = false;
    fetch(`/api/manga/${mangaId}/volume/${volumeNumber}/ocr`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setOcrData(data as MokuroFile | null);
      })
      .catch(() => {
        // leave ocrData as-is; reader silently degrades.
      });
    return () => {
      cancelled = true;
    };
  }, [ocrEnabled, mangaId, volumeNumber]);

  // Keyboard: Escape to exit
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        router.push(`/manga/${mangaId}`);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mangaId, router]);

  // Windowed rendering range
  const renderStart = Math.max(0, currentPage - WINDOW_SIZE);
  const renderEnd = Math.min(pageCount - 1, currentPage + WINDOW_SIZE);

  return (
    <div
      ref={containerRef}
      data-theme="dark"
      className="fixed top-0 right-0 left-0 z-50 overflow-y-auto bg-surface-900"
      style={{ bottom: "calc(-1 * env(safe-area-inset-bottom, 0px))" }}
      onClick={handleTap}
    >
      {/* Top overlay */}
      <div
        className={`sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] transition-opacity duration-300 ${
          showOverlay
            ? "bg-surface-900/80 backdrop-blur-sm opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/manga/${mangaId}`);
          }}
          className="flex items-center gap-2 text-sm text-surface-200 hover:text-surface-50 transition-colors cursor-pointer"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {mangaTitle}
        </button>
        <div className="flex items-center gap-3">
          {ocrEnabled && ocrData && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOcrDebug((v) => !v);
              }}
              title={ocrDebug ? "Hide OCR text" : "Show OCR text"}
              className={`text-xs px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                ocrDebug
                  ? "border-accent-400 bg-accent-400/15 text-accent-200"
                  : "border-surface-500 text-surface-300 hover:text-surface-100 hover:border-surface-400"
              }`}
            >
              OCR
            </button>
          )}
          {textViewEnabled && (
            <Link
              href={`/manga/${mangaId}/volume/${volumeNumber}/text`}
              onClick={(e) => e.stopPropagation()}
              title="Open text-only view (Yomitan-friendly)"
              className="text-xs px-2 py-0.5 rounded border border-surface-500 text-surface-300 hover:text-surface-100 hover:border-surface-400 transition-colors"
            >
              Text
            </Link>
          )}
          <span className="text-xs text-surface-300">
            Vol {volumeNumber} &middot; {currentPage + 1} / {pageCount}
          </span>
        </div>
      </div>

      {/* Page container */}
      <div className="mx-auto max-w-4xl">
        {pages.map((pageIdx) => {
          const inRange = pageIdx >= renderStart && pageIdx <= renderEnd;

          return (
            <div
              key={pageIdx}
              data-page={pageIdx}
              ref={(el) => setPageRef(pageIdx, el)}
              className="relative w-full"
            >
              {inRange ? (
                <div
                  className="relative w-full"
                  style={{ containerType: "inline-size" }}
                >
                  <Image
                    src={getPageImageUrl(mangaId, volumeNumber, pageIdx)}
                    alt={`Page ${pageIdx + 1}`}
                    width={800}
                    height={1200}
                    unoptimized
                    className="w-full h-auto block"
                  />
                  {ocrEnabled && ocrData?.pages?.[pageIdx] && (
                    <OcrOverlay
                      page={ocrData.pages[pageIdx]}
                      debugVisible={ocrDebug}
                      onBlockSelect={
                        ankiEnabled
                          ? (b, idx) => handleBlockSelect(b, idx, pageIdx)
                          : undefined
                      }
                    />
                  )}
                </div>
              ) : (
                <div className="aspect-2/3 w-full bg-surface-800" />
              )}
            </div>
          );
        })}

        {/* End of volume */}
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-surface-200">End of Volume {volumeNumber}</p>
          {nextVolumeNumber !== null ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/manga/${mangaId}/read/${nextVolumeNumber}`);
              }}
              className="rounded-md bg-accent-400 px-6 py-2.5 text-sm font-medium text-surface-900 transition-colors hover:bg-accent-300 cursor-pointer"
            >
              Next Volume &rarr; Vol {nextVolumeNumber}
            </button>
          ) : (
            <p className="text-sm text-surface-300">
              You&apos;ve reached the last volume.
            </p>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/manga/${mangaId}`);
            }}
            className="text-sm text-surface-300 hover:text-surface-100 transition-colors cursor-pointer"
          >
            Back to details
          </button>
        </div>
      </div>

      {/* Bottom progress bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] bg-surface-600 transition-opacity duration-300 ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="h-0.5 w-full">
          <div
            className="h-full bg-accent-400 transition-all duration-150"
            style={{
              width: `${pageCount > 1 ? (currentPage / (pageCount - 1)) * 100 : 100}%`,
            }}
          />
        </div>
      </div>

      <AnkiCardDialog
        open={ankiTarget !== null}
        target={ankiTarget}
        mangaId={mangaId}
        volumeNumber={volumeNumber}
        mangaTitle={mangaTitle}
        onClose={() => setAnkiTarget(null)}
      />
    </div>
  );
}
