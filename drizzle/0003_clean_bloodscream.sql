CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int NOT NULL,
	`projectId` int NOT NULL,
	`status` enum('PENDING','GENERATING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
	`storagePath` varchar(512),
	`downloadUrl` text,
	`filename` varchar(255),
	`sizeBytes` int,
	`error` text,
	`requestedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
