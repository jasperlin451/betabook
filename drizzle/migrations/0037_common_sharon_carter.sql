ALTER TABLE `journal_entries` ADD `is_send_comment` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE journal_entries SET is_send_comment = 1 WHERE is_ascent = 1;
--> statement-breakpoint
-- The note remains send commentary even if deleting/merging its send later
-- changes the entry into a session. All write paths share this classification.
CREATE TRIGGER journal_send_comment_insert
AFTER INSERT ON journal_entries
WHEN NEW.is_ascent = 1 AND NEW.is_send_comment = 0
BEGIN
  UPDATE journal_entries SET is_send_comment = 1 WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER journal_send_comment_update
AFTER UPDATE OF is_ascent, is_send_comment ON journal_entries
WHEN NEW.is_ascent = 1 AND NEW.is_send_comment = 0
BEGIN
  UPDATE journal_entries SET is_send_comment = 1 WHERE id = NEW.id;
END;
