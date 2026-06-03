import { describe, expect, it } from "vitest";
import { GET } from "./route";
import {
  authedRequest,
  seedManga,
  seedToken,
  seedUser,
  writeVolumePages,
} from "@/test/db";

const FOLDER = "Cover Manga [anilist-777]";

async function setup() {
  const userId = seedUser();
  seedToken(userId);
  const mangaId = seedManga({
    folderName: FOLDER,
    title: "Cover Manga",
    coverImage: `${FOLDER}/v1/0001.jpg`,
  });
  await writeVolumePages(FOLDER, "v1", 1);
  return { mangaId };
}

function call(
  id: string,
  init?: { token?: string; headers?: HeadersInit },
  query = "",
) {
  return GET(
    authedRequest(`http://localhost/api/v1/manga/${id}/cover${query}`, init),
    { params: Promise.resolve({ id }) },
  );
}

describe("GET /api/v1/manga/[id]/cover", () => {
  it("(a) returns 200 jpeg with non-empty body", async () => {
    const { mangaId } = await setup();
    const res = await call(String(mangaId));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("(b) If-None-Match with matching etag returns 304", async () => {
    const { mangaId } = await setup();
    const first = await call(String(mangaId));
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();
    const res = await call(String(mangaId), {
      headers: { "If-None-Match": etag! },
    });
    expect(res.status).toBe(304);
    expect(await res.arrayBuffer()).toHaveProperty("byteLength", 0);
  });

  it("(c) invalid size returns 400", async () => {
    const { mangaId } = await setup();
    const res = await call(String(mangaId), undefined, "?size=xl");
    expect(res.status).toBe(400);
  });

  it("(d) missing manga id returns 404", async () => {
    await setup();
    const res = await call("999999");
    expect(res.status).toBe(404);
  });

  it("(e) unknown bearer returns 401", async () => {
    const { mangaId } = await setup();
    const res = await call(String(mangaId), { token: "mst_unknown0000" });
    expect(res.status).toBe(401);
  });

  it("returns 400 on non-numeric id", async () => {
    await setup();
    const res = await GET(
      authedRequest("http://localhost/api/v1/manga/abc/cover"),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when coverImage is null", async () => {
    const userId = seedUser();
    seedToken(userId);
    const mangaId = seedManga({
      folderName: "No Cover [anilist-778]",
      title: "No Cover",
      coverImage: null,
    });
    const res = await call(String(mangaId));
    expect(res.status).toBe(404);
  });
});
