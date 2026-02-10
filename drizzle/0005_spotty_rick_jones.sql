ALTER TABLE `download_history` ADD `auto_downloaded` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `managed_manga` ADD `last_monitored_at` integer;--> statement-breakpoint
ALTER TABLE `managed_manga` ADD `last_metadata_refresh` integer;--> statement-breakpoint
ALTER TABLE `managed_volume` ADD `progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `managed_volume` ADD `download_speed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `managed_volume` ADD `magnet_link` text;