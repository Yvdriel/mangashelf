import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { GET } from "./route";
import {
  authedRequest,
  seedManga,
  seedToken,
  seedUser,
  seedVolume,
  writeVolumePages,
} from "@/test/db";

const FOLDER = "CBZ Manga [anilist-555]";

async function setup() {
  const userId = seedUser();
  seedToken(userId);
  const mangaId = seedManga({ folderName: FOLDER, title: "CBZ Manga" });
  seedVolume(mangaId, { volumeNumber: 1, folderName: "v01", pageCount: 3 });
  await writeVolumePages(FOLDER, "v01", 3);
  return { mangaId };
}

function call(mangaId: number, volumeNumber: string, init?: { token?: string; headers?: HeadersInit }) {
  return GET(
    authedRequest(
      `http://localhost/api/v1/manga/${mangaId}/volume/${volumeNumber}/archive`,
      init,
    ),
    { params: Promise.resolve({ id: String(mangaId), volumeNumber }) },
  );
}

describe("GET /api/v1/manga/[id]/volume/[volumeNumber]/archive", () => {
  it("(a) returns 200 zip with exactly 3 sequential entries", async () => {
    const { mangaId } = await setup();
    const res = await call(mangaId, "1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain(".cbz");

    const entries = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const names = Object.keys(entries).sort();
    expect(names).toEqual(["0001.jpg", "0002.jpg", "0003.jpg"]);
  });

  it("(b) two calls return the same etag", async () => {
    const { mangaId } = await setup();
    const a = await call(mangaId, "1");
    const b = await call(mangaId, "1");
    const etagA = a.headers.get("etag");
    expect(etagA).toBeTruthy();
    expect(b.headers.get("etag")).toBe(etagA);
  });

  it("(c) If-None-Match with matching etag returns 304", async () => {
    const { mangaId } = await setup();
    const first = await call(mangaId, "1");
    const etag = first.headers.get("etag")!;
    const res = await call(mangaId, "1", { headers: { "If-None-Match": etag } });
    expect(res.status).toBe(304);
  });

  it("(d) unknown volume number returns 404", async () => {
    const { mangaId } = await setup();
    const res = await call(mangaId, "99");
    expect(res.status).toBe(404);
  });

  it("(e) unknown bearer returns 401", async () => {
    const { mangaId } = await setup();
    const res = await call(mangaId, "1", { token: "mst_unknown0000" });
    expect(res.status).toBe(401);
  });

  it("returns 400 on non-numeric id", async () => {
    await setup();
    const res = await GET(
      authedRequest("http://localhost/api/v1/manga/abc/volume/1/archive"),
      { params: Promise.resolve({ id: "abc", volumeNumber: "1" }) },
    );
    expect(res.status).toBe(400);
  });
});
