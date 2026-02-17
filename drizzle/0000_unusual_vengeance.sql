CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `download_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`managed_manga_id` integer NOT NULL,
	`managed_volume_id` integer,
	`torrent_name` text NOT NULL,
	`magnet_link` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`auto_downloaded` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`managed_manga_id`) REFERENCES `managed_manga`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`managed_volume_id`) REFERENCES `managed_volume`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `managed_manga` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anilist_id` integer NOT NULL,
	`title_romaji` text,
	`title_english` text,
	`title_native` text,
	`synonyms` text,
	`cover_image` text,
	`banner_image` text,
	`description` text,
	`total_volumes` integer,
	`status` text,
	`genres` text,
	`average_score` integer,
	`staff` text,
	`bulk_torrent_id` text,
	`bulk_progress` integer DEFAULT 0 NOT NULL,
	`bulk_download_speed` integer DEFAULT 0 NOT NULL,
	`monitored` integer DEFAULT true NOT NULL,
	`last_monitored_at` integer,
	`last_metadata_refresh` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `managed_manga_anilist_id_unique` ON `managed_manga` (`anilist_id`);--> statement-breakpoint
CREATE TABLE `managed_volume` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`managed_manga_id` integer NOT NULL,
	`volume_number` integer NOT NULL,
	`status` text DEFAULT 'missing' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`download_speed` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`torrent_id` text,
	`magnet_link` text,
	`download_path` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`managed_manga_id`) REFERENCES `managed_manga`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `managed_volume_manga_number_idx` ON `managed_volume` (`managed_manga_id`,`volume_number`);--> statement-breakpoint
CREATE TABLE `manga` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anilist_id` integer,
	`title` text NOT NULL,
	`folder_name` text NOT NULL,
	`cover_image` text,
	`total_volumes` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manga_anilist_id_unique` ON `manga` (`anilist_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `manga_folder_name_unique` ON `manga` (`folder_name`);--> statement-breakpoint
CREATE TABLE `passkey` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`public_key` text NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`created_at` integer,
	`aaguid` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkey_userId_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkey_credentialID_idx` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE TABLE `reading_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`manga_id` integer NOT NULL,
	`volume_id` integer NOT NULL,
	`current_page` integer DEFAULT 0 NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`last_read_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`volume_id`) REFERENCES `volume`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_user_manga_volume_idx` ON `reading_progress` (`user_id`,`manga_id`,`volume_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `twoFactor_secret_idx` ON `two_factor` (`secret`);--> statement-breakpoint
CREATE INDEX `twoFactor_userId_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'user',
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`two_factor_enabled` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `volume` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manga_id` integer NOT NULL,
	`volume_number` integer NOT NULL,
	`folder_name` text NOT NULL,
	`page_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `volume_manga_number_idx` ON `volume` (`manga_id`,`volume_number`);