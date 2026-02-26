CREATE INDEX `idx_cj_created` ON `capture_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_csess_created` ON `capture_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_csess_status` ON `capture_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_datasets_created` ON `datasets` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_dc_created` ON `drive_campaigns` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_dj_created` ON `drive_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_exec_created` ON `executions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_probes_created` ON `probes` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_profiles_created` ON `test_profiles` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_scenarios_created` ON `test_scenarios` (`created_at`);