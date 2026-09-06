ALTER TABLE `user` ADD `send_comment_visibility` text DEFAULT 'private' NOT NULL;
--> statement-breakpoint
UPDATE `user` SET `send_comment_visibility` = `journal_visibility`;
