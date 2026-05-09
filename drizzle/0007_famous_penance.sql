CREATE TABLE `dict_meta` (
	`source` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`entry_count` integer DEFAULT 0 NOT NULL,
	`built_at` integer DEFAULT (unixepoch()) NOT NULL
);
