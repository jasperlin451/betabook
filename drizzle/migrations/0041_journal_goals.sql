CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`target` integer NOT NULL,
	`discipline` text,
	`grade` integer,
	`timeframe` text NOT NULL,
	`repeat` text DEFAULT 'none' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`timezone` text NOT NULL,
	`grade_match` text DEFAULT 'exact' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "goals_target" CHECK("goals"."target" BETWEEN 1 AND 1000),
	CONSTRAINT "goals_dates" CHECK("goals"."end_date" >= "goals"."start_date"),
	CONSTRAINT "goals_repeat" CHECK("goals"."repeat" = 'none' OR ("goals"."repeat" IN ('week','month') AND "goals"."kind" = 'training')),
	CONSTRAINT "goals_shape" CHECK(("goals"."kind" IN ('volume','grade') AND "goals"."discipline" IN ('boulder','sport','trad') AND ("goals"."grade" IS NULL OR "goals"."grade" >= 0) AND ("goals"."kind" <> 'grade' OR ("goals"."grade" IS NOT NULL AND "goals"."target" = 1))) OR ("goals"."kind" IN ('training','days','new-areas') AND "goals"."discipline" IS NULL AND "goals"."grade" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `goals_user_idx` ON `goals` (`user_id`);
--> statement-breakpoint
CREATE TABLE `goal_periods` (
	`goal_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`target` integer NOT NULL,
	`repeat` text NOT NULL,
	`timezone` text NOT NULL,
	PRIMARY KEY(`goal_id`, `start_date`),
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
