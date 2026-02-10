import { db } from "@/db";
import {
  manga,
  volume,
  readingProgress,
  managedManga,
  managedVolume,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { MangaDescription } from "@/components/manga-description";

export const dynamic = "force-dynamic";

interface StaffEdge {
  role: string;
  node: { name: { full: string } };
}

export default async function MangaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mangaId = parseInt(id, 10);

  const mangaData = db.select().from(manga).where(eq(manga.id, mangaId)).get();
  if (!mangaData) notFound();

  const managed = mangaData.anilistId
    ? db
        .select()
        .from(managedManga)
        .where(eq(managedManga.anilistId, mangaData.anilistId))
        .get()
    : null;

  const genres: string[] = managed?.genres ? JSON.parse(managed.genres) : [];
  const staffEdges: StaffEdge[] = managed?.staff
    ? JSON.parse(managed.staff)
    : [];
  const authors = staffEdges
    .filter((e) => e.role === "Story" || e.role === "Story & Art")
    .map((e) => e.node.name.full);
  const artists = staffEdges
    .filter((e) => e.role === "Art")
    .map((e) => e.node.name.full);

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

  // Get download status per volume number from managed tables
  const downloadStatusByVolNum = new Map<
    number,
    { status: string; progress: number }
  >();
  if (managed) {
    const managedVols = db
      .select()
      .from(managedVolume)
      .where(eq(managedVolume.managedMangaId, managed.id))
      .all();
    for (const mv of managedVols) {
      if (mv.status === "downloading" || mv.status === "downloaded") {
        downloadStatusByVolNum.set(mv.volumeNumber, {
          status: mv.status,
          progress: mv.progress,
        });
      }
    }
  }

  const completedCount = progress.filter((p) => p.isCompleted).length;

  const lastInProgress = progress
    .filter((p) => !p.isCompleted)
    .sort((a, b) => b.lastReadAt.getTime() - a.lastReadAt.getTime())[0];

  const continueVolume = lastInProgress
    ? volumes.find((v) => v.id === lastInProgress.volumeId)
    : null;

  const firstUnread = !continueVolume
    ? volumes.find((v) => !progressByVolume.has(v.id))
    : null;

  const targetVolume = continueVolume || firstUnread || volumes[0];
  const targetPage =
    continueVolume && lastInProgress ? lastInProgress.currentPage : 0;

  const statusLabels: Record<string, string> = {
    FINISHED: "Finished",
    RELEASING: "Releasing",
    NOT_YET_RELEASED: "Not Yet Released",
    CANCELLED: "Cancelled",
    HIATUS: "Hiatus",
  };

  const coverUrl = mangaData.anilistId
    ? `/api/covers/${mangaData.anilistId}`
    : null;
  const coverThumb = mangaData.anilistId
    ? `/api/covers/${mangaData.anilistId}?thumb=md`
    : mangaData.coverImage
      ? `/api/manga/${mangaId}/volume/${mangaData.coverImage.split("/")[1]?.replace("v", "") || "1"}/page/0?thumb=md`
      : null;

  return (
    <div>
      {/* Hero section */}
      <div className="relative -mx-4 -mt-6 mb-8 overflow-hidden">
        {/* Banner / blurred background */}
        <div className="absolute inset-0 h-64">
          {managed?.bannerImage ? (
            <img
              src={managed.bannerImage}
              alt=""
              className="h-full w-full object-cover opacity-30"
            />
          ) : coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full scale-110 object-cover opacity-20 blur-2xl"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-900" />
        </div>

        <div className="relative mx-auto flex max-w-7xl gap-6 px-4 pt-8 pb-4">
          <div className="w-40 shrink-0 overflow-hidden rounded-lg bg-surface-600 shadow-xl">
            {coverThumb ? (
              <Image
                src={coverThumb}
                alt={mangaData.title}
                width={160}
                height={240}
                unoptimized
                className="aspect-[2/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center text-surface-300">
                No Cover
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col justify-end">
            <h1 className="text-2xl font-bold">{mangaData.title}</h1>

            {(authors.length > 0 || artists.length > 0) && (
              <p className="mt-0.5 text-sm text-surface-200">
                {authors.length > 0 && <>by {authors.join(", ")}</>}
                {authors.length > 0 && artists.length > 0 && " · "}
                {artists.length > 0 && <>Art: {artists.join(", ")}</>}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {managed?.status && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    managed.status === "FINISHED"
                      ? "bg-green-500/15 text-green-400"
                      : managed.status === "RELEASING"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-surface-500/30 text-surface-200"
                  }`}
                >
                  {statusLabels[managed.status] || managed.status}
                </span>
              )}
              {managed?.averageScore && (
                <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-medium text-yellow-400">
                  ★ {managed.averageScore}%
                </span>
              )}
              <span className="text-sm text-surface-200">
                {completedCount > 0 ? "Reading" : "Not started"} ·{" "}
                {completedCount}/{volumes.length} volumes
              </span>
            </div>

            {genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-surface-500 px-2.5 py-0.5 text-[11px] text-surface-200"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

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
      </div>

      {/* Description */}
      {managed?.description && <MangaDescription html={managed.description} />}

      {/* Volumes list */}
      <h2 className="mb-4 mt-8 text-lg font-semibold">Volumes</h2>
      <div className="grid gap-2">
        {volumes.map((vol) => {
          const p = progressByVolume.get(vol.id);
          const status = p?.isCompleted
            ? "completed"
            : p
              ? "reading"
              : "unread";
          const dl = downloadStatusByVolNum.get(vol.volumeNumber);

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
                {dl && dl.status === "downloading" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                    Downloading {Math.round(dl.progress)}%
                  </span>
                )}
                {dl && dl.status === "downloaded" && (
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-400">
                    Importing...
                  </span>
                )}
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
                {status === "unread" && !dl && (
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
