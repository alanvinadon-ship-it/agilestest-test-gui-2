CREATE TABLE `artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int NOT NULL,
	`type` varchar(64) NOT NULL DEFAULT 'OTHER',
	`filename` varchar(512) NOT NULL,
	`mimeType` varchar(128),
	`sizeBytes` int NOT NULL DEFAULT 0,
	`storagePath` varchar(1024),
	`storageUrl` varchar(1024),
	`checksum` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(128) NOT NULL,
	`entity` varchar(128) NOT NULL,
	`entityId` varchar(128),
	`details` json,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `captures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`executionId` int,
	`name` varchar(255) NOT NULL,
	`captureType` enum('LOGS','PCAP') NOT NULL DEFAULT 'PCAP',
	`status` enum('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
	`targetType` enum('K8S','SSH','PROBE') NOT NULL DEFAULT 'SSH',
	`config` json,
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `captures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `datasets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`datasetType` varchar(128) NOT NULL,
	`data` json,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `datasets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`profileId` int,
	`scenarioId` int,
	`status` enum('PENDING','RUNNING','PASSED','FAILED','ERROR','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`runnerType` varchar(64),
	`scriptId` varchar(128),
	`scriptVersion` int,
	`datasetBundleId` int,
	`targetEnv` enum('DEV','PREPROD','PILOT_ORANGE','PROD') DEFAULT 'DEV',
	`runnerId` varchar(128),
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`durationMs` int,
	`artifactsCount` int NOT NULL DEFAULT 0,
	`incidentsCount` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`scenarioId` int,
	`name` varchar(255) NOT NULL,
	`framework` varchar(64) NOT NULL,
	`language` varchar(64) NOT NULL DEFAULT 'typescript',
	`code` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('DRAFT','ACTIVE','DEPRECATED') NOT NULL DEFAULT 'DRAFT',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generated_scripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int NOT NULL,
	`severity` enum('CRITICAL','MAJOR','MINOR','INFO') NOT NULL DEFAULT 'INFO',
	`title` varchar(512) NOT NULL,
	`description` text,
	`stepIndex` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('ADMIN','MANAGER','VIEWER') NOT NULL DEFAULT 'VIEWER',
	`token` varchar(128) NOT NULL,
	`status` enum('PENDING','ACCEPTED','EXPIRED','REVOKED') NOT NULL DEFAULT 'PENDING',
	`invitedBy` int NOT NULL,
	`acceptedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `probes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`probeType` enum('LINUX_EDGE','K8S_CLUSTER','NETWORK_TAP') NOT NULL DEFAULT 'LINUX_EDGE',
	`status` enum('ONLINE','OFFLINE','DEGRADED') NOT NULL DEFAULT 'OFFLINE',
	`host` varchar(255),
	`port` int,
	`capabilities` json,
	`config` json,
	`lastSeenAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `probes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('ADMIN','MANAGER','VIEWER') NOT NULL DEFAULT 'VIEWER',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`domain` varchar(64) NOT NULL DEFAULT 'WEB',
	`status` enum('ACTIVE','ARCHIVED','DRAFT') NOT NULL DEFAULT 'ACTIVE',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`profileType` varchar(64) NOT NULL DEFAULT 'WEB',
	`config` json,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`profileId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`testType` enum('VABF','VSR','VABE') NOT NULL DEFAULT 'VABF',
	`status` enum('DRAFT','FINAL','DEPRECATED') NOT NULL DEFAULT 'DRAFT',
	`priority` enum('P0','P1','P2') NOT NULL DEFAULT 'P1',
	`steps` json,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_scenarios_id` PRIMARY KEY(`id`)
);
