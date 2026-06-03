import { describe, it, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { readingProgress } from "@/db/schema";
import {
  seedUser,
  seedToken,
  seedManga,
  seedVolume,
  seedProgress,
  authedRequest,
} from "@/test/db";
import { POST } from "./route";

const toDate = (ms: number) => new Date(ms);
const nowSec = () => Math.floor(Date.now() / 1000);

function callBatch(body: unknown, token?: string) {
  return POST(
    authedRequest("http://localhost/api/v1/progress/batch", {
      method: "POST",
      body: JSON.stringify(body),
      ...(token ? { token } : {}),
    }),
  );
}

describe("POST /api/v1/progress/batch", () => {
  it("(a) accepts a brand-new entry and creates a readingProgress row", async () => {
    const userId = seedUser();
    seedToken(userId);
    const m = seedManga();
    const v = seedVolume(m, { pageCount: 10 });

    const res = await callBatch({
      entries: [
        {
          mangaId: m,
          volumeId: v,
          currentPage: 3,
          clientUpdatedAt: nowSec(),
        },
      ],
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toEqual([{ mangaId: m, volumeId: v }]);
    expect(json.rejected).toEqual([]);

    const row = db
      .select()
      .from(readingProgress)
      .where(
        and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.mangaId, m),
          eq(readingProgress.volumeId, v),
        ),
      )
      .get();
    expect(row).toBeTruthy();
    expect(row!.currentPage).toBe(3);
  });

  it("(b) rejects an entry older than an existing row as stale", async () => {
    const userId = seedUser();
    seedToken(userId);
    const m = seedManga();
    const v = seedVolume(m, { pageCount: 10 });

    const storedSec = nowSec();
    seedProgress({
      userId,
      mangaId: m,
      volumeId: v,
      currentPage: 5,
      isCompleted: false,
      lastReadAt: toDate(storedSec * 1000),
      updatedAt: toDate(storedSec * 1000),
    });

    const res = await callBatch({
      entries: [
        {
          mangaId: m,
          volumeId: v,
          currentPage: 8,
          clientUpdatedAt: storedSec - 100,
        },
      ],
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toEqual([]);
    expect(json.rejected).toEqual([
      { mangaId: m, volumeId: v, reason: "stale" },
    ]);

    const row = db
      .select()
      .from(readingProgress)
      .where(
        and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.mangaId, m),
          eq(readingProgress.volumeId, v),
        ),
      )
      .get();
    expect(row!.currentPage).toBe(5);
  });

  it("(c) accepts a same-second entry with a higher currentPage", async () => {
    const userId = seedUser();
    seedToken(userId);
    const m = seedManga();
    const v = seedVolume(m, { pageCount: 10 });

    const storedSec = nowSec();
    seedProgress({
      userId,
      mangaId: m,
      volumeId: v,
      currentPage: 4,
      isCompleted: false,
      lastReadAt: toDate(storedSec * 1000),
      updatedAt: toDate(storedSec * 1000),
    });

    const res = await callBatch({
      entries: [
        {
          mangaId: m,
          volumeId: v,
          currentPage: 7,
          clientUpdatedAt: storedSec,
        },
      ],
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toEqual([{ mangaId: m, volumeId: v }]);
    expect(json.rejected).toEqual([]);

    const row = db
      .select()
      .from(readingProgress)
      .where(
        and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.mangaId, m),
          eq(readingProgress.volumeId, v),
        ),
      )
      .get();
    expect(row!.currentPage).toBe(7);
  });

  it("(d) rejects an entry referencing an unknown volume", async () => {
    const userId = seedUser();
    seedToken(userId);
    const m = seedManga();
    seedVolume(m, { pageCount: 10 });

    const res = await callBatch({
      entries: [
        {
          mangaId: m,
          volumeId: 999999,
          currentPage: 1,
          clientUpdatedAt: nowSec(),
        },
      ],
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toEqual([]);
    expect(json.rejected).toEqual([
      { mangaId: m, volumeId: 999999, reason: "unknown_volume" },
    ]);
  });

  it("(e) returns 401 for an unknown bearer", async () => {
    const userId = seedUser();
    seedToken(userId);
    const m = seedManga();
    const v = seedVolume(m, { pageCount: 10 });

    const res = await callBatch(
      {
        entries: [
          { mangaId: m, volumeId: v, currentPage: 1, clientUpdatedAt: nowSec() },
        ],
      },
      "mst_unknown0000",
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });
});
