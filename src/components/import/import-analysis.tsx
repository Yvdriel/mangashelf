"use client";

import { useState, useEffect, useCallback } from "react";
import { VolumePreviewCard } from "./volume-preview-card";
import type { ImportAnalysis } from "@/lib/import-types";

interface VolumeConfig {
  id: string;
  volumeNumber: number;
  action: "import" | "skip" | "replace";
  included: boolean;
}

interface AniListMatch {
  anilistId: number;
  title: string;
  coverUrl: string;
  totalVolumes: number | null;
}

interface AniListSearchResult {
  id: number;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  coverImage: {
    large: string | null;
    extraLarge: string | null;
  };
  volumes: number | null;
  status: string | null;
  averageScore: number | null;
}

interface ImportAnalysisViewProps {
  analysis: ImportAnalysis;
  volumeConfigs: VolumeConfig[];
  onVolumeConfigsChange: (configs: VolumeConfig[]) => void;
  anilistMatch: AniListMatch | null;
  onAnilistMatchChange: (match: AniListMatch | null) => void;
  manualTitle: string;
  onManualTitleChange: (title: string) => void;
  onContinue: () => void;
  canContinue: boolean;
}

export function ImportAnalysisView({
  analysis,
  volumeConfigs,
  onVolumeConfigsChange,
  anilistMatch,
  onAnilistMatchChange,
  manualTitle,
  onManualTitleChange,
  onContinue,
  canContinue,
}: ImportAnalysisViewProps) {
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AniListSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [useManualTitle, setUseManualTitle] = useState(!anilistMatch);

  // Debounced AniList search
  useEffect(() => {
    if (!searchMode || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/manager/search?q=${encodeURIComponent(searchQuery)}`,
        );
        if (res.ok) {
          setSearchResults(await res.json());
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode]);

  const handleSelectAnilist = useCallback(
    (result: AniListSearchResult) => {
      onAnilistMatchChange({
        anilistId: result.id,
        title:
          result.title.romaji ||
          result.title.english ||
          result.title.native ||
          "",
        coverUrl: result.coverImage.extraLarge || result.coverImage.large || "",
        totalVolumes: result.volumes,
      });
      onManualTitleChange(
        result.title.romaji ||
          result.title.english ||
          result.title.native ||
          "",
      );
      setSearchMode(false);
      setUseManualTitle(false);
    },
    [onAnilistMatchChange, onManualTitleChange],
  );

  const handleVolumeConfigChange = useCallback(
    (updated: VolumeConfig) => {
      onVolumeConfigsChange(
        volumeConfigs.map((v) => (v.id === updated.id ? updated : v)),
      );
    },
    [volumeConfigs, onVolumeConfigsChange],
  );

  const importableCount = volumeConfigs.filter(
    (v) => v.included && v.volumeNumber > 0,
  ).length;

  return (
    <div className="space-y-6">
      {/* AniList match section */}
      <div className="rounded-xl border border-surface-600 bg-surface-800 p-4">
        {searchMode ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-surface-50">
                Search AniList
              </h3>
              <button
                onClick={() => setSearchMode(false)}
                className="text-xs text-surface-300 hover:text-surface-100"
              >
                Cancel
              </button>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for manga..."
              autoFocus
              className="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-surface-50 placeholder:text-surface-400 focus:border-accent-400/50 focus:outline-none"
            />
            {searching && (
              <p className="text-xs text-surface-300">Searching...</p>
            )}
            {searchResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectAnilist(result)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-700"
                  >
                    {(result.coverImage.large ||
                      result.coverImage.extraLarge) && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={
                          result.coverImage.large ||
                          result.coverImage.extraLarge ||
                          ""
                        }
                        alt=""
                        className="h-12 w-8 rounded object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-50 truncate">
                        {result.title.romaji || result.title.english}
                      </p>
                      <p className="text-xs text-surface-300">
                        {result.volumes ? `${result.volumes} volumes` : ""}
                        {result.volumes && result.status ? " · " : ""}
                        {result.status}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : anilistMatch && !useManualTitle ? (
          <div className="flex items-center gap-4">
            {anilistMatch.coverUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={anilistMatch.coverUrl}
                alt=""
                className="h-20 w-14 rounded-lg object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-surface-300">AniList Match</p>
              <p className="text-base font-medium text-surface-50 truncate">
                {anilistMatch.title}
              </p>
              <p className="text-xs text-surface-300 mt-0.5">
                {anilistMatch.totalVolumes
                  ? `${anilistMatch.totalVolumes} volumes`
                  : "Volume count unknown"}
              </p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => {
                  setSearchMode(true);
                  setSearchQuery(anilistMatch.title);
                }}
                className="rounded border border-surface-500 px-2.5 py-1 text-xs text-surface-200 hover:bg-surface-700 transition-colors"
              >
                Change
              </button>
              <button
                onClick={() => {
                  setUseManualTitle(true);
                  onAnilistMatchChange(null);
                }}
                className="rounded px-2.5 py-1 text-xs text-surface-300 hover:text-surface-100 transition-colors"
              >
                Use custom title
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-surface-50">
                Manga Title
              </h3>
              <button
                onClick={() => {
                  setSearchMode(true);
                  setSearchQuery(manualTitle);
                }}
                className="text-xs text-accent-300 hover:text-accent-200 transition-colors"
              >
                Search AniList
              </button>
            </div>
            <input
              type="text"
              value={manualTitle}
              onChange={(e) => onManualTitleChange(e.target.value)}
              placeholder="Enter manga title..."
              className="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-surface-50 placeholder:text-surface-400 focus:border-accent-400/50 focus:outline-none"
            />
            <p className="text-xs text-surface-400">
              Import without AniList metadata. You can link it later from the
              manager.
            </p>
          </div>
        )}
      </div>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="space-y-2">
          {analysis.warnings
            .filter(
              (w) =>
                w.type === "archive_extraction_failed" ||
                w.type === "no_images_found",
            )
            .map((w, i) => (
              <div
                key={i}
                className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-400"
              >
                {w.message}
              </div>
            ))}
        </div>
      )}

      {/* Volume grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-surface-50">
            Detected Volumes ({analysis.volumes.length})
          </h3>
          <span className="text-xs text-surface-300">
            {importableCount} selected for import
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {analysis.volumes.map((volume) => {
            const config = volumeConfigs.find((v) => v.id === volume.id);
            if (!config) return null;
            return (
              <VolumePreviewCard
                key={volume.id}
                volume={volume}
                config={config}
                onConfigChange={handleVolumeConfigChange}
              />
            );
          })}
        </div>
      </div>

      {/* Continue button */}
      <div className="flex justify-end">
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="rounded-lg bg-accent-400 px-6 py-2.5 text-sm font-medium text-surface-900 transition-colors hover:bg-accent-300 disabled:opacity-50"
        >
          Continue with {importableCount} volume
          {importableCount !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
