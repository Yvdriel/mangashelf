CREATE TABLE `download_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`managed_manga_id` integer NOT NULL,
	`managed_volume_id` integer,
	`torrent_name` text NOT NULL,
	`magnet_link` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
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
	`monitored` integer DEFAULT true NOT NULL,
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
	`torrent_id` text,
	`download_path` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`managed_manga_id`) REFERENCES `managed_manga`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `managed_volume_manga_number_idx` ON `managed_volume` (`managed_manga_id`,`volume_number`);