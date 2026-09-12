ALTER TABLE `climbs` ADD `suggested_grade_tenths_sum` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `climbs` ADD `suggested_grade_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `climbs` ADD `avg_suggested_grade` real GENERATED ALWAYS AS (CASE WHEN suggested_grade_count > 0
        THEN CAST(suggested_grade_tenths_sum AS REAL) / (10.0 * suggested_grade_count)
        ELSE NULL END) VIRTUAL;--> statement-breakpoint
-- Recreate the send aggregate triggers so they also carry the reported grade.
-- A send contributes its suggested grade shifted by the climber's grade feel,
-- in tenths so the running sum stays exact. The -3/+3 here is GRADE_FEEL_TENTHS
-- in lib/sends.ts; changing that constant means another migration that rewrites
-- these triggers and rebuilds every stored sum.
--
-- Triggers are replaced before the backfill below, not after: a send written
-- between the two is counted twice at worst, and the backfill then recomputes
-- it from scratch. The other order would lose that write for good.
DROP TRIGGER IF EXISTS sends_aggregates_ai;--> statement-breakpoint
DROP TRIGGER IF EXISTS sends_aggregates_ad;--> statement-breakpoint
DROP TRIGGER IF EXISTS sends_aggregates_au;--> statement-breakpoint
CREATE TRIGGER sends_aggregates_ai AFTER INSERT ON sends
BEGIN
  UPDATE climbs SET
    send_count   = send_count + 1,
    rating_sum   = rating_sum + COALESCE(new.rating, 0),
    rating_count = rating_count + (new.rating IS NOT NULL),
    suggested_grade_tenths_sum = suggested_grade_tenths_sum + COALESCE(
      new.suggested_grade * 10
        + CASE new.grade_feel WHEN 'low' THEN -3 WHEN 'high' THEN 3 ELSE 0 END, 0),
    suggested_grade_count = suggested_grade_count + (new.suggested_grade IS NOT NULL)
  WHERE id = new.climb_id;
END;--> statement-breakpoint
CREATE TRIGGER sends_aggregates_ad AFTER DELETE ON sends
BEGIN
  UPDATE climbs SET
    send_count   = send_count - 1,
    rating_sum   = rating_sum - COALESCE(old.rating, 0),
    rating_count = rating_count - (old.rating IS NOT NULL),
    suggested_grade_tenths_sum = suggested_grade_tenths_sum - COALESCE(
      old.suggested_grade * 10
        + CASE old.grade_feel WHEN 'low' THEN -3 WHEN 'high' THEN 3 ELSE 0 END, 0),
    suggested_grade_count = suggested_grade_count - (old.suggested_grade IS NOT NULL)
  WHERE id = old.climb_id;
END;--> statement-breakpoint
CREATE TRIGGER sends_aggregates_au AFTER UPDATE ON sends
BEGIN
  UPDATE climbs SET
    send_count   = send_count - 1,
    rating_sum   = rating_sum - COALESCE(old.rating, 0),
    rating_count = rating_count - (old.rating IS NOT NULL),
    suggested_grade_tenths_sum = suggested_grade_tenths_sum - COALESCE(
      old.suggested_grade * 10
        + CASE old.grade_feel WHEN 'low' THEN -3 WHEN 'high' THEN 3 ELSE 0 END, 0),
    suggested_grade_count = suggested_grade_count - (old.suggested_grade IS NOT NULL)
  WHERE id = old.climb_id;
  UPDATE climbs SET
    send_count   = send_count + 1,
    rating_sum   = rating_sum + COALESCE(new.rating, 0),
    rating_count = rating_count + (new.rating IS NOT NULL),
    suggested_grade_tenths_sum = suggested_grade_tenths_sum + COALESCE(
      new.suggested_grade * 10
        + CASE new.grade_feel WHEN 'low' THEN -3 WHEN 'high' THEN 3 ELSE 0 END, 0),
    suggested_grade_count = suggested_grade_count + (new.suggested_grade IS NOT NULL)
  WHERE id = new.climb_id;
END;--> statement-breakpoint
UPDATE climbs SET
  suggested_grade_tenths_sum = COALESCE((
    SELECT SUM(s.suggested_grade * 10
      + CASE s.grade_feel WHEN 'low' THEN -3 WHEN 'high' THEN 3 ELSE 0 END)
    FROM sends s WHERE s.climb_id = climbs.id AND s.suggested_grade IS NOT NULL
  ), 0),
  suggested_grade_count = (
    SELECT COUNT(*) FROM sends s
    WHERE s.climb_id = climbs.id AND s.suggested_grade IS NOT NULL
  );
