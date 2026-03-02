CREATE TABLE `ai_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int NOT NULL,
	`jobId` int,
	`summary` text,
	`recommendations` json,
	`kpis` json,
	`status` enum('PENDING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`status` enum('QUEUED','RUNNING','DONE','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
	`payload` json,
	`result` json,
	`error` text,
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`runAfter` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
