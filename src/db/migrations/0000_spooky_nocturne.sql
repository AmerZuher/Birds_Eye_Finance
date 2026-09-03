CREATE TABLE `debts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`monthly_payment` real DEFAULT 0 NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	`start_date` text,
	`end_date` text,
	`currency` text,
	`phone` text,
	`avatar` text,
	`email` text,
	`company` text,
	`contact_id` text
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`icon` text NOT NULL,
	`category` text NOT NULL,
	`currency` text,
	`period` text,
	`notes` text,
	`translation_key` text,
	`custom_period_days` integer
);
--> statement-breakpoint
CREATE TABLE `income_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`currency` text NOT NULL
);
