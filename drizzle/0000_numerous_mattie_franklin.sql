CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`seat` integer NOT NULL,
	`side` integer NOT NULL,
	`is_host` integer DEFAULT false NOT NULL,
	`token_hash` text NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_session_seat_idx` ON `participants` (`session_id`,`seat`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_session_token_idx` ON `participants` (`session_id`,`token_hash`);--> statement-breakpoint
CREATE TABLE `round_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`side` integer NOT NULL,
	`participant_id` text NOT NULL,
	`breakdown` text NOT NULL,
	`score` integer NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `round_submissions_side_idx` ON `round_submissions` (`session_id`,`round_number`,`side`);--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`solo_seat` integer,
	`scores` text NOT NULL,
	`side_scores` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rounds_session_number_idx` ON `rounds` (`session_id`,`round_number`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`mode` text NOT NULL,
	`target` integer NOT NULL,
	`bonus_rules` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`round_number` integer DEFAULT 1 NOT NULL,
	`solo_seat` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_code_idx` ON `sessions` (`code`);