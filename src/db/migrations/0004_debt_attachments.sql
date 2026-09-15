CREATE TABLE `debt_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`debt_id` integer NOT NULL,
	`adjustment_id` integer,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`original_name` text,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjustment_id`) REFERENCES `debt_adjustments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `debt_attachments_debt_id_idx` ON `debt_attachments` (`debt_id`);