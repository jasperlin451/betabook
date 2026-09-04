CREATE TABLE `change_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`payload` text NOT NULL,
	`requested_by` text NOT NULL,
	`requested_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`review_note` text,
	FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `change_requests_status_idx` ON `change_requests` (`status`);--> statement-breakpoint
CREATE INDEX `change_requests_entity_idx` ON `change_requests` (`type`,`entity_id`);