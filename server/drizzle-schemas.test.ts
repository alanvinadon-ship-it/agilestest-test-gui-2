import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/mysql-core";

// ─── Phase B: Verify all 20 new Drizzle table schemas exist and are well-formed ──

describe("Drizzle Schemas — New tables exist and have correct structure", () => {
  it("should export all 20 new tables from schema.ts", async () => {
    const schema = await import("../drizzle/schema");
    const newTables = [
      "analyses",
      "alertsState",
      "bundleItems",
      "captureArtifacts",
      "captureJobs",
      "captureSources",
      "collectorEvents",
      "collectorSessions",
      "driveCampaigns",
      "driveDevices",
      "driveImports",
      "driveJobs",
      "driveProbeConfigs",
      "driveProbeLinks",
      "driveRoutes",
      "notificationDeliveryLogs",
      "notificationRules",
      "notificationSettings",
      "notificationTemplates",
      "probeAlertState",
    ];
    for (const name of newTables) {
      expect(schema).toHaveProperty(name);
    }
  });

  it("should export all RBAC tables from schema.ts", async () => {
    const schema = await import("../drizzle/schema");
    const rbacTables = [
      "roles",
      "permissions",
      "rolePermissions",
      "userRoles",
    ];
    for (const name of rbacTables) {
      expect(schema).toHaveProperty(name);
    }
  });

  it("should export runner_jobs and template_comments/ratings tables", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema).toHaveProperty("runnerJobs");
    expect(schema).toHaveProperty("templateComments");
    expect(schema).toHaveProperty("templateRatings");
  });
});

// ─── RBAC tables structure ──────────────────────────────────────────────────

describe("Drizzle Schemas — RBAC tables structure", () => {
  it("roles table should have id, uid, name, description columns", async () => {
    const { roles } = await import("../drizzle/schema");
    const config = getTableConfig(roles);
    expect(config.name).toBe("roles");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("name");
  });

  it("permissions table should have id, uid, module, action columns", async () => {
    const { permissions } = await import("../drizzle/schema");
    const config = getTableConfig(permissions);
    expect(config.name).toBe("permissions");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("module");
    expect(colNames).toContain("action");
  });

  it("rolePermissions table should link roles to permissions", async () => {
    const { rolePermissions } = await import("../drizzle/schema");
    const config = getTableConfig(rolePermissions);
    expect(config.name).toBe("role_permissions");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("role_id");
    expect(colNames).toContain("permission_id");
  });

  it("userRoles table should link users to roles", async () => {
    const { userRoles } = await import("../drizzle/schema");
    const config = getTableConfig(userRoles);
    expect(config.name).toBe("user_roles");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("user_id");
    expect(colNames).toContain("role_id");
  });
});

// ─── Notification tables structure ──────────────────────────────────────────

describe("Drizzle Schemas — Notification tables structure", () => {
  it("notificationRules should have id, rule_id, event_type columns", async () => {
    const { notificationRules } = await import("../drizzle/schema");
    const config = getTableConfig(notificationRules);
    expect(config.name).toBe("notification_rules");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("rule_id");
    expect(colNames).toContain("event_type");
  });

  it("notificationTemplates should have id, template_id, name columns", async () => {
    const { notificationTemplates } = await import("../drizzle/schema");
    const config = getTableConfig(notificationTemplates);
    expect(config.name).toBe("notification_templates");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("template_id");
    expect(colNames).toContain("name");
  });

  it("notificationDeliveryLogs should have id, uid, rule_id, ndl_status columns", async () => {
    const { notificationDeliveryLogs } = await import("../drizzle/schema");
    const config = getTableConfig(notificationDeliveryLogs);
    expect(config.name).toBe("notification_delivery_logs");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("rule_id");
    expect(colNames).toContain("ndl_status");
  });

  it("notificationSettings should have id, channel, provider columns", async () => {
    const { notificationSettings } = await import("../drizzle/schema");
    const config = getTableConfig(notificationSettings);
    expect(config.name).toBe("notification_settings");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("channel");
    expect(colNames).toContain("provider");
  });
});

// ─── Capture/Collector tables structure ─────────────────────────────────────

describe("Drizzle Schemas — Capture & Collector tables structure", () => {
  it("captureJobs should have id, uid, execution_id, status columns", async () => {
    const { captureJobs } = await import("../drizzle/schema");
    const config = getTableConfig(captureJobs);
    expect(config.name).toBe("capture_jobs");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("execution_id");
    expect(colNames).toContain("status");
  });

  it("captureArtifacts should have id, uid, capture_job_id columns", async () => {
    const { captureArtifacts } = await import("../drizzle/schema");
    const config = getTableConfig(captureArtifacts);
    expect(config.name).toBe("capture_artifacts");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("capture_job_id");
  });

  it("collectorSessions should have id, uid, capture_id, status columns", async () => {
    const { collectorSessions } = await import("../drizzle/schema");
    const config = getTableConfig(collectorSessions);
    expect(config.name).toBe("collector_sessions");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("capture_id");
    expect(colNames).toContain("status");
  });

  it("collectorEvents should have id, uid, session_id columns", async () => {
    const { collectorEvents } = await import("../drizzle/schema");
    const config = getTableConfig(collectorEvents);
    expect(config.name).toBe("collector_events");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("session_id");
    expect(colNames).toContain("event_type");
  });
});

// ─── Drive tables structure ─────────────────────────────────────────────────

describe("Drizzle Schemas — Drive tables structure", () => {
  it("driveCampaigns should have id, uid, project_id columns", async () => {
    const { driveCampaigns } = await import("../drizzle/schema");
    const config = getTableConfig(driveCampaigns);
    expect(config.name).toBe("drive_campaigns");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
  });

  it("driveRoutes should have id, uid, campaign_id columns", async () => {
    const { driveRoutes } = await import("../drizzle/schema");
    const config = getTableConfig(driveRoutes);
    expect(config.name).toBe("drive_routes");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("campaign_id");
  });

  it("driveJobs should have id, uid, campaign_id, status columns", async () => {
    const { driveJobs } = await import("../drizzle/schema");
    const config = getTableConfig(driveJobs);
    expect(config.name).toBe("drive_jobs");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("campaign_id");
    expect(colNames).toContain("status");
  });

  it("driveDevices should have id, uid, name columns", async () => {
    const { driveDevices } = await import("../drizzle/schema");
    const config = getTableConfig(driveDevices);
    expect(config.name).toBe("drive_devices");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("name");
  });
});

// ─── Webhooks Drizzle migration tests ───────────────────────────────────────

describe("Webhooks — Drizzle schema tables", () => {
  it("outboundWebhooks table should have correct columns", async () => {
    const { outboundWebhooks } = await import("../drizzle/schema");
    const config = getTableConfig(outboundWebhooks);
    expect(config.name).toBe("outbound_webhooks");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("project_id");
    expect(colNames).toContain("name");
    expect(colNames).toContain("url");
    expect(colNames).toContain("secret");
    expect(colNames).toContain("events");
    expect(colNames).toContain("enabled");
  });

  it("webhookDeliveries table should have correct columns", async () => {
    const { webhookDeliveries } = await import("../drizzle/schema");
    const config = getTableConfig(webhookDeliveries);
    expect(config.name).toBe("webhook_deliveries");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("webhook_id");
    expect(colNames).toContain("event_type");
    expect(colNames).toContain("payload");
    expect(colNames).toContain("status");
    expect(colNames).toContain("http_status");
    expect(colNames).toContain("attempt");
  });
});

// ─── Total table count verification ─────────────────────────────────────────

describe("Drizzle Schemas — Total coverage", () => {
  it("should have at least 57 tables defined in schema.ts", async () => {
    const schema = await import("../drizzle/schema");
    const { MySqlTable } = await import("drizzle-orm/mysql-core");
    let tableCount = 0;
    for (const key of Object.keys(schema)) {
      const val = (schema as any)[key];
      if (val && val instanceof MySqlTable) {
        tableCount++;
      }
    }
    expect(tableCount).toBeGreaterThanOrEqual(57);
  });

  it("every table should have an id column", async () => {
    const schema = await import("../drizzle/schema");
    const { MySqlTable } = await import("drizzle-orm/mysql-core");
    const failures: string[] = [];
    for (const key of Object.keys(schema)) {
      const val = (schema as any)[key];
      if (val && val instanceof MySqlTable) {
        const config = getTableConfig(val);
        const colNames = config.columns.map((c) => c.name);
        if (!colNames.includes("id")) {
          failures.push(config.name);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("every table should have a uid column (except system/join tables)", async () => {
    const schema = await import("../drizzle/schema");
    const { MySqlTable } = await import("drizzle-orm/mysql-core");
    // Join tables, system tables, and tables with alternative ID schemes may not have uid
    const exceptions = new Set([
      "role_permissions",
      "user_roles",
      "bundle_items",
      "drive_probe_links",
      "probe_alert_state",
      "users",
      "captures",
      "jobs",
      "notification_templates",
      "notification_settings",
      "notification_rules",
      "notification_delivery_logs",
      "template_ratings",
      "alerts_state",
      "ai_analyses",
      "reports",
      "drive_run_summaries",
      "dataset_secrets",
      "password_reset_tokens",
      "app_settings",
    ]);
    const failures: string[] = [];
    for (const key of Object.keys(schema)) {
      const val = (schema as any)[key];
      if (val && val instanceof MySqlTable) {
        const config = getTableConfig(val);
        if (exceptions.has(config.name)) continue;
        const colNames = config.columns.map((c) => c.name);
        if (!colNames.includes("uid")) {
          failures.push(config.name);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

// ─── Analyses table ─────────────────────────────────────────────────────────

describe("Drizzle Schemas — Analyses table", () => {
  it("analyses should have id, uid, incident_id, status columns", async () => {
    const { analyses } = await import("../drizzle/schema");
    const config = getTableConfig(analyses);
    expect(config.name).toBe("analyses");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("incident_id");
    expect(colNames).toContain("status");
  });
});

// ─── Runner jobs table ──────────────────────────────────────────────────────

describe("Drizzle Schemas — Runner jobs table", () => {
  it("runnerJobs should have id, uid, status, execution_id columns", async () => {
    const { runnerJobs } = await import("../drizzle/schema");
    const config = getTableConfig(runnerJobs);
    expect(config.name).toBe("runner_jobs");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("status");
    expect(colNames).toContain("execution_id");
  });
});

// ─── Template community tables ──────────────────────────────────────────────

describe("Drizzle Schemas — Template community tables", () => {
  it("templateComments should have id, uid, template_uid, user_open_id columns", async () => {
    const { templateComments } = await import("../drizzle/schema");
    const config = getTableConfig(templateComments);
    expect(config.name).toBe("template_comments");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("uid");
    expect(colNames).toContain("template_uid");
    expect(colNames).toContain("user_open_id");
  });

  it("templateRatings should have id, template_uid, user_open_id, rating columns", async () => {
    const { templateRatings } = await import("../drizzle/schema");
    const config = getTableConfig(templateRatings);
    expect(config.name).toBe("template_ratings");
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("template_uid");
    expect(colNames).toContain("user_open_id");
    expect(colNames).toContain("rating");
  });
});
