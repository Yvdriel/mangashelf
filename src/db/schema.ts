import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const manga = sqliteTable("manga", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  anilistId: integer("anilist_id").unique(),
  title: text("title").notNull(),
  folderName: text("folder_name").notNull().unique(),
  coverImage: text("cover_image"),
  totalVolumes: integer("total_volumes").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const volume = sqliteTable(
  "volume",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mangaId: integer("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    volumeNumber: integer("volume_number").notNull(),
    folderName: text("folder_name").notNull(),
    pageCount: integer("page_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("volume_manga_number_idx").on(
      table.mangaId,
      table.volumeNumber,
    ),
  ],
);

export const readingProgress = sqliteTable(
  "reading_progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mangaId: integer("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    volumeId: integer("volume_id")
      .notNull()
      .references(() => volume.id, { onDelete: "cascade" }),
    currentPage: integer("current_page").notNull().default(0),
    isCompleted: integer("is_completed", { mode: "boolean" })
      .notNull()
      .default(false),
    lastReadAt: integer("last_read_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("progress_manga_volume_idx").on(table.mangaId, table.volumeId),
  ],
);

// --- Manager tables ---

export const managedManga = sqliteTable("managed_manga", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  anilistId: integer("anilist_id").notNull().unique(),
  titleRomaji: text("title_romaji"),
  titleEnglish: text("title_english"),
  titleNative: text("title_native"),
  synonyms: text("synonyms"),
  coverImage: text("cover_image"),
  bannerImage: text("banner_image"),
  description: text("description"),
  totalVolumes: integer("total_volumes"),
  status: text("status"),
  genres: text("genres"),
  averageScore: integer("average_score"),
  bulkTorrentId: text("bulk_torrent_id"),
  monitored: integer("monitored", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const managedVolume = sqliteTable(
  "managed_volume",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    managedMangaId: integer("managed_manga_id")
      .notNull()
      .references(() => managedManga.id, { onDelete: "cascade" }),
    volumeNumber: integer("volume_number").notNull(),
    status: text("status").notNull().default("missing"),
    errorMessage: text("error_message"),
    torrentId: text("torrent_id"),
    downloadPath: text("download_path"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("managed_volume_manga_number_idx").on(
      table.managedMangaId,
      table.volumeNumber,
    ),
  ],
);

export const downloadHistory = sqliteTable("download_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  managedMangaId: integer("managed_manga_id")
    .notNull()
    .references(() => managedManga.id, { onDelete: "cascade" }),
  managedVolumeId: integer("managed_volume_id").references(
    () => managedVolume.id,
  ),
  torrentName: text("torrent_name").notNull(),
  magnetLink: text("magnet_link").notNull(),
  status: text("status").notNull().default("sent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
