CREATE TABLE `project_features` (
	`project_id` integer NOT NULL,
	`feature_id` integer NOT NULL,
	`baseline_start` integer NOT NULL,
	`baseline_end` integer NOT NULL,
	`plan_start` integer NOT NULL,
	`plan_end` integer NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feature_id`) REFERENCES `estimate_features`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_features_pk` ON `project_features` (`project_id`,`feature_id`);