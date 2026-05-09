ALTER TABLE `user_preferences` ADD `anki_settings` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `copy_strip_linebreaks` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `text_view_button` integer DEFAULT false NOT NULL;