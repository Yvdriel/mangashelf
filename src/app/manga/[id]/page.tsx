import { db } from "@/db";
import { manga, volume, readingProgress } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MangaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mangaId = parseInt(id, 10);

  const mangaData = db.select().from(manga).where(eq(manga.id, mangaId)).get();
  if (!mangaData) notFound();

  const volumes = db
    .select()
    .from(volume)
    .where(eq(volume.mangaId, mangaId))
    .orderBy(volume.volumeNumber)
    .all();

  const progress = db
    .select()
    .from(readingProgress)
    .where(eq(readingProgress.mangaId, mangaId))
    .all();

  const progressByVolume = new Map(progress.map((p) => [p.volumeId, p]));

  const completedCount = progress.filter((p) => p.isCompleted).length;

  // Find the "continue reading" target: most recently read non-completed volume
  const lastInProgress = progress
    .filter((p) => !p.isCompleted)
    .sort((a, b) => b.lastReadAt.getTime() - a.lastReadAt.getTime())[0];

  const continueVolume = lastInProgress
    ? volumes.find((v) => v.id === lastInProgress.volumeId)
    : null;

  // If no in-progress volume, find first unread
  const firstUnread = !continueVolume
    ? volumes.find((v) => !progressByVolume.has(v.id))
    : null;

  const targetVolume = continueVolume || firstUnread || volumes[0];
  const targetPage =
    continueVolume && lastInProgress ? lastInProgress.currentPage : 0;

  return (
    <div>
      {/* Hero section */}
      <div className="mb-8 flex gap-6">
        <div className="relative w-48 shrink-0 overflow-hidden rounded-lg bg-surface-600 aspect-[2/3]">
          {mangaData.coverImage ? (
            <Image
              src={`/api/manga/${mangaId}/volume/${mangaData.coverImage.split("/")[1]?.replace("v", "") || "1"}/page/0`}
              alt={mangaData.title}
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center text-surface-300">
              No Cover
            </div>
          )}
        </div>

        <div className="flex flex-col justify-end">
          <h1 className="text-3xl font-bold">{mangaData.title}</h1>
          <p className="mt-2 text-surface-200">
            {completedCount > 0 ? "Reading" : "Not started"} &middot;{" "}
            {completedCount}/{volumes.length} volumes
          </p>

          {targetVolume && (
            <Link
              href={`/manga/${mangaId}/read/${targetVolume.volumeNumber}${targetPage > 0 ? `?p=${targetPage}` : ""}`}
              className="mt-4 inline-flex w-fit items-center rounded-md bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 transition-colors hover:bg-accent-300"
            >
              {continueVolume
                ? `Continue Reading · Vol ${continueVolume.volumeNumber}`
                : firstUnread
                  ? `Start Reading · Vol ${firstUnread.volumeNumber}`
                  : `Read Vol ${targetVolume.volumeNumber}`}
            </Link>
          )}
        </div>
      </div>

      {/* Volumes list */}
      <h2 className="mb-4 text-lg font-semibold">Volumes</h2>
      <div className="grid gap-2">
        {volumes.map((vol) => {
          const p = progressByVolume.get(vol.id);
          const status = p?.isCompleted
            ? "completed"
            : p
              ? "reading"
              : "unread";

          return (
            <Link
              key={vol.id}
              href={`/manga/${mangaId}/read/${vol.volumeNumber}${status === "reading" && p ? `?p=${p.currentPage}` : ""}`}
              className="flex items-center justify-between rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 transition-colors hover:border-surface-400"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  Volume {vol.volumeNumber}
                </span>
                <span className="text-xs text-surface-200">
                  {vol.pageCount} pages
                </span>
              </div>

              <div className="flex items-center gap-3">
                {status === "completed" && (
                  <span className="rounded-full bg-accent-200/15 px-2 py-0.5 text-xs font-medium text-accent-300">
                    Completed
                  </span>
                )}
                {status === "reading" && p && (
                  <span className="rounded-full bg-accent-400/15 px-2 py-0.5 text-xs font-medium text-accent-400">
                    Page {p.currentPage + 1}/{vol.pageCount}
                  </span>
                )}
                {status === "unread" && (
                  <span className="text-xs text-surface-300">Unread</span>
                )}
                <svg
                  className="h-4 w-4 text-surface-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
