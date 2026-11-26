CREATE TABLE `change_requests` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`requester` text DEFAULT '' NOT NULL,
	`request_date` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`efforts` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'diajukan' NOT NULL,
	`approver` text DEFAULT '' NOT NULL,
	`decision_date` text,
	`decision_note` text DEFAULT '' NOT NULL,
	`impact` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `change_requests_number` ON `change_requests` (`project_id`,`number`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project_features` (
	`project_id` integer NOT NULL,
	`feature_id` integer,
	`change_request_id` integer,
	`baseline_start` integer NOT NULL,
	`baseline_end` integer NOT NULL,
	`plan_start` integer NOT NULL,
	`plan_end` integer NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feature_id`) REFERENCES `estimate_features`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`change_request_id`) REFERENCES `change_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_project_features`("project_id", "feature_id", "change_request_id", "baseline_start", "baseline_end", "plan_start", "plan_end", "progress", "updated_at") SELECT "project_id", "feature_id", NULL, "baseline_start", "baseline_end", "plan_start", "plan_end", "progress", "updated_at" FROM `project_features`;--> statement-breakpoint
DROP TABLE `project_features`;--> statement-breakpoint
ALTER TABLE `__new_project_features` RENAME TO `project_features`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `project_features_pk` ON `project_features` (`project_id`,`feature_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_features_cr` ON `project_features` (`change_request_id`);