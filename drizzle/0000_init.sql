CREATE TABLE `estimate_efforts` (
	`feature_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`o` real NOT NULL,
	`m` real NOT NULL,
	`p` real NOT NULL,
	FOREIGN KEY (`feature_id`) REFERENCES `estimate_features`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `estimate_efforts_pk` ON `estimate_efforts` (`feature_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `estimate_features` (
	`id` integer PRIMARY KEY NOT NULL,
	`estimate_id` integer NOT NULL,
	`module` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'must' NOT NULL,
	`assumptions` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `estimates` (
	`id` integer PRIMARY KEY NOT NULL,
	`prospect_id` integer NOT NULL,
	`version` integer NOT NULL,
	`is_final` integer DEFAULT false NOT NULL,
	`finalized_at` integer,
	`snapshot_settings` text NOT NULL,
	`snapshot_rates` text NOT NULL,
	`assumptions` text DEFAULT '' NOT NULL,
	`exclusions` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `estimates_prospect_version` ON `estimates` (`prospect_id`,`version`);--> statement-breakpoint
CREATE TABLE `feature_template_efforts` (
	`template_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`o` real NOT NULL,
	`m` real NOT NULL,
	`p` real NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `feature_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feature_template_efforts_pk` ON `feature_template_efforts` (`template_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `feature_templates` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`complexity` text DEFAULT 'sedang' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`assumptions` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY NOT NULL,
	`ip` text NOT NULL,
	`success` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_ip_time` ON `login_attempts` (`ip`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY NOT NULL,
	`prospect_id` integer NOT NULL,
	`baseline_estimate_id` integer NOT NULL,
	`baseline_scenario_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`status` text DEFAULT 'aktif' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`baseline_estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`baseline_scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_prospect_id_unique` ON `projects` (`prospect_id`);--> statement-breakpoint
CREATE TABLE `prospects` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client` text DEFAULT '' NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`needs` text DEFAULT '' NOT NULL,
	`business_goal` text DEFAULT '' NOT NULL,
	`deadline` text,
	`budget` integer,
	`status` text DEFAULT 'prospek' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`cancel_reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `raid_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`impact` integer,
	`likelihood` integer,
	`mitigation` text DEFAULT '' NOT NULL,
	`review_date` text,
	`status` text DEFAULT 'terbuka' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rate_cards` (
	`id` integer PRIMARY KEY NOT NULL,
	`role_id` integer NOT NULL,
	`monthly_rate` integer NOT NULL,
	`effective_from` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_cards_role_date` ON `rate_cards` (`role_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`level` text,
	`source` text DEFAULT 'internal' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenario_team` (
	`scenario_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`mp` real NOT NULL,
	`months` real,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenario_team_pk` ON `scenario_team` (`scenario_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` integer PRIMARY KEY NOT NULL,
	`estimate_id` integer NOT NULL,
	`name` text NOT NULL,
	`priorities` text,
	`overhead_items` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`values` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sprints` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`number` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`plan` text DEFAULT '' NOT NULL,
	`actual` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `status_history` (
	`id` integer PRIMARY KEY NOT NULL,
	`prospect_id` integer NOT NULL,
	`from` text,
	`to` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);