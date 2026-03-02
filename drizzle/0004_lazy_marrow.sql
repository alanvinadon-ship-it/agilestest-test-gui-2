CREATE TABLE `probe_alert_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`probeId` int NOT NULL,
	`orgId` int NOT NULL,
	`healthState` enum('GREEN','ORANGE','RED') NOT NULL DEFAULT 'GREEN',
	`redSinceAt` timestamp,
	`lastNotifiedAt` timestamp,
	`alertCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `probe_alert_state_id` PRIMARY KEY(`id`)
);
