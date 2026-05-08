CREATE TABLE `volume_ocr` (
	`volume_id` integer PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`job_id` text,
	`error_message` text,
	`queued_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`volume_id`) REFERENCES `volume`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `ocr_enabled` integer DEFAULT false NOT NULL;