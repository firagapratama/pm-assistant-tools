ALTER TABLE `project_activities` ADD `sprint_number` integer;--> statement-breakpoint
UPDATE `project_activities` SET `sprint_number` = CAST(substr(`name`, 8) AS INTEGER) WHERE `kind` = 'aktivitas' AND `name` GLOB 'Sprint [1-9]*' AND substr(`name`, 8) NOT GLOB '*[^0-9]*';
