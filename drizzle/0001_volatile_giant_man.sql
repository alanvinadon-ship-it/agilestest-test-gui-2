CREATE TABLE `analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`incident_id` varchar(36) NOT NULL,
	`status` enum('PENDING','IN_PROGRESS','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
	`observation` text,
	`hypotheses` json,
	`root_cause` text,
	`root_cause_justification` text,
	`recommended_solution` text,
	`confidence_score` float,
	`pipeline_phases` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `analyses_id` PRIMARY KEY(`id`),
	CONSTRAINT `analyses_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`execution_id` varchar(36) NOT NULL,
	`type` varchar(50) NOT NULL,
	`filename` varchar(500) NOT NULL,
	`name` varchar(255),
	`mime_type` varchar(100),
	`content_type` varchar(100),
	`size_bytes` int DEFAULT 0,
	`storage_path` varchar(500),
	`storage_url` varchar(500),
	`s3_uri` varchar(500),
	`checksum` varchar(128),
	`capture_job_id` varchar(36),
	`download_url` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`uploaded_at` timestamp,
	CONSTRAINT `artifacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `artifacts_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`actor_id` varchar(64),
	`actor_name` varchar(255),
	`actor_email` varchar(320),
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(50) NOT NULL,
	`entity_id` varchar(36),
	`target_label` varchar(500),
	`metadata` json,
	`trace_id` varchar(64),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_logs_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `bundle_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundle_id` varchar(36) NOT NULL,
	`dataset_id` varchar(36) NOT NULL,
	CONSTRAINT `bundle_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `capture_artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`execution_id` varchar(36) NOT NULL,
	`type` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`storage_url` varchar(500),
	`s3_uri` varchar(500),
	`content_type` varchar(100),
	`size_bytes` int,
	`checksum` varchar(128),
	`capture_job_id` varchar(36),
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	`download_url` varchar(500),
	CONSTRAINT `capture_artifacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `capture_artifacts_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `capture_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`execution_id` varchar(36) NOT NULL,
	`incident_id` varchar(36),
	`project_id` varchar(36) NOT NULL,
	`triggered_by` varchar(64),
	`status` enum('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
	`capture_type` enum('LOGS','PCAP') NOT NULL,
	`target_type` enum('K8S','SSH','PROBE') NOT NULL,
	`duration_seconds` int DEFAULT 60,
	`max_size_mb` int DEFAULT 100,
	`profile` varchar(50),
	`params` json,
	`error_message` text,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `capture_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `capture_jobs_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `capture_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`capture_mode` enum('RUNNER','PROBE') NOT NULL,
	`trigger_on` json,
	`auto_capture` boolean DEFAULT false,
	`duration` int DEFAULT 60,
	`max_size` int DEFAULT 100,
	`bpf_filter` varchar(500),
	`interface_name` varchar(100),
	`probe_id` varchar(36),
	`enabled` boolean DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `capture_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `capture_policies_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `capture_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`policy_id` varchar(36) NOT NULL,
	`execution_id` varchar(36),
	`probe_id` varchar(36),
	`status` enum('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
	`pcap_path` varchar(500),
	`pcap_size` int,
	`packet_count` int,
	`error_message` text,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `capture_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `capture_sessions_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `capture_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`capture_id` varchar(36) NOT NULL,
	`namespace` varchar(100),
	`pod_selector` varchar(255),
	`container_name` varchar(100),
	`host` varchar(255),
	`ssh_port` int,
	`ssh_user` varchar(100),
	`log_paths` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `capture_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `capture_sources_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `dataset_bundles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`env` enum('DEV','PREPROD','PILOT_ORANGE','PROD') NOT NULL,
	`version` int DEFAULT 1,
	`status` enum('DRAFT','ACTIVE','DEPRECATED') NOT NULL DEFAULT 'DRAFT',
	`tags` json,
	`created_by` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dataset_bundles_id` PRIMARY KEY(`id`),
	CONSTRAINT `dataset_bundles_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `dataset_instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`dataset_type_id` varchar(100) NOT NULL,
	`env` enum('DEV','PREPROD','PILOT_ORANGE','PROD') NOT NULL,
	`version` int DEFAULT 1,
	`status` enum('DRAFT','ACTIVE','DEPRECATED') NOT NULL DEFAULT 'DRAFT',
	`values_json` json,
	`notes` text,
	`created_by` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dataset_instances_id` PRIMARY KEY(`id`),
	CONSTRAINT `dataset_instances_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `dataset_secrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dataset_id` varchar(36) NOT NULL,
	`key_path` varchar(255) NOT NULL,
	`is_secret` boolean NOT NULL DEFAULT true,
	CONSTRAINT `dataset_secrets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dataset_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`dataset_type_id` varchar(100) NOT NULL,
	`domain` varchar(50) NOT NULL,
	`test_type` varchar(10),
	`name` varchar(255) NOT NULL,
	`description` text,
	`schema_fields` json,
	`example_placeholders` json,
	`tags` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dataset_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `dataset_types_uid_unique` UNIQUE(`uid`),
	CONSTRAINT `idx_dataset_types_slug` UNIQUE(`dataset_type_id`)
);
--> statement-breakpoint
CREATE TABLE `datasets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`format` enum('CSV','JSON','YAML') NOT NULL DEFAULT 'JSON',
	`row_count` int DEFAULT 0,
	`size_bytes` int DEFAULT 0,
	`storage_url` varchar(500),
	`dataset_type_id` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `datasets_id` PRIMARY KEY(`id`),
	CONSTRAINT `datasets_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `drive_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`target_env` enum('DEV','PREPROD','PILOT_ORANGE','PROD'),
	`network_type` varchar(50),
	`area` varchar(255),
	`start_date` varchar(30),
	`end_date` varchar(30),
	`status` enum('DRAFT','ACTIVE','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`created_by` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drive_campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `drive_campaigns_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `drive_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`campaign_id` varchar(36) NOT NULL,
	`source_filename` varchar(500) NOT NULL,
	`source_format` enum('CSV','JSON','GPX','GEOJSON','IPERF3') NOT NULL,
	`samples_imported` int DEFAULT 0,
	`samples_skipped` int DEFAULT 0,
	`errors` json,
	`imported_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `drive_imports_id` PRIMARY KEY(`id`),
	CONSTRAINT `drive_imports_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `drive_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`campaign_id` varchar(36) NOT NULL,
	`route_id` varchar(36) NOT NULL,
	`device_id` varchar(36) NOT NULL,
	`target_env` enum('DEV','PREPROD','PILOT_ORANGE','PROD'),
	`runner_id` varchar(64),
	`status` enum('PENDING','RUNNING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
	`progress_pct` int DEFAULT 0,
	`error_message` text,
	`artifacts_manifest` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`started_at` timestamp,
	`finished_at` timestamp,
	CONSTRAINT `drive_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `drive_jobs_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `drive_probe_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`location` json,
	`capture_type` varchar(50),
	`retention_days` int DEFAULT 30,
	`max_size_mb` int DEFAULT 500,
	`rotation` boolean DEFAULT true,
	`output_target` varchar(50),
	`enabled` boolean DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drive_probe_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `drive_probe_configs_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `drive_routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`campaign_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`route_geojson` json,
	`checkpoints_geojson` json,
	`expected_duration_min` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drive_routes_id` PRIMARY KEY(`id`),
	CONSTRAINT `drive_routes_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `drive_run_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drive_job_id` varchar(36) NOT NULL,
	`campaign_id` varchar(36) NOT NULL,
	`total_samples` int DEFAULT 0,
	`duration_sec` int DEFAULT 0,
	`distance_km` float DEFAULT 0,
	`kpi_averages` json,
	`kpi_min` json,
	`kpi_max` json,
	`threshold_violations` json,
	`overall_pass` boolean DEFAULT true,
	CONSTRAINT `drive_run_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `drive_run_summaries_drive_job_id_unique` UNIQUE(`drive_job_id`)
);
--> statement-breakpoint
CREATE TABLE `executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`profile_id` varchar(36) NOT NULL,
	`scenario_id` varchar(36) NOT NULL,
	`status` enum('PENDING','RUNNING','PASSED','FAILED','ERROR','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`runner_type` varchar(50),
	`script_id` varchar(36),
	`script_version` int,
	`dataset_bundle_id` varchar(36),
	`target_env` enum('DEV','PREPROD','PILOT_ORANGE','PROD'),
	`runner_id` varchar(64),
	`ai_repair_from_execution_id` varchar(36),
	`started_at` timestamp,
	`finished_at` timestamp,
	`duration_ms` int,
	`artifacts_count` int DEFAULT 0,
	`incidents_count` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executions_id` PRIMARY KEY(`id`),
	CONSTRAINT `executions_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `generated_scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`scenario_id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`version` int DEFAULT 1,
	`language` varchar(50) DEFAULT 'typescript',
	`framework` varchar(50) DEFAULT 'playwright',
	`code` text,
	`script_status` enum('DRAFT','VALIDATED','DEPRECATED') NOT NULL DEFAULT 'DRAFT',
	`generated_by` varchar(50) DEFAULT 'AI',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generated_scripts_id` PRIMARY KEY(`id`),
	CONSTRAINT `generated_scripts_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`execution_id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`severity` enum('CRITICAL','MAJOR','MINOR','INFO') NOT NULL DEFAULT 'INFO',
	`step_name` varchar(255),
	`expected_result` text,
	`actual_result` text,
	`detected_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`),
	CONSTRAINT `incidents_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`email` varchar(320) NOT NULL,
	`invite_role` enum('ADMIN','MANAGER','VIEWER') NOT NULL DEFAULT 'VIEWER',
	`invite_status` enum('PENDING','ACCEPTED','REVOKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
	`token` varchar(128) NOT NULL,
	`invited_by` varchar(64),
	`invited_by_name` varchar(255),
	`expires_at` timestamp NOT NULL,
	`accepted_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_uid_unique` UNIQUE(`uid`),
	CONSTRAINT `invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `kpi_samples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`drive_job_id` varchar(36) NOT NULL,
	`campaign_id` varchar(36) NOT NULL,
	`route_id` varchar(36) NOT NULL,
	`timestamp` timestamp NOT NULL,
	`lat` float NOT NULL,
	`lon` float NOT NULL,
	`kpi_name` varchar(50) NOT NULL,
	`value` float NOT NULL,
	`unit` varchar(20),
	`cell_id` varchar(50),
	`technology` varchar(20),
	CONSTRAINT `kpi_samples_id` PRIMARY KEY(`id`),
	CONSTRAINT `kpi_samples_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `notification_delivery_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`ts` timestamp NOT NULL DEFAULT (now()),
	`ndl_channel` enum('SMS','EMAIL') NOT NULL,
	`provider` varchar(50) NOT NULL,
	`event_type` varchar(100) NOT NULL,
	`rule_id` varchar(100),
	`template_id` varchar(100),
	`recipient` varchar(320) NOT NULL,
	`ndl_status` enum('SENT','FAILED','SKIPPED','THROTTLED') NOT NULL,
	`error_message` text,
	`trace_id` varchar(64),
	`metadata` json,
	CONSTRAINT `notification_delivery_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_delivery_logs_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `notification_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_id` varchar(100) NOT NULL,
	`event_type` varchar(100) NOT NULL,
	`enabled` boolean DEFAULT true,
	`channels_enabled` json,
	`template_sms_id` varchar(100),
	`template_email_id` varchar(100),
	`recipients` json,
	`custom_recipients_emails` json,
	`custom_recipients_msisdn` json,
	`throttle_policy` json,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` varchar(64),
	CONSTRAINT `notification_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_rules_rule_id_unique` UNIQUE(`rule_id`)
);
--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channel` enum('SMS','EMAIL') NOT NULL,
	`provider` varchar(50) NOT NULL,
	`enabled` boolean DEFAULT false,
	`config` json,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` varchar(64),
	CONSTRAINT `notification_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_settings_channel_unique` UNIQUE(`channel`)
);
--> statement-breakpoint
CREATE TABLE `notification_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` varchar(100) NOT NULL,
	`notif_tpl_channel` enum('SMS','EMAIL') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`subject` varchar(500),
	`body_text` text,
	`body_html` text,
	`variables_schema` json,
	`is_system` boolean DEFAULT false,
	`notif_tpl_status` enum('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` varchar(64),
	CONSTRAINT `notification_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_templates_template_id_unique` UNIQUE(`template_id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`module` varchar(100) NOT NULL,
	`action` varchar(50) NOT NULL,
	`description` text,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_uid_unique` UNIQUE(`uid`),
	CONSTRAINT `idx_perm_module_action` UNIQUE(`module`,`action`)
);
--> statement-breakpoint
CREATE TABLE `probe_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`probe_id` varchar(36) NOT NULL,
	`max_capture_duration_sec` int DEFAULT 300,
	`max_capture_size_mb` int DEFAULT 500,
	`pcap_interfaces_allowlist` json,
	`pcap_bpf_allowlist` json,
	`storage_kind` varchar(50) DEFAULT 'minio',
	`storage_endpoint` varchar(255),
	`storage_bucket` varchar(100),
	`storage_prefix` varchar(255),
	`redaction_enabled` boolean DEFAULT false,
	`redaction_patterns` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `probe_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `probe_policies_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `probes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`site` varchar(100) NOT NULL,
	`zone` varchar(100) NOT NULL,
	`type` enum('LINUX_EDGE','K8S_CLUSTER','NETWORK_TAP') NOT NULL,
	`capabilities` json,
	`status` enum('ONLINE','OFFLINE','DEGRADED') NOT NULL DEFAULT 'OFFLINE',
	`auth_token_hash` varchar(255),
	`last_seen_at` timestamp,
	`metadata` json,
	`version` varchar(50),
	`uptime_seconds` int,
	`cpu_percent` float,
	`disk_free_mb` int,
	`interfaces` json,
	`active_sessions` int,
	`total_captures` int,
	`last_error` text,
	`health_status` enum('healthy','degraded','unhealthy'),
	`heartbeat_interval_sec` int DEFAULT 30,
	`allowlist_cidrs` json,
	`tls_enabled` boolean DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `probes_id` PRIMARY KEY(`id`),
	CONSTRAINT `probes_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `project_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`project_name` varchar(255),
	`user_id` varchar(64) NOT NULL,
	`user_email` varchar(320),
	`user_name` varchar(255),
	`project_role` enum('PROJECT_ADMIN','PROJECT_EDITOR','PROJECT_VIEWER') NOT NULL DEFAULT 'PROJECT_VIEWER',
	`added_by` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_memberships_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`domain` varchar(50) NOT NULL,
	`status` enum('ACTIVE','ARCHIVED','DRAFT') NOT NULL DEFAULT 'ACTIVE',
	`created_by` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`permission_id` varchar(36) NOT NULL,
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`scope` enum('GLOBAL','PROJECT') NOT NULL DEFAULT 'GLOBAL',
	`is_system` boolean DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_uid_unique` UNIQUE(`uid`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `runner_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`execution_id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`runner_id` varchar(64),
	`status` enum('PENDING','RUNNING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
	`script_id` varchar(36),
	`script_version` int,
	`download_url` varchar(500),
	`dataset_bundle_id` varchar(36),
	`target_env` enum('DEV','PREPROD','PILOT_ORANGE','PROD'),
	`artifact_upload_policy` json,
	`metrics` json,
	`artifact_manifest` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`started_at` timestamp,
	`finished_at` timestamp,
	CONSTRAINT `runner_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `runner_jobs_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `test_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`type` varchar(50) NOT NULL,
	`model` varchar(255) NOT NULL,
	`os_version` varchar(100),
	`diag_capable` boolean DEFAULT false,
	`tools_enabled` json,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `test_devices_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `test_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`protocol` varchar(50) DEFAULT 'CUSTOM',
	`test_type` enum('VABF','VSR','VABE') NOT NULL,
	`domain` varchar(50),
	`profile_type` varchar(50),
	`target_host` varchar(255),
	`target_port` int DEFAULT 0,
	`parameters` json,
	`config` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `test_profiles_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `test_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(36) NOT NULL,
	`scenario_code` varchar(100) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`profile_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`test_type` enum('VABF','VSR','VABE') NOT NULL,
	`status` enum('DRAFT','FINAL','DEPRECATED') NOT NULL DEFAULT 'DRAFT',
	`version` int DEFAULT 1,
	`steps` json,
	`required_dataset_types` json,
	`artifact_policy` json,
	`kpi_thresholds` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_scenarios_id` PRIMARY KEY(`id`),
	CONSTRAINT `test_scenarios_uid_unique` UNIQUE(`uid`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `full_name` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('ACTIVE','DISABLED','INVITED') DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` varchar(255);--> statement-breakpoint
CREATE INDEX `idx_ana_incident` ON `analyses` (`incident_id`);--> statement-breakpoint
CREATE INDEX `idx_art_execution` ON `artifacts` (`execution_id`);--> statement-breakpoint
CREATE INDEX `idx_art_type` ON `artifacts` (`type`);--> statement-breakpoint
CREATE INDEX `idx_al_action` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_al_entity` ON `audit_logs` (`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_al_actor` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_al_ts` ON `audit_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_bi_bundle` ON `bundle_items` (`bundle_id`);--> statement-breakpoint
CREATE INDEX `idx_bi_dataset` ON `bundle_items` (`dataset_id`);--> statement-breakpoint
CREATE INDEX `idx_ca_execution` ON `capture_artifacts` (`execution_id`);--> statement-breakpoint
CREATE INDEX `idx_cj_execution` ON `capture_jobs` (`execution_id`);--> statement-breakpoint
CREATE INDEX `idx_cj_project` ON `capture_jobs` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_cj_status` ON `capture_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_cp_project` ON `capture_policies` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_csess_policy` ON `capture_sessions` (`policy_id`);--> statement-breakpoint
CREATE INDEX `idx_csess_execution` ON `capture_sessions` (`execution_id`);--> statement-breakpoint
CREATE INDEX `idx_cs_capture` ON `capture_sources` (`capture_id`);--> statement-breakpoint
CREATE INDEX `idx_bundles_project` ON `dataset_bundles` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_di_project` ON `dataset_instances` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_di_type` ON `dataset_instances` (`dataset_type_id`);--> statement-breakpoint
CREATE INDEX `idx_ds_dataset` ON `dataset_secrets` (`dataset_id`);--> statement-breakpoint
CREATE INDEX `idx_datasets_project` ON `datasets` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_dc_project` ON `drive_campaigns` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_dc_status` ON `drive_campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `idx_di2_campaign` ON `drive_imports` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `idx_dj_campaign` ON `drive_jobs` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `idx_dj_status` ON `drive_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dpc_project` ON `drive_probe_configs` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_dr_campaign` ON `drive_routes` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `idx_drs_campaign` ON `drive_run_summaries` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `idx_exec_project` ON `executions` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_exec_status` ON `executions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_exec_scenario` ON `executions` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `idx_gs_scenario` ON `generated_scripts` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `idx_gs_project` ON `generated_scripts` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_inc_execution` ON `incidents` (`execution_id`);--> statement-breakpoint
CREATE INDEX `idx_inc_project` ON `incidents` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_inc_severity` ON `incidents` (`severity`);--> statement-breakpoint
CREATE INDEX `idx_inv_email` ON `invites` (`email`);--> statement-breakpoint
CREATE INDEX `idx_inv_status` ON `invites` (`invite_status`);--> statement-breakpoint
CREATE INDEX `idx_inv_token` ON `invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_kpi_job` ON `kpi_samples` (`drive_job_id`);--> statement-breakpoint
CREATE INDEX `idx_kpi_campaign` ON `kpi_samples` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `idx_kpi_name` ON `kpi_samples` (`kpi_name`);--> statement-breakpoint
CREATE INDEX `idx_ndl_channel` ON `notification_delivery_logs` (`ndl_channel`);--> statement-breakpoint
CREATE INDEX `idx_ndl_status` ON `notification_delivery_logs` (`ndl_status`);--> statement-breakpoint
CREATE INDEX `idx_ndl_ts` ON `notification_delivery_logs` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_pp_probe` ON `probe_policies` (`probe_id`);--> statement-breakpoint
CREATE INDEX `idx_probes_status` ON `probes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_probes_site` ON `probes` (`site`);--> statement-breakpoint
CREATE INDEX `idx_pm_project` ON `project_memberships` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_pm_user` ON `project_memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_status` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_projects_domain` ON `projects` (`domain`);--> statement-breakpoint
CREATE INDEX `idx_rp_role` ON `role_permissions` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_rp_perm` ON `role_permissions` (`permission_id`);--> statement-breakpoint
CREATE INDEX `idx_rj_execution` ON `runner_jobs` (`execution_id`);--> statement-breakpoint
CREATE INDEX `idx_rj_status` ON `runner_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_td_project` ON `test_devices` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_profiles_project` ON `test_profiles` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_profiles_test_type` ON `test_profiles` (`test_type`);--> statement-breakpoint
CREATE INDEX `idx_scenarios_project` ON `test_scenarios` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_scenarios_profile` ON `test_scenarios` (`profile_id`);--> statement-breakpoint
CREATE INDEX `idx_scenarios_status` ON `test_scenarios` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ur_user` ON `user_roles` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ur_role` ON `user_roles` (`role_id`);