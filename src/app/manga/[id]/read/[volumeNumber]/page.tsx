import { db } from "@/db";
import { manga, volume, readingProgress } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { Reader } from "@/components/reader";
import { getSession } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; volumeNumber: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id, volumeNumber } = await params;
  const { p } = await searchParams;
  const mangaId = parseInt(id, 10);
  const volNum = parseInt(volumeNumber, 10);

  const mangaData = db.select().from(manga).where(eq(manga.id, mangaId)).get();
  if (!mangaData) notFound();

  const allVolumes = db
    .select()
    .from(volume)
    .where(eq(volume.mangaId, mangaId))
    .orderBy(volume.volumeNumber)
    .all();

  const currentVolume = allVolumes.find((v) => v.volumeNumber === volNum);
  if (!currentVolume) notFound();

  // Get saved progress for this volume
  const progress = db
    .select()
    .from(readingProgress)
    .where(
      and(
        eq(readingProgress.userId, session.user.id),
        eq(readingProgress.mangaId, mangaId),
        eq(readingProgress.volumeId, currentVolume.id),
      ),
    )
    .get();

  const startPage = p ? parseInt(p, 10) : (progress?.currentPage ?? 0);

  // Find next/prev volume numbers
  const volIndex = allVolumes.findIndex((v) => v.id === currentVolume.id);
  const nextVolume = allVolumes[volIndex + 1] ?? null;
  const prevVolume = allVolumes[volIndex - 1] ?? null;

  return (
    <Reader
      mangaId={mangaId}
      mangaTitle={mangaData.title}
      volumeNumber={volNum}
      volumeId={currentVolume.id}
      pageCount={currentVolume.pageCount}
      startPage={startPage}
      nextVolumeNumber={nextVolume?.volumeNumber ?? null}
      prevVolumeNumber={prevVolume?.volumeNumber ?? null}
    />
  );
}
