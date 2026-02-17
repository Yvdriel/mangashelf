CREATE TABLE `import_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manga_id` integer,
	`manga_title` text NOT NULL,
	`source_type` text NOT NULL,
	`source_path` text NOT NULL,
	`volumes_imported` integer NOT NULL,
	`pages_imported` integer NOT NULL,
	`total_size_bytes` integer NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_history_volume` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer NOT NULL,
	`volume_number` integer NOT NULL,
	`page_count` integer NOT NULL,
	`size_bytes` integer NOT NULL,
	`source_path` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	FOREIGN KEY (`import_id`) REFERENCES `import_history`(`id`) ON UPDATE no action ON DELETE cascade
);
