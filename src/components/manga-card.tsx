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
}

export function MangaCard({ manga }: MangaCardProps) {
  const isReading = manga.completedVolumes > 0 && manga.progressPercent < 100;

  const coverSrc = manga.coverUrl
    ? `${manga.coverUrl}?thumb=md`
    : manga.coverImage
      ? `/api/manga/${manga.id}/volume/${manga.coverImage.split("/")[1]?.replace("v", "") || "1"}/page/0?thumb=md`
      : null;

  return (
    <Link
      href={`/manga/${manga.id}`}
      className="group overflow-hidden rounded-lg border border-surface-600 bg-surface-700 transition-all hover:border-surface-400 hover:shadow-lg hover:shadow-surface-900/50"
    >
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
        {isReading && (
          <div className="absolute top-2 right-2 rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-medium text-surface-900">
            Reading
          </div>
        )}
        {manga.downloadingCount != null && manga.downloadingCount > 0 && (
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
    </Link>
  );
}
