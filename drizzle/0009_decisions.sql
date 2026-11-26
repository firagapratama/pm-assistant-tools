CREATE TABLE `decisions` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`number` integer NOT NULL,
	`date` text NOT NULL,
	`decision` text NOT NULL,
	`decided_by` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`alternatives` text DEFAULT '' NOT NULL,
	`impact` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`supersedes_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supersedes_id`) REFERENCES `decisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `decisions_number` ON `decisions` (`project_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `decisions_supersedes` ON `decisions` (`supersedes_id`);