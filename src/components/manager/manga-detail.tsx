"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchModal } from "./search-modal";

interface ManagedMangaData {
  id: number;
  anilistId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  synonyms: string[];
  coverImage: string | null;
  bannerImage: string | null;
  description: string | null;
  totalVolumes: number | null;
  status: string | null;
  genres: string[];
  averageScore: number | null;
  bulkTorrentId: string | null;
  monitored: boolean;
}

interface ManagedVolumeData {
  id: number;
  volumeNumber: number;
  status: string;
  torrentId: string | null;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  missing: { label: "Missing", className: "bg-surface-600 text-surface-200" },
  searching: {
    label: "Searching",
    className: "bg-yellow-500/20 text-yellow-400",
  },
  downloading: {
    label: "Downloading",
    className: "bg-blue-500/20 text-blue-400",
  },
  downloaded: {
    label: "Downloaded",
    className: "bg-green-500/20 text-green-400",
  },
  imported: {
    label: "Imported",
    className: "bg-accent-400/15 text-accent-300",
  },
};

export function MangaDetail({
  manga,
  volumes,
  readerMangaId,
}: {
  manga: ManagedMangaData;
  volumes: ManagedVolumeData[];
  readerMangaId: number | null;
}) {
  const router = useRouter();
  const [searchModal, setSearchModal] = useState<{
    volumeNumber?: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const title =
    manga.titleNative || manga.titleRomaji || manga.titleEnglish || "";
  const subtitle =
    manga.titleNative && manga.titleRomaji ? manga.titleRomaji : null;

  const importedCount = volumes.filter((v) => v.status === "imported").length;

  const handleDelete = useCallback(async () => {
    if (!confirm("Remove this manga from the manager?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/manager/manga/${manga.id}`, { method: "DELETE" });
      router.push("/manager");
      router.refresh();
    } catch {
      setDeleting(false);
    }
  }, [manga.id, router]);

  const handleToggleMonitored = useCallback(async () => {
    await fetch(`/api/manager/manga/${manga.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitored: !manga.monitored }),
    });
    router.refresh();
  }, [manga.id, manga.monitored, router]);

  return (
    <div>
      {/* Hero section */}
      <div className="relative -mx-4 -mt-6 mb-8 overflow-hidden">
        {/* Banner / blurred background */}
        <div className="absolute inset-0 h-64">
          {manga.bannerImage ? (
            <img
              src={manga.bannerImage}
              alt=""
              className="h-full w-full object-cover opacity-30"
            />
          ) : manga.coverImage ? (
            <img
              src={manga.coverImage}
              alt=""
              className="h-full w-full scale-110 object-cover opacity-20 blur-2xl"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-900" />
        </div>

        <div className="relative mx-auto flex max-w-7xl gap-6 px-4 pt-8 pb-4">
          {/* Cover */}
          <div className="w-40 shrink-0 overflow-hidden rounded-lg bg-surface-600 shadow-xl">
            {manga.coverImage ? (
              <img
                src={manga.coverImage}
                alt={title}
                className="aspect-[2/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center text-surface-300">
                No Cover
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex min-w-0 flex-col justify-end">
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-surface-200">{subtitle}</p>
            )}

            {manga.description && (
              <p className="mt-3 line-clamp-3 text-sm text-surface-200">
                {manga.description.replace(/<[^>]+>/g, "")}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-300">
              {manga.status && (
                <span className="capitalize">
                  {manga.status.toLowerCase().replace("_", " ")}
                </span>
              )}
              {manga.totalVolumes && <span>{manga.totalVolumes} volumes</span>}
              {manga.averageScore && <span>{manga.averageScore}% score</span>}
              {manga.genres.length > 0 && (
                <span>{manga.genres.slice(0, 3).join(", ")}</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSearchModal({})}
                disabled={!!manga.bulkTorrentId}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  manga.bulkTorrentId
                    ? "bg-blue-500/20 text-blue-400 cursor-not-allowed"
                    : "bg-accent-400 text-surface-900 hover:bg-accent-300"
                }`}
              >
                {manga.bulkTorrentId
                  ? "Bulk Download in Progress..."
                  : "Search All Missing"}
              </button>
              {readerMangaId && (
                <Link
                  href={`/manga/${readerMangaId}`}
                  className="rounded-md border border-surface-500 px-4 py-2 text-sm font-medium text-surface-100 transition-colors hover:bg-surface-700"
                >
                  Open in Reader
                </Link>
              )}
              <button
                onClick={handleToggleMonitored}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  manga.monitored
                    ? "border-accent-400/30 text-accent-300 hover:bg-accent-400/10"
                    : "border-surface-500 text-surface-300 hover:bg-surface-700"
                }`}
              >
                {manga.monitored ? "Monitored" : "Unmonitored"}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-surface-500 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Volumes section */}
      <h2 className="mb-4 text-lg font-semibold">
        Volumes ({importedCount}/{volumes.length})
      </h2>

      {volumes.length === 0 ? (
        <p className="text-sm text-surface-300">
          No volume information available. AniList may not have volume data for
          this manga yet.
        </p>
      ) : (
        <div className="grid gap-2">
          {volumes.map((vol) => {
            const style = STATUS_STYLES[vol.status] || STATUS_STYLES.missing;

            return (
              <div
                key={vol.id}
                className="flex items-center justify-between rounded-lg border border-surface-600 bg-surface-700 px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    Volume {vol.volumeNumber}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
                  >
                    {style.label}
                  </span>
                </div>

                {vol.status === "missing" && (
                  <button
                    onClick={() =>
                      setSearchModal({ volumeNumber: vol.volumeNumber })
                    }
                    className="rounded-md bg-surface-600 px-3 py-1.5 text-xs font-medium text-surface-100 transition-colors hover:bg-surface-500"
                  >
                    Search
                  </button>
                )}
                {vol.status === "imported" && (
                  <svg
                    className="h-5 w-5 text-accent-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Search modal */}
      {searchModal && (
        <SearchModal
          mangaId={manga.id}
          volumeNumber={searchModal.volumeNumber}
          onClose={() => {
            setSearchModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
