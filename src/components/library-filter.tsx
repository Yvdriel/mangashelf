"use client";

import { useState, useMemo } from "react";
import { MangaCard } from "./manga-card";

type SortOption = "title" | "recently-read" | "recently-added";

interface MangaItem {
  id: number;
  title: string;
  coverImage: string | null;
  totalVolumes: number;
  completedVolumes: number;
  progressPercent: number;
  lastReadAt: Date | null;
  createdAt: Date;
}

export function LibraryFilter({ manga }: { manga: MangaItem[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title");

  const filtered = useMemo(() => {
    let result = manga;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.title.toLowerCase().includes(q));
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
  }, [manga, search, sort]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
