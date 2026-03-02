# Phase A Inventory

## 20 Missing Drizzle Tables
analyses, capture_artifacts, capture_jobs, capture_sessions, capture_sources, drive_imports, drive_probe_configs, notification_delivery_logs, notification_rules, notification_settings, notification_templates, outbound_webhooks, permissions, probe_policies, role_permissions, roles, runner_jobs, test_devices, user_roles, webhook_deliveries

## Raw SQL Usage (30 db.execute calls)
- webhooks.ts: 15 calls (CRUD outbound_webhooks + webhook_deliveries) → MIGRATE to Drizzle
- analytics.ts: 12 calls (complex aggregations, window functions, JOINs) → KEEP raw (justified)
- admin.ts: 1 call (project_memberships count subquery) → MIGRATE to Drizzle
- successRateAlertService.ts: 1 call (success rate calculation) → KEEP raw (window function)
- observability.ts: 1 call (SELECT 1 health check) → KEEP raw (trivial)

## Drizzle sql`` usage (acceptable, typed)
- collector.ts: IN clauses, date comparisons → OK (Drizzle-typed)
- scenarioTemplates.ts: LIKE, JSON_CONTAINS → OK (Drizzle-typed)
- jobQueue.ts: JSON_EXTRACT, increment → OK (Drizzle-typed)
- ui.ts: dummy table → OK

## Migration Plan
- MIGRATE: webhooks.ts (15 → 0 raw), admin.ts (1 → 0 raw)
- KEEP: analytics.ts (complex aggregations), successRateAlertService.ts (window func), observability.ts (health check)
- Total: 30 raw → ~14 remaining (justified) = 53% reduction
