CREATE TABLE `balance_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `balance_snapshots_date_idx` ON `balance_snapshots` (`date`);