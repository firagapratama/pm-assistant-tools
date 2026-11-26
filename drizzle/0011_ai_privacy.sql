CREATE TABLE `ai_calls` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`chars` integer NOT NULL,
	`anonymized` integer NOT NULL,
	`ok` integer NOT NULL,
	`features` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `estimate_features` ADD `ai_draft` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `ai_enabled` integer DEFAULT true NOT NULL;