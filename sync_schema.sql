-- ═══════════════════════════════════════════════════════════════════════════════
-- AgilesTest — Synchronisation du schéma étendu
-- Création des tables manquantes référencées par le backend
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── AI Provider Configs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_provider_configs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `org_id` varchar(64) NOT NULL,
  `provider` varchar(64) NOT NULL,
  `display_name` varchar(255),
  `api_base_url` varchar(512),
  `secret_ciphertext` text,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ai_provider_configs_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── AI Engines ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_engines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `org_id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `provider` varchar(64) NOT NULL,
  `model` varchar(128) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `config` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ai_engines_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── AI Routing Rules ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_routing_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `org_id` varchar(64) NOT NULL,
  `use_case` varchar(128) NOT NULL,
  `engine_uid` varchar(36),
  `priority` int NOT NULL DEFAULT 0,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `config` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ai_routing_rules_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Alerts State ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `alerts_state` (
  `id` int NOT NULL AUTO_INCREMENT,
  `alert_type` varchar(64) NOT NULL,
  `key` varchar(255) NOT NULL,
  `uid` varchar(36),
  `state` json,
  `last_triggered_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── App Settings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(255) NOT NULL,
  `setting_value` text,
  `updated_by` varchar(64),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `app_settings_key_unique` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Capture Policies ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `capture_policies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `project_id` int,
  `name` varchar(255) NOT NULL,
  `scope` varchar(64),
  `scope_id` varchar(128),
  `config` json,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `capture_policies_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Collector Sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `collector_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `capture_id` int NOT NULL,
  `probe_id` int NOT NULL,
  `status` enum('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
  `started_at` timestamp,
  `finished_at` timestamp,
  `last_heartbeat_at` timestamp,
  `meta_json` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `collector_sessions_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Collector Events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `collector_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `session_id` int NOT NULL,
  `level` varchar(32) NOT NULL DEFAULT 'INFO',
  `event_type` varchar(64),
  `message` text,
  `data` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `collector_events_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Drive Campaigns ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `drive_campaigns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `project_id` int,
  `project_uid` varchar(36),
  `org_id` varchar(64),
  `name` varchar(255) NOT NULL,
  `description` text,
  `status` enum('DRAFT','ACTIVE','COMPLETED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `target_env` enum('DEV','PREPROD','PILOT_ORANGE','PROD') DEFAULT 'DEV',
  `config` json,
  `created_by` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `drive_campaigns_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Drive Runs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `drive_runs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `org_id` varchar(64) NOT NULL,
  `project_uid` varchar(36),
  `campaign_uid` varchar(36),
  `name` varchar(255),
  `status` enum('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `device_info` json,
  `started_at` timestamp,
  `finished_at` timestamp,
  `duration_ms` int,
  `created_by` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `drive_runs_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Drive Location Samples ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `drive_location_samples` (
  `id` int NOT NULL AUTO_INCREMENT,
  `run_uid` varchar(36) NOT NULL,
  `org_id` varchar(64) NOT NULL,
  `ts` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lat` double,
  `lon` double,
  `speed_mps` double,
  `altitude_m` double,
  `accuracy_m` double,
  `bearing` double,
  `network_type` varchar(32),
  `signal_dbm` int,
  `cell_id` varchar(64),
  `extra` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Drive Run Events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `drive_run_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `run_uid` varchar(36) NOT NULL,
  `org_id` varchar(64) NOT NULL,
  `ts` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `type` varchar(64) NOT NULL,
  `severity` enum('INFO','WARNING','ERROR','CRITICAL') NOT NULL DEFAULT 'INFO',
  `message` text,
  `data` json,
  `lat` double,
  `lon` double,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Drive Run Summaries ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `drive_run_summaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `drive_job_id` varchar(36) NOT NULL,
  `campaign_id` varchar(36),
  `summary` json,
  `kpis` json,
  `ai_analysis` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── KPI Samples ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `kpi_samples` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36),
  `drive_job_id` varchar(36) NOT NULL,
  `campaign_id` varchar(36),
  `kpi_name` varchar(128) NOT NULL,
  `value` double,
  `unit` varchar(32),
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `metadata` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Password Reset Tokens ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `email` varchar(320),
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `password_reset_tokens_token_unique` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Outbound Webhooks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `outbound_webhooks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `project_id` int,
  `name` varchar(255),
  `url` varchar(1024) NOT NULL,
  `secret` varchar(255),
  `events` json,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `outbound_webhooks_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Webhook Deliveries ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `webhook_deliveries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `webhook_id` int NOT NULL,
  `event_type` varchar(128),
  `payload` json,
  `status` enum('PENDING','SUCCESS','FAILED') NOT NULL DEFAULT 'PENDING',
  `http_status` int,
  `response_body` text,
  `attempt` int NOT NULL DEFAULT 1,
  `max_attempts` int NOT NULL DEFAULT 3,
  `delivered_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `webhook_deliveries_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Roles (RBAC) ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `name` varchar(128) NOT NULL,
  `description` text,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Permissions (RBAC) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `name` varchar(128) NOT NULL,
  `resource` varchar(128),
  `action` varchar(64),
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Role Permissions (RBAC join) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` varchar(36) NOT NULL,
  `permission_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── User Roles (RBAC join) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `role_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Notification Rules ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notification_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rule_id` varchar(100) NOT NULL,
  `name` varchar(255),
  `event_type` varchar(128),
  `channel` enum('SMS','EMAIL','WEBHOOK') NOT NULL DEFAULT 'EMAIL',
  `template_id` varchar(100),
  `config` json,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_rules_rule_id_unique` (`rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Notification Templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notification_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_id` varchar(100) NOT NULL,
  `name` varchar(255),
  `subject` varchar(512),
  `body` text,
  `channel` enum('SMS','EMAIL','WEBHOOK') NOT NULL DEFAULT 'EMAIL',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_templates_template_id_unique` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Notification Delivery Logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notification_delivery_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `rule_id` varchar(100),
  `channel` enum('SMS','EMAIL','WEBHOOK') NOT NULL DEFAULT 'EMAIL',
  `recipient` varchar(320),
  `status` enum('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
  `error` text,
  `sent_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_delivery_logs_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Notification Settings ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notification_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `channel` enum('SMS','EMAIL') NOT NULL,
  `provider` varchar(50),
  `config` json,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_settings_channel_unique` (`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Capture Jobs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `capture_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `capture_id` int NOT NULL,
  `status` enum('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
  `config` json,
  `started_at` timestamp,
  `finished_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `capture_jobs_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Capture Artifacts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `capture_artifacts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `capture_id` int NOT NULL,
  `filename` varchar(512),
  `mime_type` varchar(128),
  `size_bytes` int DEFAULT 0,
  `storage_path` varchar(1024),
  `storage_url` varchar(1024),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `capture_artifacts_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Drive Routes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `drive_routes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `campaign_uid` varchar(36),
  `name` varchar(255),
  `description` text,
  `waypoints` json,
  `distance_km` double,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `drive_routes_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Drive Jobs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `drive_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `campaign_uid` varchar(36),
  `route_uid` varchar(36),
  `device_uid` varchar(36),
  `status` enum('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `config` json,
  `started_at` timestamp,
  `finished_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `drive_jobs_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Drive Devices ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `drive_devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `device_type` varchar(64),
  `os` varchar(64),
  `os_version` varchar(32),
  `imei` varchar(32),
  `status` enum('ONLINE','OFFLINE','MAINTENANCE') NOT NULL DEFAULT 'OFFLINE',
  `last_seen_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `drive_devices_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Runner Jobs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `runner_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `execution_id` int,
  `status` enum('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `runner_id` varchar(128),
  `config` json,
  `result` json,
  `error` text,
  `started_at` timestamp,
  `finished_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `runner_jobs_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Scenario Templates ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `scenario_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `category` varchar(128),
  `framework` varchar(64),
  `steps` json,
  `tags` json,
  `is_public` tinyint(1) NOT NULL DEFAULT 0,
  `author_open_id` varchar(64),
  `download_count` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `scenario_templates_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Template Comments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `template_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `template_uid` varchar(36) NOT NULL,
  `user_open_id` varchar(64) NOT NULL,
  `content` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `template_comments_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Template Ratings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `template_ratings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_uid` varchar(36) NOT NULL,
  `user_open_id` varchar(64) NOT NULL,
  `rating` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `template_ratings_unique` (`template_uid`, `user_open_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Analyses (distinct from ai_analyses) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS `analyses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) NOT NULL,
  `incident_id` int,
  `status` enum('PENDING','RUNNING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
  `analysis_type` varchar(64),
  `result` json,
  `error` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `analyses_uid_unique` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Ajout des colonnes uid manquantes sur les tables existantes ────────────
-- (colonnes ajoutées précédemment mais vérification de sécurité)
ALTER TABLE `artifacts` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
ALTER TABLE `audit_logs` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
ALTER TABLE `datasets` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
ALTER TABLE `executions` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
ALTER TABLE `generated_scripts` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
ALTER TABLE `incidents` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
ALTER TABLE `probes` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
ALTER TABLE `project_memberships` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
ALTER TABLE `projects` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
ALTER TABLE `test_profiles` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
ALTER TABLE `test_scenarios` ADD COLUMN IF NOT EXISTS `uid` varchar(36);
