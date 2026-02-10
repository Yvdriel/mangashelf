"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AniListResult {
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
  genres: string[];
}

interface ManagedMangaItem {
  id: number;
  anilistId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImage: string | null;
  totalVolumes: number | null;
  status: string | null;
  averageScore: number | null;
  monitored: boolean;
  volumeCount: number;
  importedCount: number;
  downloadingCount: number;
  missingCount: number;
}

export function ManagerPage({
  managedManga,
  existingAnilistIds,
}: {
  managedManga: ManagedMangaItem[];
  existingAnilistIds: number[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AniListResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(
    new Set(existingAnilistIds),
  );
  const [addingId, setAddingId] = useState<number | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/manager/search?q=${encodeURIComponent(query.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // silently fail
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const handleAdd = useCallback(
    async (anilistId: number) => {
      setAddingId(anilistId);
      try {
        const res = await fetch("/api/manager/manga", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anilistId }),
        });
        if (res.ok) {
          setAddedIds((prev) => new Set([...prev, anilistId]));
          router.refresh();
        }
      } catch {
        // silently fail
      } finally {
        setAddingId(null);
      }
    },
    [router],
  );

  return (
    <div>
      {/* Search section */}
      <div className="mb-8">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-surface-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search AniList for manga..."
            className="w-full rounded-lg border border-surface-600 bg-surface-700 py-3 pl-10 pr-4 text-sm text-surface-50 placeholder-surface-300 outline-none transition-colors focus:border-accent-400"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-surface-300 border-t-accent-400" />
            </div>
          )}
        </div>

        {/* Search results */}
        {results.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((manga) => {
              const isAdded = addedIds.has(manga.id);
              const isAdding = addingId === manga.id;

              return (
                <div
                  key={manga.id}
                  className="overflow-hidden rounded-lg border border-surface-600 bg-surface-700"
                >
                  <div className="relative aspect-[2/3] overflow-hidden bg-surface-600">
                    {manga.coverImage.extraLarge || manga.coverImage.large ? (
                      <img
                        src={
                          manga.coverImage.extraLarge || manga.coverImage.large!
                        }
                        alt={manga.title.romaji || ""}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-surface-300">
                        No Cover
                      </div>
                    )}
                    {manga.averageScore && (
                      <div className="absolute top-2 right-2 rounded-full bg-surface-900/80 px-1.5 py-0.5 text-[10px] font-medium text-accent-300">
                        {manga.averageScore}%
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <h3
                      className="truncate text-sm font-medium"
                      title={
                        manga.title.native ||
                        manga.title.romaji ||
                        manga.title.english ||
                        ""
                      }
                    >
                      {manga.title.native ||
                        manga.title.romaji ||
                        manga.title.english}
                    </h3>
                    {manga.title.native && manga.title.romaji && (
                      <p className="truncate text-xs text-surface-300">
                        {manga.title.romaji}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-xs text-surface-200">
                      {manga.volumes && <span>{manga.volumes} vol</span>}
                      {manga.status && (
                        <span className="capitalize">
                          {manga.status.toLowerCase().replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => !isAdded && handleAdd(manga.id)}
                      disabled={isAdded || isAdding}
                      className={`mt-2 w-full rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        isAdded
                          ? "bg-surface-600 text-surface-300 cursor-default"
                          : "bg-accent-400 text-surface-900 hover:bg-accent-300 disabled:opacity-50"
                      }`}
                    >
                      {isAdding
                        ? "Adding..."
                        : isAdded
                          ? "Added"
                          : "Add to Library"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Managed manga library */}
      <h2 className="mb-4 text-lg font-semibold">Managed Library</h2>
      {managedManga.length === 0 ? (
        <p className="text-sm text-surface-300">
          No manga added yet. Search AniList above to get started.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {managedManga.map((manga) => {
            const progress =
              manga.volumeCount > 0
                ? Math.round((manga.importedCount / manga.volumeCount) * 100)
                : 0;

            return (
              <Link
                key={manga.id}
                href={`/manager/${manga.id}`}
                className="group overflow-hidden rounded-lg border border-surface-600 bg-surface-700 transition-all hover:border-surface-400 hover:shadow-lg hover:shadow-surface-900/50"
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-surface-600">
                  {manga.coverImage ? (
                    <img
                      src={manga.coverImage}
                      alt={manga.titleRomaji || ""}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-surface-300">
                      No Cover
                    </div>
                  )}
                  {manga.downloadingCount > 0 && (
                    <div className="absolute top-2 right-2 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white">
                      {manga.downloadingCount} downloading
                    </div>
                  )}
                  {progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-500">
                      <div
                        className="h-full bg-accent-400 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="truncate text-sm font-medium">
                    {manga.titleNative ||
                      manga.titleRomaji ||
                      manga.titleEnglish}
                  </h3>
                  <p className="text-xs text-surface-200">
                    {manga.importedCount}/{manga.volumeCount} volumes
                  </p>
                  {manga.missingCount > 0 && (
                    <p className="text-xs text-surface-300">
                      {manga.missingCount} missing
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
