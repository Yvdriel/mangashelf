import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { readingProgress, volume } from "@/db/schema";

/** Build a JS Date from a unix-milliseconds value. */
const toDate = (ms: number) => new Date(ms);

export interface ProgressEntry {
  mangaId: number;
  volumeId: number;
  currentPage: number;
  isCompleted?: boolean;
  /** Client-supplied modification time, in unix SECONDS. */
  clientUpdatedAt: number;
}

export interface ApplyResult {
  accepted: boolean;
  reason?: string;
}

/**
 * Apply a single progress entry for `userId` using last-write-wins semantics.
 *
 * - Rejects entries whose volume does not exist under the given manga
 *   (`unknown_volume`).
 * - Stores the CLIENT timestamp into `updatedAt`/`lastReadAt` (not server now)
 *   so LWW comparisons remain stable across repeated syncs.
 * - On a tie (same second), the higher `currentPage` wins; otherwise the entry
 *   is `stale`.
 */
export function applyProgressEntry(
  userId: string,
  entry: ProgressEntry,
): ApplyResult {
  const vol = db
    .select()
    .from(volume)
    .where(and(eq(volume.id, entry.volumeId), eq(volume.mangaId, entry.mangaId)))
    .get();

  if (!vol) {
    return { accepted: false, reason: "unknown_volume" };
  }

  const isCompleted =
    entry.isCompleted ?? entry.currentPage >= vol.pageCount - 1;

  const clientDate = toDate(entry.clientUpdatedAt * 1000);

  const existing = db
    .select()
    .from(readingProgress)
    .where(
      and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.mangaId, entry.mangaId),
        eq(readingProgress.volumeId, entry.volumeId),
      ),
    )
    .get();

  if (!existing) {
    db.insert(readingProgress)
      .values({
        userId,
        mangaId: entry.mangaId,
        volumeId: entry.volumeId,
        currentPage: entry.currentPage,
        isCompleted,
        lastReadAt: clientDate,
        updatedAt: clientDate,
      })
      .run();
    return { accepted: true };
  }

  const storedSec = Math.floor(existing.updatedAt.getTime() / 1000);

  let accept: boolean;
  if (entry.clientUpdatedAt > storedSec) {
    accept = true;
  } else if (entry.clientUpdatedAt === storedSec) {
    accept = entry.currentPage > existing.currentPage;
  } else {
    accept = false;
  }

  if (!accept) {
    return { accepted: false, reason: "stale" };
  }

  db.update(readingProgress)
    .set({
      currentPage: entry.currentPage,
      isCompleted,
      lastReadAt: clientDate,
      updatedAt: clientDate,
    })
    .where(eq(readingProgress.id, existing.id))
    .run();

  return { accepted: true };
}
