CREATE TABLE `project_availability` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`kind` text NOT NULL,
	`people` real DEFAULT 1 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`hours` real DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
