CREATE TABLE `debt_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`debt_id` integer NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `debt_adjustments_debt_id_idx` ON `debt_adjustments` (`debt_id`);