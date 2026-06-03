import { describe, expect, it } from "vitest";
import { GET } from "./route";
import {
  authedRequest,
  seedManga,
  seedToken,
  seedUser,
  seedVolume,
} from "@/test/db";

describe("GET /api/v1/library", () => {
  it("returns manga list with nested volumes when no param given", async () => {
    const userId = seedUser();
    seedToken(userId);
    const m = seedManga();
    seedVolume(m);

    const res = await GET(authedRequest("http://localhost/api/v1/library"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body.serverTime).toBe("number");
    expect(Array.isArray(body.manga)).toBe(true);
    expect(body.manga).toHaveLength(1);

    const entry = body.manga[0];
    expect(entry.id).toBe(m);
    expect(entry.title).toBe("Test Manga");
    expect(typeof entry.folderName).toBe("string");
    expect(typeof entry.updatedAt).toBe("number");
    expect(Array.isArray(entry.volumes)).toBe(true);
    expect(entry.volumes).toHaveLength(1);
    expect(entry.volumes[0].volumeNumber).toBe(1);
    expect(typeof entry.volumes[0].pageCount).toBe("number");
  });

  it("sorts manga by title", async () => {
    const userId = seedUser();
    seedToken(userId);
    seedManga({ title: "Zebra", folderName: "Zebra [anilist-1]" });
    seedManga({ title: "Apple", folderName: "Apple [anilist-2]" });

    const res = await GET(authedRequest("http://localhost/api/v1/library"));
    const body = await res.json();
    expect(body.manga.map((x: { title: string }) => x.title)).toEqual([
      "Apple",
      "Zebra",
    ]);
  });

  it("returns all manga for changedSince=0", async () => {
    const userId = seedUser();
    seedToken(userId);
    const m = seedManga();
    seedVolume(m);

    const res = await GET(
      authedRequest("http://localhost/api/v1/library?changedSince=0"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.manga).toHaveLength(1);
  });

  it("returns empty manga array for changedSince in the future", async () => {
    const userId = seedUser();
    seedToken(userId);
    const m = seedManga();
    seedVolume(m);

    const first = await GET(authedRequest("http://localhost/api/v1/library"));
    const { serverTime } = await first.json();

    const res = await GET(
      authedRequest(
        `http://localhost/api/v1/library?changedSince=${serverTime + 1000}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.manga).toHaveLength(0);
  });

  it("returns 401 for an unknown bearer", async () => {
    seedToken(seedUser());
    const res = await GET(
      authedRequest("http://localhost/api/v1/library", {
        token: "mst_unknown0000",
      }),
    );
    expect(res.status).toBe(401);
  });
});
