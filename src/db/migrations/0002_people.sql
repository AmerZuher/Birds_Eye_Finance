CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`phone` text,
	`phone_key` text,
	`email` text,
	`company` text,
	`avatar` text,
	`contact_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `people_name_key_idx` ON `people` (`name_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_phone_key_uq` ON `people` (`phone_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_contact_id_uq` ON `people` (`contact_id`);--> statement-breakpoint
ALTER TABLE `debts` ADD `person_id` integer REFERENCES people(id);