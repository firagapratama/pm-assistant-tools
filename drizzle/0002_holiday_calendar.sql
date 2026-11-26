CREATE TABLE `holidays` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holidays_date_unique` ON `holidays` (`date`);--> statement-breakpoint
ALTER TABLE `estimates` ADD `planned_start` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `snapshot_holidays` text DEFAULT '[]' NOT NULL;