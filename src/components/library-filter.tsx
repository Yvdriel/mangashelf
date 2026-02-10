"use client";

import { useState, useMemo } from "react";
import { MangaCard } from "./manga-card";

type SortOption = "title" | "recently-read" | "recently-added";

interface MangaItem {
  id: number;
  title: string;
  coverImage: string | null;
  coverUrl: string | null;
  genres: string[];
  totalVolumes: number;
  completedVolumes: number;
  progressPercent: number;
  lastReadAt: Date | null;
  createdAt: Date;
}

export function LibraryFilter({ manga }: { manga: MangaItem[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title");
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());

  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    for (const m of manga) {
      for (const g of m.genres) genreSet.add(g);
    }
    return Array.from(genreSet).sort();
  }, [manga]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = manga;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.title.toLowerCase().includes(q));
    }

    if (selectedGenres.size > 0) {
      result = result.filter((m) =>
        m.genres.some((g) => selectedGenres.has(g)),
      );
    }

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "recently-read": {
          const aTime = a.lastReadAt?.getTime() ?? 0;
          const bTime = b.lastReadAt?.getTime() ?? 0;
          return bTime - aTime;
        }
        case "recently-added":
          return b.createdAt.getTime() - a.createdAt.getTime();
        case "title":
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [manga, search, sort, selectedGenres]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Library</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-surface-600 bg-surface-700 px-3 py-1.5 text-sm text-surface-50 placeholder-surface-300 outline-none focus:border-accent-400 transition-colors"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-md border border-surface-600 bg-surface-700 px-3 py-1.5 text-sm text-surface-50 outline-none focus:border-accent-400 cursor-pointer transition-colors"
          >
            <option value="title">Title</option>
            <option value="recently-read">Recently Read</option>
            <option value="recently-added">Recently Added</option>
          </select>
        </div>
      </div>

      {allGenres.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {allGenres.map((genre) => (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                selectedGenres.has(genre)
                  ? "border-accent-400 bg-accent-400/15 text-accent-300"
                  : "border-surface-500 text-surface-300 hover:border-surface-400 hover:text-surface-200"
              }`}
            >
              {genre}
            </button>
          ))}
          {selectedGenres.size > 0 && (
            <button
              onClick={() => setSelectedGenres(new Set())}
              className="rounded-full border border-surface-600 px-2.5 py-0.5 text-[11px] text-surface-300 hover:text-surface-100 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((m) => (
            <MangaCard key={m.id} manga={m} />
          ))}
        </div>
      ) : manga.length === 0 ? (
        <div className="mt-20 text-center">
          <p className="text-surface-200">No manga found.</p>
          <p className="mt-1 text-sm text-surface-300">
            Place manga folders in your MANGA_DIR and click Scan Library.
          </p>
        </div>
      ) : (
        <div className="mt-20 text-center">
          <p className="text-surface-200">
            No results for &ldquo;{search}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
