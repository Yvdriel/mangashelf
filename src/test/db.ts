// Shared seeding + request helpers for endpoint integration tests.
// Import AFTER `./setup-db` has set DATABASE_URL (wired via vitest setupFiles).
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { db } from "@/db";
import {
  apiToken,
  manga,
  readingProgress,
  user,
  volume,
} from "@/db/schema";
import { hashToken, tokenPrefix } from "@/lib/api-auth";

/** Known plaintext token seeded by `seedToken` and used by `authedRequest`. */
export const TEST_TOKEN = "mst_" + "0".repeat(32);

/** Clear all reader/auth rows between tests (leaf → parent order). */
export function resetDb(): void {
  db.delete(readingProgress).run();
  db.delete(apiToken).run();
  db.delete(volume).run();
  db.delete(manga).run();
  db.delete(user).run();
}

export function seedUser(
  overrides: Partial<typeof user.$inferInsert> = {},
): string {
  const id = overrides.id ?? `user_${randomUUID()}`;
  db.insert(user)
    .values({
      id,
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `${id}@test.local`,
      emailVerified: true,
      role: overrides.role ?? "user",
      ...overrides,
    })
    .run();
  return id;
}

export function seedToken(
  userId: string,
  plaintext: string = TEST_TOKEN,
  overrides: Partial<typeof apiToken.$inferInsert> = {},
): string {
  const id = overrides.id ?? randomUUID();
  db.insert(apiToken)
    .values({
      id,
      userId,
      name: overrides.name ?? "Test Token",
      tokenHash: hashToken(plaintext),
      prefix: tokenPrefix(plaintext),
      ...overrides,
    })
    .run();
  return id;
}

export function seedManga(
  overrides: Partial<typeof manga.$inferInsert> = {},
): number {
  const folder = overrides.folderName ?? `Test Manga [anilist-${Date.now()}]`;
  const row = db
    .insert(manga)
    .values({
      title: overrides.title ?? "Test Manga",
      folderName: folder,
      coverImage: overrides.coverImage ?? `${folder}/v1/0001.jpg`,
      totalVolumes: overrides.totalVolumes ?? 1,
      ...overrides,
    })
    .returning({ id: manga.id })
    .get();
  return row.id;
}

export function seedVolume(
  mangaId: number,
  overrides: Partial<typeof volume.$inferInsert> = {},
): number {
  const num = overrides.volumeNumber ?? 1;
  const row = db
    .insert(volume)
    .values({
      mangaId,
      volumeNumber: num,
      folderName: overrides.folderName ?? `v${String(num).padStart(2, "0")}`,
      pageCount: overrides.pageCount ?? 10,
      ...overrides,
    })
    .returning({ id: volume.id })
    .get();
  return row.id;
}

export function seedProgress(
  values: typeof readingProgress.$inferInsert,
): void {
  db.insert(readingProgress).values(values).run();
}

/** The per-file temp manga library root (set by setup-db.ts). */
export function mangaDir(): string {
  return process.env.MANGA_DIR as string;
}

/**
 * Write `count` real (sharp-decodable) JPEG pages into
 * `MANGA_DIR/<folderName>/<volumeFolder>/0001.jpg…`. Returns the dir.
 */
export async function writeVolumePages(
  folderName: string,
  volumeFolder: string,
  count: number,
): Promise<string> {
  const dir = path.join(mangaDir(), folderName, volumeFolder);
  fs.mkdirSync(dir, { recursive: true });
  const jpeg = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#fff" },
  })
    .jpeg()
    .toBuffer();
  for (let i = 1; i <= count; i++) {
    fs.writeFileSync(path.join(dir, `${String(i).padStart(4, "0")}.jpg`), jpeg);
  }
  return dir;
}

/** Write a `.mokuro` sidecar at `MANGA_DIR/<folderName>/<volumeFolder>.mokuro`. */
export function writeMokuro(
  folderName: string,
  volumeFolder: string,
  data: unknown,
): string {
  const file = path.join(mangaDir(), folderName, `${volumeFolder}.mokuro`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  return file;
}

/** Build a Request carrying the seeded bearer token (override via opts.token). */
export function authedRequest(
  url: string,
  init: RequestInit & { token?: string } = {},
): Request {
  const { token = TEST_TOKEN, headers, ...rest } = init;
  return new Request(url, {
    ...rest,
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
}
