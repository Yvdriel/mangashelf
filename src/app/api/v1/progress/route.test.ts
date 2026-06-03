import { describe, it, expect } from "vitest";
import {
  seedUser,
  seedToken,
  seedManga,
  seedVolume,
  seedProgress,
  authedRequest,
} from "@/test/db";
import { GET } from "./route";

const toDate = (ms: number) => new Date(ms);
const nowSec = () => Math.floor(Date.now() / 1000);

describe("GET /api/v1/progress", () => {
  it("returns serverTime and all progress when no changedSince is given", async () => {
    const userId = seedUser();
    seedToken(userId);
    const m = seedManga();
    const v1 = seedVolume(m, { volumeNumber: 1, pageCount: 10 });
    const v2 = seedVolume(m, { volumeNumber: 2, pageCount: 10 });

    const olderSec = nowSec() - 1000;
    const newerSec = nowSec();
    seedProgress({
      userId,
      mangaId: m,
      volumeId: v1,
      currentPage: 2,
      isCompleted: false,
      lastReadAt: toDate(olderSec * 1000),
      updatedAt: toDate(olderSec * 1000),
    });
    seedProgress({
      userId,
      mangaId: m,
      volumeId: v2,
      currentPage: 9,
      isCompleted: true,
      lastReadAt: toDate(newerSec * 1000),
      updatedAt: toDate(newerSec * 1000),
    });

    const res = await GET(authedRequest("http://localhost/api/v1/progress"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.serverTime).toBe("number");
    expect(json.progress).toHaveLength(2);
    const byVol = Object.fromEntries(
      json.progress.map((p: { volumeId: number }) => [p.volumeId, p]),
    );
    expect(byVol[v1].currentPage).toBe(2);
    expect(byVol[v1].updatedAt).toBe(olderSec);
    expect(byVol[v2].currentPage).toBe(9);
    expect(byVol[v2].isCompleted).toBe(true);
    expect(byVol[v2].updatedAt).toBe(newerSec);
  });

  it("filters by changedSince (strictly greater)", async () => {
    const userId = seedUser();
    seedToken(userId);
    const m = seedManga();
    const v1 = seedVolume(m, { volumeNumber: 1, pageCount: 10 });
    const v2 = seedVolume(m, { volumeNumber: 2, pageCount: 10 });

    const olderSec = nowSec() - 1000;
    const newerSec = nowSec();
    seedProgress({
      userId,
      mangaId: m,
      volumeId: v1,
      currentPage: 2,
      isCompleted: false,
      lastReadAt: toDate(olderSec * 1000),
      updatedAt: toDate(olderSec * 1000),
    });
    seedProgress({
      userId,
      mangaId: m,
      volumeId: v2,
      currentPage: 9,
      isCompleted: true,
      lastReadAt: toDate(newerSec * 1000),
      updatedAt: toDate(newerSec * 1000),
    });

    const res = await GET(
      authedRequest(
        `http://localhost/api/v1/progress?changedSince=${olderSec}`,
      ),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.progress).toHaveLength(1);
    expect(json.progress[0].volumeId).toBe(v2);
  });

  it("returns 401 for an unknown bearer", async () => {
    const userId = seedUser();
    seedToken(userId);

    const res = await GET(
      authedRequest("http://localhost/api/v1/progress", {
        token: "mst_unknown0000",
      }),
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });
});
