import { describe, it, expect, beforeEach } from "vitest";
import {
  seedUser,
  seedToken,
  seedManga,
  seedVolume,
  writeMokuro,
  authedRequest,
} from "@/test/db";
import { GET } from "./route";

const FOLDER = "OCR Manga [anilist-555]";

const MOKURO = {
  version: "2.0",
  pages: [{ img_width: 800, img_height: 1200, blocks: [] }],
};

function callGet(
  mangaId: number | string,
  volumeNumber: number | string,
  init: Parameters<typeof authedRequest>[1] & { ifNoneMatch?: string } = {},
) {
  const { ifNoneMatch, ...opts } = init;
  if (ifNoneMatch) {
    opts.headers = { ...opts.headers, "If-None-Match": ifNoneMatch };
  }
  return GET(
    authedRequest(
      `http://localhost/api/v1/manga/${mangaId}/volume/${volumeNumber}/ocr`,
      opts,
    ),
    {
      params: Promise.resolve({
        id: String(mangaId),
        volumeNumber: String(volumeNumber),
      }),
    },
  );
}

describe("GET /api/v1/manga/[id]/volume/[volumeNumber]/ocr", () => {
  let mangaId: number;

  beforeEach(() => {
    const userId = seedUser();
    seedToken(userId);
    mangaId = seedManga({ folderName: FOLDER });
    seedVolume(mangaId, { volumeNumber: 1, folderName: "v01" });
    writeMokuro(FOLDER, "v01", MOKURO);
  });

  it("returns 200 with the parsed mokuro JSON and json content-type", async () => {
    const res = await callGet(mangaId, 1);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(res.headers.get("etag")).toBeTruthy();
    const body = await res.json();
    expect(body).toEqual(MOKURO);
  });

  it("returns 304 when If-None-Match matches the ETag", async () => {
    const first = await callGet(mangaId, 1);
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();

    const res = await callGet(mangaId, 1, { ifNoneMatch: etag! });
    expect(res.status).toBe(304);
    const text = await res.text();
    expect(text).toBe("");
  });

  it("returns 404 for a volume with no .mokuro sidecar", async () => {
    seedVolume(mangaId, { volumeNumber: 2, folderName: "v02" });
    const res = await callGet(mangaId, 2);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "OCR not available for this volume" });
  });

  it("returns 401 for an unknown bearer token", async () => {
    const res = await callGet(mangaId, 1, { token: "mst_unknown0000" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when the manga id is not numeric", async () => {
    const res = await callGet("abc", 1);
    expect(res.status).toBe(400);
  });
});
