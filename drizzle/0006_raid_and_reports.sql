CREATE TABLE `status_reports` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`achievements` text DEFAULT '' NOT NULL,
	`obstacles` text DEFAULT '' NOT NULL,
	`next_week` text DEFAULT '' NOT NULL,
	`help_needed` text DEFAULT '' NOT NULL,
	`snapshot` text,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `status_reports_week` ON `status_reports` (`project_id`,`period_start`);--> statement-breakpoint
ALTER TABLE `raid_items` ADD `updated_at` integer;