import {
  int, mysqlEnum, mysqlTable, text, timestamp, varchar,
  boolean, json, bigint, double, decimal,
} from "drizzle-orm/mysql-core";

// ─── Users ──────────────────────────────────────────────────────────────────
// DB columns: id, openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn, full_name, status, password_hash
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  fullName: varchar("full_name", { length: 255 }),
  status: mysqlEnum("status", ["ACTIVE", "DISABLED", "INVITED"]).default("ACTIVE").notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 512 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Projects ───────────────────────────────────────────────────────────────
// DB columns: id, uid, name, description, domain, status, created_by, created_at, updated_at
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  domain: varchar("domain", { length: 50 }).default("WEB").notNull(),
  status: mysqlEnum("status", ["ACTIVE", "ARCHIVED", "DRAFT"]).default("ACTIVE").notNull(),
  createdBy: varchar("created_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Project Memberships ────────────────────────────────────────────────────
// DB columns: id, uid, project_id, project_name, user_id, user_email, user_name, project_role, added_by, created_at, updated_at
export const projectMemberships = mysqlTable("project_memberships", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  projectName: varchar("project_name", { length: 255 }),
  userId: varchar("user_id", { length: 64 }).notNull(),
  userEmail: varchar("user_email", { length: 320 }),
  userName: varchar("user_name", { length: 255 }),
  role: mysqlEnum("project_role", ["PROJECT_ADMIN", "PROJECT_EDITOR", "PROJECT_VIEWER"]).default("PROJECT_VIEWER").notNull(),
  addedBy: varchar("added_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ProjectMembership = typeof projectMemberships.$inferSelect;

// ─── Invites ────────────────────────────────────────────────────────────────
// DB columns: id, uid, email, invite_role, invite_status, token, invited_by, invited_by_name, expires_at, accepted_at, created_at
export const invites = mysqlTable("invites", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("invite_role", ["ADMIN", "MANAGER", "VIEWER"]).default("VIEWER").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  status: mysqlEnum("invite_status", ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]).default("PENDING").notNull(),
  invitedBy: varchar("invited_by", { length: 64 }),
  invitedByName: varchar("invited_by_name", { length: 255 }),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Invite = typeof invites.$inferSelect;
export type InsertInvite = typeof invites.$inferInsert;

// ─── Audit Logs ─────────────────────────────────────────────────────────────
// DB columns: id, uid, timestamp, actor_id, actor_name, actor_email, action, entity_type, entity_id, target_label, metadata, trace_id
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  userId: varchar("actor_id", { length: 64 }),
  userName: varchar("actor_name", { length: 255 }),
  userEmail: varchar("actor_email", { length: 320 }),
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 36 }),
  targetLabel: varchar("target_label", { length: 500 }),
  details: json("metadata"),
  traceId: varchar("trace_id", { length: 64 }),
  createdAt: timestamp("timestamp").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Test Profiles ──────────────────────────────────────────────────────────
// DB columns: id, uid, project_id, name, description, protocol, test_type, domain, profile_type, target_host, target_port, parameters, config, created_at, updated_at
export const testProfiles = mysqlTable("test_profiles", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  protocol: varchar("protocol", { length: 50 }),
  testType: mysqlEnum("test_type", ["VABF", "VSR", "VABE"]).default("VABF").notNull(),
  domain: varchar("domain", { length: 50 }),
  profileType: varchar("profile_type", { length: 50 }),
  targetHost: varchar("target_host", { length: 255 }),
  targetPort: int("target_port"),
  parameters: json("parameters"),
  config: json("config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TestProfile = typeof testProfiles.$inferSelect;
export type InsertTestProfile = typeof testProfiles.$inferInsert;

// ─── Test Scenarios ─────────────────────────────────────────────────────────
// DB columns: id, uid, scenario_code, project_id, profile_id, name, description, test_type, status, version, steps, required_dataset_types, artifact_policy, kpi_thresholds, created_at, updated_at
export const testScenarios = mysqlTable("test_scenarios", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  scenarioCode: varchar("scenario_code", { length: 100 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  profileId: varchar("profile_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  testType: mysqlEnum("test_type", ["VABF", "VSR", "VABE"]).default("VABF").notNull(),
  status: mysqlEnum("status", ["DRAFT", "FINAL", "DEPRECATED"]).default("DRAFT").notNull(),
  version: int("version"),
  steps: json("steps"),
  requiredDatasetTypes: json("required_dataset_types"),
  artifactPolicy: json("artifact_policy"),
  kpiThresholds: json("kpi_thresholds"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TestScenario = typeof testScenarios.$inferSelect;
export type InsertTestScenario = typeof testScenarios.$inferInsert;

// ─── Datasets ───────────────────────────────────────────────────────────────
// DB columns: id, uid, project_id, name, description, format, row_count, size_bytes, storage_url, dataset_type_id, created_at, updated_at
export const datasets = mysqlTable("datasets", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  format: mysqlEnum("format", ["CSV", "JSON", "YAML"]).default("CSV").notNull(),
  rowCount: int("row_count"),
  sizeBytes: int("size_bytes"),
  storageUrl: varchar("storage_url", { length: 500 }),
  datasetTypeId: varchar("dataset_type_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = typeof datasets.$inferInsert;

// ─── Executions ─────────────────────────────────────────────────────────────
// DB columns: id, uid, project_id, profile_id, scenario_id, status, runner_type, script_id, script_version, dataset_bundle_id, target_env, runner_id, ai_repair_from_execution_id, started_at, finished_at, duration_ms, artifacts_count, incidents_count, created_at, updated_at
export const executions = mysqlTable("executions", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  profileId: varchar("profile_id", { length: 36 }).notNull(),
  scenarioId: varchar("scenario_id", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["PENDING", "RUNNING", "PASSED", "FAILED", "ERROR", "CANCELLED"]).default("PENDING").notNull(),
  runnerType: varchar("runner_type", { length: 50 }),
  scriptId: varchar("script_id", { length: 36 }),
  scriptVersion: int("script_version"),
  datasetBundleId: varchar("dataset_bundle_id", { length: 36 }),
  targetEnv: mysqlEnum("target_env", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).default("DEV"),
  runnerId: varchar("runner_id", { length: 64 }),
  aiRepairFromExecutionId: varchar("ai_repair_from_execution_id", { length: 36 }),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  durationMs: int("duration_ms"),
  artifactsCount: int("artifacts_count").default(0),
  incidentsCount: int("incidents_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Execution = typeof executions.$inferSelect;
export type InsertExecution = typeof executions.$inferInsert;

// ─── Artifacts ──────────────────────────────────────────────────────────────
// DB columns: id, uid, execution_id, type, filename, name, mime_type, content_type, size_bytes, storage_path, storage_url, s3_uri, checksum, capture_job_id, download_url, created_at, uploaded_at
export const artifacts = mysqlTable("artifacts", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  executionId: varchar("execution_id", { length: 36 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  filename: varchar("filename", { length: 500 }).notNull(),
  name: varchar("name", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  contentType: varchar("content_type", { length: 100 }),
  sizeBytes: int("size_bytes"),
  storagePath: varchar("storage_path", { length: 500 }),
  storageUrl: varchar("storage_url", { length: 500 }),
  s3Uri: varchar("s3_uri", { length: 500 }),
  checksum: varchar("checksum", { length: 128 }),
  captureJobId: varchar("capture_job_id", { length: 36 }),
  downloadUrl: varchar("download_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  uploadedAt: timestamp("uploaded_at"),
});

export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = typeof artifacts.$inferInsert;

// ─── Incidents ──────────────────────────────────────────────────────────────
// DB columns: id, uid, execution_id, project_id, title, description, severity, step_name, expected_result, actual_result, detected_at
export const incidents = mysqlTable("incidents", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  executionId: varchar("execution_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  severity: mysqlEnum("severity", ["CRITICAL", "MAJOR", "MINOR", "INFO"]).default("INFO").notNull(),
  stepName: varchar("step_name", { length: 255 }),
  expectedResult: text("expected_result"),
  actualResult: text("actual_result"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
});

export type IncidentRow = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;

// ─── Captures ───────────────────────────────────────────────────────────────
export const captures = mysqlTable("captures", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  executionId: int("executionId"),
  name: varchar("name", { length: 255 }).notNull(),
  captureType: mysqlEnum("captureType", ["LOGS", "PCAP"]).default("PCAP").notNull(),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).default("QUEUED").notNull(),
  targetType: mysqlEnum("targetType", ["K8S", "SSH", "PROBE"]).default("SSH").notNull(),
  config: json("config"),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Capture = typeof captures.$inferSelect;
export type InsertCapture = typeof captures.$inferInsert;

// ─── Probes ─────────────────────────────────────────────────────────────────
// DB columns: id, uid, site, zone, type, capabilities, status, auth_token_hash, last_seen_at, metadata,
// version, uptime_seconds, cpu_percent, disk_free_mb, interfaces, active_sessions, total_captures,
// last_error, health_status, heartbeat_interval_sec, allowlist_cidrs, tls_enabled, created_at, updated_at, probeToken
export const probes = mysqlTable("probes", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  site: varchar("site", { length: 255 }).notNull(),
  zone: varchar("zone", { length: 255 }).notNull(),
  probeType: mysqlEnum("type", ["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]).notNull(),
  capabilities: json("capabilities"),
  status: mysqlEnum("status", ["ONLINE", "OFFLINE", "DEGRADED"]).default("OFFLINE").notNull(),
  authTokenHash: varchar("auth_token_hash", { length: 255 }),
  lastSeenAt: timestamp("last_seen_at"),
  metadata: json("metadata"),
  version: varchar("version", { length: 50 }),
  uptimeSeconds: int("uptime_seconds"),
  cpuPercent: double("cpu_percent"),
  diskFreeMb: int("disk_free_mb"),
  interfaces: json("interfaces"),
  activeSessions: int("active_sessions").default(0),
  totalCaptures: int("total_captures").default(0),
  lastError: text("last_error"),
  healthStatus: mysqlEnum("health_status", ["healthy", "degraded", "unhealthy"]),
  heartbeatIntervalSec: int("heartbeat_interval_sec").default(30),
  allowlistCidrs: json("allowlist_cidrs"),
  tlsEnabled: boolean("tls_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  probeToken: varchar("probeToken", { length: 128 }),
});

export type ProbeRow = typeof probes.$inferSelect;
export type InsertProbe = typeof probes.$inferInsert;

// ─── AI Generated Scripts ───────────────────────────────────────────────────
// DB columns: id, uid, scenario_id, project_id, version, language, framework, code, script_status, generated_by, created_at, updated_at
export const generatedScripts = mysqlTable("generated_scripts", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  scenarioId: varchar("scenario_id", { length: 36 }).notNull(),
  framework: varchar("framework", { length: 50 }).default("playwright"),
  language: varchar("language", { length: 50 }).default("typescript"),
  code: text("code"),
  version: int("version").default(1),
  status: mysqlEnum("script_status", ["DRAFT", "VALIDATED", "DEPRECATED"]).default("DRAFT").notNull(),
  createdBy: varchar("generated_by", { length: 50 }).default("AI"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type GeneratedScript = typeof generatedScripts.$inferSelect;
export type InsertGeneratedScript = typeof generatedScripts.$inferInsert;

// ─── Jobs Queue (MySQL-based async jobs) ────────────────────────────────────
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "DONE", "FAILED", "CANCELLED"]).default("QUEUED").notNull(),
  payload: json("payload"),
  result: json("result"),
  error: text("error"),
  attempts: int("attempts").default(0).notNull(),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  runAfter: timestamp("runAfter").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

// ─── AI Analyses ────────────────────────────────────────────────────────────
export const aiAnalyses = mysqlTable("ai_analyses", {
  id: int("id").autoincrement().primaryKey(),
  executionId: int("executionId").notNull(),
  jobId: int("jobId"),
  summary: text("summary"),
  recommendations: json("recommendations"),
  kpis: json("kpis"),
  status: mysqlEnum("status", ["PENDING", "DONE", "FAILED"]).default("PENDING").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiAnalysis = typeof aiAnalyses.$inferSelect;
export type InsertAiAnalysis = typeof aiAnalyses.$inferInsert;

// ─── Reports (PDF exports) ──────────────────────────────────────────────────
// Note: reports table still uses camelCase column names in DB
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  executionId: int("executionId").notNull(),
  projectId: int("projectId").notNull(),
  status: mysqlEnum("status", ["PENDING", "GENERATING", "DONE", "FAILED"]).default("PENDING").notNull(),
  storagePath: varchar("storagePath", { length: 512 }),
  downloadUrl: text("downloadUrl"),
  filename: varchar("filename", { length: 255 }),
  sizeBytes: int("sizeBytes"),
  error: text("error"),
  requestedBy: int("requestedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// ─── Probe Alert State ─────────────────────────────────────────────────────
export const probeAlertState = mysqlTable("probe_alert_state", {
  id: int("id").autoincrement().primaryKey(),
  probeId: int("probeId").notNull(),
  orgId: int("orgId").notNull(),
  healthState: mysqlEnum("healthState", ["GREEN", "ORANGE", "RED"]).default("GREEN").notNull(),
  redSinceAt: timestamp("redSinceAt"),
  lastNotifiedAt: timestamp("lastNotifiedAt"),
  alertCount: int("alertCount").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProbeAlertState = typeof probeAlertState.$inferSelect;
export type InsertProbeAlertState = typeof probeAlertState.$inferInsert;

// ─── Unified Alerts State (success rate, probes RED, etc.) ──────────────────
export const alertsState = mysqlTable("alerts_state", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 100 }).notNull(),
  alertType: mysqlEnum("alert_type", ["SUCCESS_RATE_LOW", "PROBE_RED"]).notNull(),
  key: varchar("alert_key", { length: 255 }).notNull(), // "GLOBAL" or probeUid
  stateJson: json("state_json"), // { consecutiveBreaches, lastSuccessRate, threshold, ... }
  lastNotifiedAt: timestamp("last_notified_at"),
  resolvedAt: timestamp("resolved_at"),
  alertCount: int("alert_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AlertsState = typeof alertsState.$inferSelect;
export type InsertAlertsState = typeof alertsState.$inferInsert;

// ─── Dataset Types (gabarits de datasets) ──────────────────────────────────
// DB columns: id, uid, dataset_type_id, domain, test_type, name, description, schema_fields, example_placeholders, tags, created_at, updated_at
export const datasetTypes = mysqlTable("dataset_types", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  datasetTypeId: varchar("dataset_type_id", { length: 100 }).notNull().unique(),
  domain: varchar("domain", { length: 50 }).notNull(),
  testType: varchar("test_type", { length: 10 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  schemaFields: json("schema_fields"),
  examplePlaceholders: json("example_placeholders"),
  tags: json("tags"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DatasetTypeRow = typeof datasetTypes.$inferSelect;
export type InsertDatasetType = typeof datasetTypes.$inferInsert;

// ─── Dataset Instances (instances concrètes de datasets) ───────────────────
// DB columns: id, uid, project_id, dataset_type_id, env, version, status, values_json, notes, created_by, created_at, updated_at
export const datasetInstances = mysqlTable("dataset_instances", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  datasetTypeId: varchar("dataset_type_id", { length: 100 }).notNull(),
  env: mysqlEnum("env", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).default("DEV").notNull(),
  version: int("version").default(1),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "DEPRECATED"]).default("DRAFT").notNull(),
  valuesJson: json("values_json"),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DatasetInstanceRow = typeof datasetInstances.$inferSelect;
export type InsertDatasetInstance = typeof datasetInstances.$inferInsert;

// ─── Dataset Bundles (regroupement de datasets par environnement) ──────────
// DB columns: id, uid, project_id, name, env, version, status, tags, created_by, created_at, updated_at
export const datasetBundles = mysqlTable("dataset_bundles", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  env: mysqlEnum("env", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).default("PREPROD").notNull(),
  version: int("version").default(1),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "DEPRECATED"]).default("DRAFT").notNull(),
  tags: json("tags"),
  createdBy: varchar("created_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DatasetBundleRow = typeof datasetBundles.$inferSelect;
export type InsertDatasetBundle = typeof datasetBundles.$inferInsert;

// ─── Bundle Items (liaison bundle ↔ dataset instance) ─────────────────────
// DB columns: id, bundle_id, dataset_id
export const bundleItems = mysqlTable("bundle_items", {
  id: int("id").autoincrement().primaryKey(),
  bundleId: varchar("bundle_id", { length: 36 }).notNull(),
  datasetId: varchar("dataset_id", { length: 36 }).notNull(),
});

export type BundleItemRow = typeof bundleItems.$inferSelect;
export type InsertBundleItem = typeof bundleItems.$inferInsert;

// ─── Drive Campaigns (campagnes de test terrain) ────────────────────────────
// DB columns: id, uid, project_id, name, description, target_env, network_type, area, start_date, end_date, status, created_by, created_at, updated_at
export const driveCampaigns = mysqlTable("drive_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetEnv: mysqlEnum("target_env", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]),
  networkType: varchar("network_type", { length: 50 }),
  area: varchar("area", { length: 255 }),
  startDate: varchar("start_date", { length: 30 }),
  endDate: varchar("end_date", { length: 30 }),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).default("DRAFT").notNull(),
  createdBy: varchar("created_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DriveCampaignRow = typeof driveCampaigns.$inferSelect;
export type InsertDriveCampaign = typeof driveCampaigns.$inferInsert;

// ─── Drive Routes (parcours terrain) ──────────────────────────────────────
// DB columns: id, uid, campaign_id, name, geojson_json, checkpoints_json, expected_duration_min, distance_km, created_at, updated_at
export const driveRoutes = mysqlTable("drive_routes", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  routeGeojson: json("route_geojson"),
  checkpointsGeojson: json("checkpoints_geojson"),
  expectedDurationMin: int("expected_duration_min").default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DriveRouteRow = typeof driveRoutes.$inferSelect;
export type InsertDriveRoute = typeof driveRoutes.$inferInsert;

// ─── Drive Devices (équipements de test terrain) ──────────────────────────
// DB columns: id, uid, campaign_id, name, device_type, model, os_version, imei, phone_number, diag_capable, tools_enabled, notes, meta_json, created_at, updated_at
export const driveDevices = mysqlTable("drive_devices", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }),
  deviceType: mysqlEnum("device_type", ["ANDROID", "MODEM", "CPE", "LAPTOP"]).default("ANDROID").notNull(),
  model: varchar("model", { length: 255 }),
  osVersion: varchar("os_version", { length: 100 }),
  imei: varchar("imei", { length: 50 }),
  phoneNumber: varchar("phone_number", { length: 50 }),
  diagCapable: boolean("diag_capable").default(false),
  toolsEnabled: json("tools_enabled"),
  notes: text("notes"),
  metaJson: json("meta_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DriveDeviceRow = typeof driveDevices.$inferSelect;
export type InsertDriveDevice = typeof driveDevices.$inferInsert;

// ─── Drive Probe Links (liaison sondes ↔ campagnes) ──────────────────────
// DB columns: id, uid, campaign_id, probe_id, role, created_at
export const driveProbeLinks = mysqlTable("drive_probe_links", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  probeId: int("probe_id").notNull(),
  role: mysqlEnum("role", ["COLLECTOR", "MONITOR", "SPAN_TAP"]).default("COLLECTOR").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DriveProbeLinkRow = typeof driveProbeLinks.$inferSelect;
export type InsertDriveProbeLink = typeof driveProbeLinks.$inferInsert;

// ─── Drive Jobs (exécutions terrain) ──────────────────────────────────────
// DB columns: id, uid, campaign_id, route_id, device_id, target_env, runner_id, status, progress_pct, error_message, artifacts_manifest, created_at, started_at, finished_at
export const driveJobs = mysqlTable("drive_jobs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  routeId: varchar("route_id", { length: 36 }).notNull(),
  deviceId: varchar("device_id", { length: 36 }).notNull(),
  targetEnv: mysqlEnum("target_env", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]),
  runnerId: varchar("runner_id", { length: 64 }),
  status: mysqlEnum("status", ["PENDING", "RUNNING", "DONE", "FAILED"]).default("PENDING").notNull(),
  progressPct: int("progress_pct").default(0),
  errorMessage: text("error_message"),
  artifactsManifest: json("artifacts_manifest"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
});

export type DriveJobRow = typeof driveJobs.$inferSelect;
export type InsertDriveJob = typeof driveJobs.$inferInsert;

// ─── Capture Policies ──────────────────────────────────────────────────────
// DB columns: id, uid, project_id, name, capture_mode, trigger_on, auto_capture, duration, max_size, bpf_filter, interface_name, probe_id, enabled, created_at, updated_at
export const capturePolicies = mysqlTable("capture_policies", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  captureMode: mysqlEnum("capture_mode", ["RUNNER", "PROBE"]).notNull(),
  triggerOn: json("trigger_on"),
  autoCapture: boolean("auto_capture"),
  duration: int("duration"),
  maxSize: int("max_size"),
  bpfFilter: varchar("bpf_filter", { length: 500 }),
  interfaceName: varchar("interface_name", { length: 100 }),
  probeId: varchar("probe_id", { length: 36 }),
  enabled: boolean("enabled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CapturePolicyRow = typeof capturePolicies.$inferSelect;
export type InsertCapturePolicyRow = typeof capturePolicies.$inferInsert;

// ─── KPI Samples (Drive Test measurements) ─────────────────────────────────
// DB columns: id, uid, drive_job_id, campaign_id, route_id, timestamp, lat, lon, kpi_name, value, unit, cell_id, technology
export const kpiSamples = mysqlTable("kpi_samples", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  driveJobId: varchar("drive_job_id", { length: 36 }).notNull(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  routeId: varchar("route_id", { length: 36 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  lat: double("lat").notNull(),
  lon: double("lon").notNull(),
  kpiName: varchar("kpi_name", { length: 50 }).notNull(),
  value: double("value").notNull(),
  unit: varchar("unit", { length: 20 }),
  cellId: varchar("cell_id", { length: 50 }),
  technology: varchar("technology", { length: 20 }),
});

export type KpiSampleRow = typeof kpiSamples.$inferSelect;
export type InsertKpiSampleRow = typeof kpiSamples.$inferInsert;

// ─── Drive Run Summaries ────────────────────────────────────────────────────
// DB columns: id, drive_job_id, campaign_id, total_samples, duration_sec, distance_km, kpi_averages, kpi_min, kpi_max, threshold_violations, overall_pass
export const driveRunSummaries = mysqlTable("drive_run_summaries", {
  id: int("id").autoincrement().primaryKey(),
  driveJobId: varchar("drive_job_id", { length: 36 }).notNull().unique(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  totalSamples: int("total_samples"),
  durationSec: int("duration_sec"),
  distanceKm: double("distance_km"),
  kpiAverages: json("kpi_averages"), // Record<string, number>
  kpiMin: json("kpi_min"),           // Record<string, number>
  kpiMax: json("kpi_max"),           // Record<string, number>
  thresholdViolations: json("threshold_violations"), // ThresholdViolation[]
  overallPass: boolean("overall_pass"),
});

export type DriveRunSummaryRow = typeof driveRunSummaries.$inferSelect;
export type InsertDriveRunSummaryRow = typeof driveRunSummaries.$inferInsert;

// ─── Collector Sessions (active capture sessions) ──────────────────────────
export const collectorSessions = mysqlTable("collector_sessions", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  captureId: int("capture_id").notNull(),
  probeId: int("probe_id").notNull(),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "STOPPED", "FAILED"]).default("QUEUED").notNull(),
  startedAt: timestamp("started_at"),
  stoppedAt: timestamp("stopped_at"),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  metaJson: json("meta_json"),
  createdBy: varchar("created_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CollectorSessionRow = typeof collectorSessions.$inferSelect;
export type InsertCollectorSession = typeof collectorSessions.$inferInsert;

// ─── Collector Events (session lifecycle events) ───────────────────────────
export const collectorEvents = mysqlTable("collector_events", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  sessionId: int("session_id").notNull(),
  level: mysqlEnum("level", ["INFO", "WARN", "ERROR"]).default("INFO").notNull(),
  eventType: mysqlEnum("event_type", ["STARTED", "STOPPED", "HEARTBEAT", "UPLOAD", "ERROR", "CUSTOM"]).default("CUSTOM").notNull(),
  message: text("message"),
  dataJson: json("data_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CollectorEventRow = typeof collectorEvents.$inferSelect;
export type InsertCollectorEvent = typeof collectorEvents.$inferInsert;

// ─── Dataset Secrets (key-level secret flags) ────────────────────────────────
export const datasetSecrets = mysqlTable("dataset_secrets", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: varchar("dataset_id", { length: 36 }).notNull(),
  keyPath: varchar("key_path", { length: 255 }).notNull(),
  isSecret: boolean("is_secret").default(false).notNull(),
});

export type DatasetSecretRow = typeof datasetSecrets.$inferSelect;
export type InsertDatasetSecret = typeof datasetSecrets.$inferInsert;

// ─── Scenario Templates (bibliothèque de scénarios pré-configurés) ──────────
export const scenarioTemplates = mysqlTable("scenario_templates", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 36 }),
  scenarioUid: varchar("scenario_uid", { length: 36 }),
  domain: mysqlEnum("domain", ["IMS", "5GC", "API_REST", "VOLTE", "DRIVE_TEST", "SECURITY", "PERFORMANCE"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  tagsJson: json("tags_json"), // string[] — new structured tags
  templateJson: json("template_json"), // full snapshot JSON (schemaVersion + content)
  visibility: mysqlEnum("visibility", ["PUBLIC", "UNLISTED"]).default("PUBLIC").notNull(),
  status: mysqlEnum("status", ["PUBLISHED", "UNPUBLISHED"]).default("PUBLISHED").notNull(),
  createdBy: varchar("created_by", { length: 128 }),
  version: int("version").default(1).notNull(),
  testType: mysqlEnum("test_type", ["VABF", "VSR", "VABE"]).default("VABF").notNull(),
  difficulty: mysqlEnum("difficulty", ["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("INTERMEDIATE").notNull(),
  tags: json("tags"), // legacy string[] (kept for backward compat)
  steps: json("steps"), // ScenarioStep[]
  requiredDatasetTypes: json("required_dataset_types"), // string[]
  artifactPolicy: json("artifact_policy"),
  kpiThresholds: json("kpi_thresholds"),
  profileTemplate: json("profile_template"), // partial profile config for auto-creation
  isBuiltIn: boolean("is_built_in").default(true).notNull(),
  publishedByOpenId: varchar("published_by_open_id", { length: 128 }),
  publishedByName: varchar("published_by_name", { length: 255 }),
  publishedAt: timestamp("published_at"),
  avgRating: double("avg_rating").default(0),
  ratingCount: int("rating_count").default(0),
  usageCount: int("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ScenarioTemplateRow = typeof scenarioTemplates.$inferSelect;
export type InsertScenarioTemplate = typeof scenarioTemplates.$inferInsert;

// ─── Template Ratings ───────────────────────────────────────────────────────
export const templateRatings = mysqlTable("template_ratings", {
  id: int("id").autoincrement().primaryKey(),
  templateUid: varchar("template_uid", { length: 36 }).notNull(),
  userOpenId: varchar("user_open_id", { length: 128 }).notNull(),
  userName: varchar("user_name", { length: 255 }),
  rating: int("rating").notNull(), // 1-5
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type TemplateRatingRow = typeof templateRatings.$inferSelect;
export type InsertTemplateRating = typeof templateRatings.$inferInsert;

// ─── Template Comments ──────────────────────────────────────────────────────
export const templateComments = mysqlTable("template_comments", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  templateUid: varchar("template_uid", { length: 36 }).notNull(),
  userOpenId: varchar("user_open_id", { length: 128 }).notNull(),
  userName: varchar("user_name", { length: 255 }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type TemplateCommentRow = typeof templateComments.$inferSelect;
export type InsertTemplateComment = typeof templateComments.$inferInsert;

// ─── Analyses ──────────────────────────────────────────────────────────────
export const analyses = mysqlTable("analyses", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  incidentId: varchar("incident_id", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"]).notNull().default("PENDING"),
  observation: text("observation"),
  hypotheses: json("hypotheses"),
  rootCause: text("root_cause"),
  rootCauseJustification: text("root_cause_justification"),
  recommendedSolution: text("recommended_solution"),
  confidenceScore: double("confidence_score"),
  pipelinePhases: json("pipeline_phases"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});
export type Analysis = typeof analyses.$inferSelect;

// ─── CaptureArtifacts ──────────────────────────────────────────────────────
export const captureArtifacts = mysqlTable("capture_artifacts", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  executionId: varchar("execution_id", { length: 36 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  storageUrl: varchar("storage_url", { length: 500 }),
  s3Uri: varchar("s3_uri", { length: 500 }),
  contentType: varchar("content_type", { length: 100 }),
  sizeBytes: int("size_bytes"),
  checksum: varchar("checksum", { length: 128 }),
  captureJobId: varchar("capture_job_id", { length: 36 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  downloadUrl: varchar("download_url", { length: 500 }),
});
export type CaptureArtifact = typeof captureArtifacts.$inferSelect;

// ─── CaptureJobs ───────────────────────────────────────────────────────────
export const captureJobs = mysqlTable("capture_jobs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  executionId: varchar("execution_id", { length: 36 }).notNull(),
  incidentId: varchar("incident_id", { length: 36 }),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  triggeredBy: varchar("triggered_by", { length: 64 }),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).notNull().default("QUEUED"),
  captureType: mysqlEnum("capture_type", ["LOGS", "PCAP"]).notNull(),
  targetType: mysqlEnum("target_type", ["K8S", "SSH", "PROBE"]).notNull(),
  durationSeconds: int("duration_seconds").default(60),
  maxSizeMb: int("max_size_mb").default(100),
  profile: varchar("profile", { length: 50 }),
  params: json("params"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type CaptureJob = typeof captureJobs.$inferSelect;

// ─── CaptureSessions ───────────────────────────────────────────────────────
export const captureSessions = mysqlTable("capture_sessions", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  policyId: varchar("policy_id", { length: 36 }).notNull(),
  executionId: varchar("execution_id", { length: 36 }),
  probeId: varchar("probe_id", { length: 36 }),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).notNull().default("QUEUED"),
  pcapPath: varchar("pcap_path", { length: 500 }),
  pcapSize: int("pcap_size"),
  packetCount: int("packet_count"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type CaptureSession = typeof captureSessions.$inferSelect;

// ─── CaptureSources ────────────────────────────────────────────────────────
export const captureSources = mysqlTable("capture_sources", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  captureId: varchar("capture_id", { length: 36 }).notNull(),
  namespace: varchar("namespace", { length: 100 }),
  podSelector: varchar("pod_selector", { length: 255 }),
  containerName: varchar("container_name", { length: 100 }),
  host: varchar("host", { length: 255 }),
  sshPort: int("ssh_port"),
  sshUser: varchar("ssh_user", { length: 100 }),
  logPaths: json("log_paths"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type CaptureSource = typeof captureSources.$inferSelect;

// ─── DriveImports ──────────────────────────────────────────────────────────
export const driveImports = mysqlTable("drive_imports", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  sourceFilename: varchar("source_filename", { length: 500 }).notNull(),
  sourceFormat: mysqlEnum("source_format", ["CSV", "JSON", "GPX", "GEOJSON", "IPERF3"]).notNull(),
  samplesImported: int("samples_imported").default(0),
  samplesSkipped: int("samples_skipped").default(0),
  errors: json("errors"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
});
export type DriveImport = typeof driveImports.$inferSelect;

// ─── DriveProbeConfigs ─────────────────────────────────────────────────────
export const driveProbeConfigs = mysqlTable("drive_probe_configs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  location: json("location"),
  captureType: varchar("capture_type", { length: 50 }),
  retentionDays: int("retention_days").default(30),
  maxSizeMb: int("max_size_mb").default(500),
  rotation: boolean("rotation").default(true),
  outputTarget: varchar("output_target", { length: 50 }),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type DriveProbeConfig = typeof driveProbeConfigs.$inferSelect;

// ─── NotificationDeliveryLogs ──────────────────────────────────────────────
export const notificationDeliveryLogs = mysqlTable("notification_delivery_logs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  ts: timestamp("ts").notNull().defaultNow(),
  ndlChannel: mysqlEnum("ndl_channel", ["SMS", "EMAIL"]).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  ruleId: varchar("rule_id", { length: 100 }),
  templateId: varchar("template_id", { length: 100 }),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  ndlStatus: mysqlEnum("ndl_status", ["SENT", "FAILED", "SKIPPED", "THROTTLED"]).notNull(),
  errorMessage: text("error_message"),
  traceId: varchar("trace_id", { length: 64 }),
  metadata: json("metadata"),
});
export type NotificationDeliveryLog = typeof notificationDeliveryLogs.$inferSelect;

// ─── NotificationRules ─────────────────────────────────────────────────────
export const notificationRules = mysqlTable("notification_rules", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: varchar("rule_id", { length: 100 }).unique().notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(true),
  channelsEnabled: json("channels_enabled"),
  templateSmsId: varchar("template_sms_id", { length: 100 }),
  templateEmailId: varchar("template_email_id", { length: 100 }),
  recipients: json("recipients"),
  customRecipientsEmails: json("custom_recipients_emails"),
  customRecipientsMsisdn: json("custom_recipients_msisdn"),
  throttlePolicy: json("throttle_policy"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  updatedBy: varchar("updated_by", { length: 64 }),
});
export type NotificationRule = typeof notificationRules.$inferSelect;

// ─── NotificationSettings ──────────────────────────────────────────────────
export const notificationSettings = mysqlTable("notification_settings", {
  id: int("id").autoincrement().primaryKey(),
  channel: mysqlEnum("channel", ["SMS", "EMAIL"]).unique().notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  enabled: boolean("enabled").default(false),
  config: json("config"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  updatedBy: varchar("updated_by", { length: 64 }),
});
export type NotificationSetting = typeof notificationSettings.$inferSelect;

// ─── NotificationTemplates ─────────────────────────────────────────────────
export const notificationTemplates = mysqlTable("notification_templates", {
  id: int("id").autoincrement().primaryKey(),
  templateId: varchar("template_id", { length: 100 }).unique().notNull(),
  notifTplChannel: mysqlEnum("notif_tpl_channel", ["SMS", "EMAIL"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  subject: varchar("subject", { length: 500 }),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  variablesSchema: json("variables_schema"),
  isSystem: boolean("is_system").default(false),
  notifTplStatus: mysqlEnum("notif_tpl_status", ["ACTIVE", "DISABLED"]).notNull().default("ACTIVE"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  updatedBy: varchar("updated_by", { length: 64 }),
});
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;

// ─── OutboundWebhooks ──────────────────────────────────────────────────────
export const outboundWebhooks = mysqlTable("outbound_webhooks", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  secret: varchar("secret", { length: 255 }).notNull(),
  events: json("events").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: int("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type OutboundWebhook = typeof outboundWebhooks.$inferSelect;

// ─── Permissions ───────────────────────────────────────────────────────────
export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  description: text("description"),
});
export type Permission = typeof permissions.$inferSelect;

// ─── ProbePolicies ─────────────────────────────────────────────────────────
export const probePolicies = mysqlTable("probe_policies", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  probeId: varchar("probe_id", { length: 36 }).notNull(),
  maxCaptureDurationSec: int("max_capture_duration_sec").default(300),
  maxCaptureSizeMb: int("max_capture_size_mb").default(500),
  pcapInterfacesAllowlist: json("pcap_interfaces_allowlist"),
  pcapBpfAllowlist: json("pcap_bpf_allowlist"),
  storageKind: varchar("storage_kind", { length: 50 }).default("minio"),
  storageEndpoint: varchar("storage_endpoint", { length: 255 }),
  storageBucket: varchar("storage_bucket", { length: 100 }),
  storagePrefix: varchar("storage_prefix", { length: 255 }),
  redactionEnabled: boolean("redaction_enabled").default(false),
  redactionPatterns: json("redaction_patterns"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type ProbePolicy = typeof probePolicies.$inferSelect;

// ─── RolePermissions ───────────────────────────────────────────────────────
export const rolePermissions = mysqlTable("role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  roleId: varchar("role_id", { length: 36 }).notNull(),
  permissionId: varchar("permission_id", { length: 36 }).notNull(),
});
export type RolePermission = typeof rolePermissions.$inferSelect;

// ─── Roles ─────────────────────────────────────────────────────────────────
export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  description: text("description"),
  scope: mysqlEnum("scope", ["GLOBAL", "PROJECT"]).notNull().default("GLOBAL"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type Role = typeof roles.$inferSelect;

// ─── RunnerJobs ────────────────────────────────────────────────────────────
export const runnerJobs = mysqlTable("runner_jobs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  executionId: varchar("execution_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  runnerId: varchar("runner_id", { length: 64 }),
  status: mysqlEnum("status", ["PENDING", "RUNNING", "DONE", "FAILED"]).notNull().default("PENDING"),
  scriptId: varchar("script_id", { length: 36 }),
  scriptVersion: int("script_version"),
  downloadUrl: varchar("download_url", { length: 500 }),
  datasetBundleId: varchar("dataset_bundle_id", { length: 36 }),
  targetEnv: mysqlEnum("target_env", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]),
  artifactUploadPolicy: json("artifact_upload_policy"),
  metrics: json("metrics"),
  artifactManifest: json("artifact_manifest"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
});
export type RunnerJob = typeof runnerJobs.$inferSelect;

// ─── TestDevices ───────────────────────────────────────────────────────────
export const testDevices = mysqlTable("test_devices", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  model: varchar("model", { length: 255 }).notNull(),
  osVersion: varchar("os_version", { length: 100 }),
  diagCapable: boolean("diag_capable").default(false),
  toolsEnabled: json("tools_enabled"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type TestDevice = typeof testDevices.$inferSelect;

// ─── UserRoles ─────────────────────────────────────────────────────────────
export const userRoles = mysqlTable("user_roles", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  roleId: varchar("role_id", { length: 36 }).notNull(),
});
export type UserRole = typeof userRoles.$inferSelect;

// ─── PasswordResetTokens ──────────────────────────────────────────────────
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 128 }).unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ─── WebhookDeliveries ─────────────────────────────────────────────────────
export const webhookDeliveries = mysqlTable("webhook_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).unique().notNull(),
  webhookId: int("webhook_id").notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: json("payload").notNull(),
  status: mysqlEnum("status", ["PENDING", "SUCCESS", "FAILED"]).notNull().default("PENDING"),
  httpStatus: int("http_status"),
  responseBody: text("response_body"),
  attempt: int("attempt").notNull().default(1),
  maxAttempts: int("max_attempts").notNull().default(3),
  nextRetryAt: timestamp("next_retry_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;


// ─── AppSettings ───────────────────────────────────────────────────────────
// Key-value store for application-wide settings (branding, etc.)
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("setting_key", { length: 100 }).notNull().unique(),
  settingValue: text("setting_value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  updatedBy: varchar("updated_by", { length: 64 }),
});
export type AppSetting = typeof appSettings.$inferSelect;

// ─── Drive Runs (mobile field test runs) ──────────────────────────────────
// A "run" is a single field session started from mobile: GPS collection, notes, file uploads.
export const driveRuns = mysqlTable("drive_runs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  projectUid: varchar("project_uid", { length: 36 }).notNull(),
  campaignUid: varchar("campaign_uid", { length: 36 }),
  routeUid: varchar("route_uid", { length: 36 }),
  deviceUid: varchar("device_uid", { length: 36 }),
  probeUid: varchar("probe_uid", { length: 36 }),
  status: mysqlEnum("status", ["DRAFT", "RUNNING", "UPLOADING", "COMPLETED", "FAILED", "CANCELED"]).default("DRAFT").notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  metaJson: json("meta_json"), // { mobileOs, appVersion, operator, networkMode, ... }
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type DriveRun = typeof driveRuns.$inferSelect;
export type InsertDriveRun = typeof driveRuns.$inferInsert;

// ─── Drive Location Samples (GPS track) ───────────────────────────────────
export const driveLocationSamples = mysqlTable("drive_location_samples", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  runUid: varchar("run_uid", { length: 36 }).notNull(),
  ts: timestamp("ts").notNull(),
  lat: double("lat").notNull(),
  lon: double("lon").notNull(),
  speedMps: double("speed_mps"),
  headingDeg: double("heading_deg"),
  accuracyM: double("accuracy_m"),
  altitudeM: double("altitude_m"),
  source: mysqlEnum("source", ["GPS", "MANUAL"]).default("GPS").notNull(),
});
export type DriveLocationSample = typeof driveLocationSamples.$inferSelect;
export type InsertDriveLocationSample = typeof driveLocationSamples.$inferInsert;

// ─── Drive Run Events (field notes, markers, errors) ──────────────────────
export const driveRunEvents = mysqlTable("drive_run_events", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  runUid: varchar("run_uid", { length: 36 }).notNull(),
  ts: timestamp("ts").notNull(),
  type: mysqlEnum("type", ["NOTE", "PHOTO", "MARKER", "ERROR", "CUSTOM"]).notNull(),
  severity: mysqlEnum("severity", ["INFO", "WARN", "ERROR"]).default("INFO"),
  message: text("message"),
  dataJson: json("data_json"),
});
export type DriveRunEvent = typeof driveRunEvents.$inferSelect;
export type InsertDriveRunEvent = typeof driveRunEvents.$inferInsert;

// ─── Drive AI Analyses ───────────────────────────────────────────────────
export const driveAiAnalyses = mysqlTable("drive_ai_analyses", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  runUid: varchar("run_uid", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "COMPLETED", "FAILED"]).default("QUEUED").notNull(),
  mode: mysqlEnum("mode", ["FAST", "DEEP"]).default("FAST").notNull(),
  model: varchar("model", { length: 128 }),
  inputHash: varchar("input_hash", { length: 64 }),
  summaryMd: text("summary_md"),
  outputJson: json("output_json"),
  qualityScore: int("quality_score"),
  jobId: int("job_id"),
  error: text("error"),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type DriveAiAnalysis = typeof driveAiAnalyses.$inferSelect;
export type InsertDriveAiAnalysis = typeof driveAiAnalyses.$inferInsert;

// ─── Drive AI Segments ───────────────────────────────────────────────────
export const driveAiSegments = mysqlTable("drive_ai_segments", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  analysisUid: varchar("analysis_uid", { length: 36 }).notNull(),
  segmentType: mysqlEnum("segment_type", [
    "DROP_CALL", "LOW_THROUGHPUT", "HO_FAIL", "HIGH_LATENCY",
    "COVERAGE_HOLE", "INTERFERENCE", "BACKHAUL", "DNS", "GPS_GAP", "OTHER"
  ]).notNull(),
  startTs: timestamp("start_ts"),
  endTs: timestamp("end_ts"),
  geoBboxJson: json("geo_bbox_json"),
  evidenceJson: json("evidence_json"),
  diagnosisMd: text("diagnosis_md"),
  actionsJson: json("actions_json"),
  confidence: double("confidence"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type DriveAiSegment = typeof driveAiSegments.$inferSelect;
export type InsertDriveAiSegment = typeof driveAiSegments.$inferInsert;

// ─── Drive AI Feedback ───────────────────────────────────────────────────
export const driveAiFeedback = mysqlTable("drive_ai_feedback", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  analysisUid: varchar("analysis_uid", { length: 36 }).notNull(),
  score: int("score").notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type DriveAiFeedbackRow = typeof driveAiFeedback.$inferSelect;
export type InsertDriveAiFeedback = typeof driveAiFeedback.$inferInsert;

// ─── Drive AI Handoffs ───────────────────────────────────────────────────
export const driveAiHandoffs = mysqlTable("drive_ai_handoffs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  analysisUid: varchar("analysis_uid", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["OPEN", "ASSIGNED", "RESOLVED"]).default("OPEN").notNull(),
  assignedToUserUid: varchar("assigned_to_user_uid", { length: 64 }),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type DriveAiHandoff = typeof driveAiHandoffs.$inferSelect;
export type InsertDriveAiHandoff = typeof driveAiHandoffs.$inferInsert;


// ─── AI Provider Configs ───────────────────────────────────────────────────
// Org-scoped AI provider configuration with encrypted API key storage
export const aiProviderConfigs = mysqlTable("ai_provider_configs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull(),
  orgId: varchar("org_id", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  provider: mysqlEnum("provider", ["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "CUSTOM_HTTP"]).notNull().default("OPENAI"),
  model: varchar("model", { length: 128 }).notNull().default("gpt-4o"),
  baseUrl: varchar("base_url", { length: 512 }),
  timeoutMs: int("timeout_ms").notNull().default(30000),
  maxRetries: int("max_retries").notNull().default(2),
  temperature: decimal("temperature", { precision: 3, scale: 2 }),
  azureEndpoint: varchar("azure_endpoint", { length: 512 }),
  azureApiVersion: varchar("azure_api_version", { length: 32 }),
  azureDeployment: varchar("azure_deployment", { length: 128 }),
  customHttpUrl: varchar("custom_http_url", { length: 512 }),
  secretCiphertext: text("secret_ciphertext"),
  secretKeyId: varchar("secret_key_id", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type AiProviderConfig = typeof aiProviderConfigs.$inferSelect;
export type InsertAiProviderConfig = typeof aiProviderConfigs.$inferInsert;


// ─── AI Engines (multi-engine support) ─────────────────────────────────────
// Each org can configure multiple AI engines with different providers/models.
// One engine per org is marked as primary (fallback).
export const aiEngines = mysqlTable("ai_engines", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  provider: mysqlEnum("provider", ["OPENAI", "GEMINI", "ANTHROPIC", "CUSTOM_HTTP"]).notNull().default("OPENAI"),
  enabled: boolean("enabled").notNull().default(true),
  isPrimary: boolean("is_primary").notNull().default(false),
  model: varchar("model", { length: 128 }).notNull(),
  baseUrl: varchar("base_url", { length: 512 }),
  timeoutMs: int("timeout_ms").notNull().default(30000),
  maxRetries: int("max_retries").notNull().default(2),
  temperature: decimal("temperature", { precision: 3, scale: 2 }),
  maxOutputTokens: int("max_output_tokens"),
  extraJson: json("extra_json"),
  secretCiphertext: text("secret_ciphertext"),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type AiEngine = typeof aiEngines.$inferSelect;
export type InsertAiEngine = typeof aiEngines.$inferInsert;

// ─── AI Routing Rules ──────────────────────────────────────────────────────
// Rules determine which engine to use for a given use case.
// Evaluated in priority order (lower = higher priority).
export const aiRoutingRules = mysqlTable("ai_routing_rules", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  priority: int("priority").notNull().default(100),
  useCase: mysqlEnum("use_case", ["DRIVE_DIAG", "ANALYTICS", "SUMMARIZE", "INGEST_LONG", "GENERAL"]).notNull(),
  conditionsJson: json("conditions_json"),
  targetEngineUid: varchar("target_engine_uid", { length: 36 }).notNull(),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type AiRoutingRule = typeof aiRoutingRules.$inferSelect;
export type InsertAiRoutingRule = typeof aiRoutingRules.$inferInsert;


// ─── Keycloak Configuration ─────────────────────────────────────────────────
// DB columns: id, uid, org_id, url, realm, client_id, client_secret_ciphertext, session_timeout_minutes, google_client_id, google_client_secret_ciphertext, github_client_id, github_client_secret_ciphertext, enabled, created_by, created_at, updated_at
export const keycloakConfigs = mysqlTable("keycloak_configs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  realm: varchar("realm", { length: 255 }).notNull(),
  clientId: varchar("client_id", { length: 255 }).notNull(),
  clientSecretCiphertext: text("client_secret_ciphertext").notNull(),
  sessionTimeoutMinutes: int("session_timeout_minutes").notNull().default(1440),
  googleClientId: varchar("google_client_id", { length: 512 }),
  googleClientSecretCiphertext: text("google_client_secret_ciphertext"),
  githubClientId: varchar("github_client_id", { length: 255 }),
  githubClientSecretCiphertext: text("github_client_secret_ciphertext"),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export type KeycloakConfig = typeof keycloakConfigs.$inferSelect;
export type InsertKeycloakConfig = typeof keycloakConfigs.$inferInsert;

// ─── Keycloak Configuration History (Audit Trail) ──────────────────────────
// DB columns: id, uid, config_uid, org_id, action, changes_json, changed_by, created_at
export const keycloakConfigHistory = mysqlTable("keycloak_config_history", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  configUid: varchar("config_uid", { length: 36 }).notNull(),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  action: mysqlEnum("action", ["CREATE", "UPDATE", "DELETE", "TEST_CONNECTION", "TEST_PROVIDERS"]).notNull(),
  changesJson: json("changes_json"),
  changedBy: varchar("changed_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type KeycloakConfigHistory = typeof keycloakConfigHistory.$inferSelect;
export type InsertKeycloakConfigHistory = typeof keycloakConfigHistory.$inferInsert;
