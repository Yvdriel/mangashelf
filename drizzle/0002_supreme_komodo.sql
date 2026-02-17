PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_import_history` (
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
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_import_history`("id", "manga_id", "manga_title", "source_type", "source_path", "volumes_imported", "pages_imported", "total_size_bytes", "mode", "status", "error_message", "user_id", "created_at") SELECT "id", "manga_id", "manga_title", "source_type", "source_path", "volumes_imported", "pages_imported", "total_size_bytes", "mode", "status", "error_message", "user_id", "created_at" FROM `import_history`;--> statement-breakpoint
DROP TABLE `import_history`;--> statement-breakpoint
ALTER TABLE `__new_import_history` RENAME TO `import_history`;--> statement-breakpoint
PRAGMA foreign_keys=ON;