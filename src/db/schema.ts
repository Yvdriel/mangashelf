import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// --- Better Auth tables ---

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  role: text("role").default("user"),
  banned: integer("banned", { mode: "boolean" }).default(false),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp" }),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).default(
    false,
  ),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const twoFactor = sqliteTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("twoFactor_secret_idx").on(table.secret),
    index("twoFactor_userId_idx").on(table.userId),
  ],
);

export const passkey = sqliteTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    transports: text("transports"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_userId_idx").on(table.userId),
    index("passkey_credentialID_idx").on(table.credentialID),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactors: many(twoFactor),
  passkeys: many(passkey),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, {
    fields: [twoFactor.userId],
    references: [user.id],
  }),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}));

// --- Reader tables ---

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
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
    uniqueIndex("progress_user_manga_volume_idx").on(
      table.userId,
      table.mangaId,
      table.volumeId,
    ),
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
  staff: text("staff"),
  bulkTorrentId: text("bulk_torrent_id"),
  bulkProgress: integer("bulk_progress").notNull().default(0),
  bulkDownloadSpeed: integer("bulk_download_speed").notNull().default(0),
  monitored: integer("monitored", { mode: "boolean" }).notNull().default(true),
  lastMonitoredAt: integer("last_monitored_at", { mode: "timestamp" }),
  lastMetadataRefresh: integer("last_metadata_refresh", { mode: "timestamp" }),
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
    progress: integer("progress").notNull().default(0),
    downloadSpeed: integer("download_speed").notNull().default(0),
    errorMessage: text("error_message"),
    torrentId: text("torrent_id"),
    magnetLink: text("magnet_link"),
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
  autoDownloaded: integer("auto_downloaded", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
