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
