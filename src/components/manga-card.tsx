import Image from "next/image";
import Link from "next/link";

interface MangaCardProps {
  manga: {
    id: number;
    title: string;
    coverImage: string | null;
    coverUrl: string | null;
    totalVolumes: number;
    completedVolumes: number;
    progressPercent: number;
    downloadingCount?: number;
  };
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function MangaCard({
  manga,
  selectMode,
  isSelected,
  onToggleSelect,
}: MangaCardProps) {
  const isReading = manga.completedVolumes > 0 && manga.progressPercent < 100;

  const coverSrc = manga.coverUrl
    ? `${manga.coverUrl}?thumb=md`
    : manga.coverImage
      ? `/api/manga/${manga.id}/volume/${manga.coverImage.split("/")[1]?.replace("v", "") || "1"}/page/0?thumb=md`
      : null;

  const cardContent = (
    <>
      <div className="relative aspect-2/3 overflow-hidden bg-surface-600">
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={manga.title}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-surface-300">
            No Cover
          </div>
        )}
        {/* Selection checkbox */}
        {selectMode && (
          <div className="absolute top-2 left-2 z-10">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                isSelected
                  ? "border-accent-400 bg-accent-400"
                  : "border-white/70 bg-black/30"
              }`}
            >
              {isSelected && (
                <svg
                  className="h-3 w-3 text-surface-900"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              )}
            </div>
          </div>
        )}
        {!selectMode && isReading && (
          <div className="absolute top-2 right-2 rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-medium text-surface-900">
            Reading
          </div>
        )}
        {!selectMode &&
          manga.downloadingCount != null &&
          manga.downloadingCount > 0 && (
            <div className="absolute top-2 left-2 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white">
              {manga.downloadingCount} downloading
            </div>
          )}
        {manga.progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-500">
            <div
              className="h-full bg-accent-400 transition-all"
              style={{ width: `${manga.progressPercent}%` }}
            />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="truncate text-sm font-medium">{manga.title}</h3>
        <p className="text-xs text-surface-200">
          {manga.totalVolumes} volume{manga.totalVolumes !== 1 ? "s" : ""}
        </p>
      </div>
    </>
  );

  if (selectMode) {
    return (
      <div
        onClick={onToggleSelect}
        className={`group cursor-pointer overflow-hidden rounded-lg border bg-surface-700 transition-all hover:border-surface-400 hover:shadow-lg hover:shadow-surface-900/50 ${
          isSelected
            ? "border-accent-400 ring-2 ring-accent-400/30"
            : "border-surface-600"
        }`}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      href={`/manga/${manga.id}`}
      className="group overflow-hidden rounded-lg border border-surface-600 bg-surface-700 transition-all hover:border-surface-400 hover:shadow-lg hover:shadow-surface-900/50"
    >
      {cardContent}
    </Link>
  );
}
