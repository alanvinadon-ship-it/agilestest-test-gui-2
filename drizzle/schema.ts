import {
  int, mysqlEnum, mysqlTable, text, timestamp, varchar,
  boolean, json, bigint,
} from "drizzle-orm/mysql-core";

// ─── Users ──────────────────────────────────────────────────────────────────
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
export const invites = mysqlTable("invites", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["ADMIN", "MANAGER", "VIEWER"]).default("VIEWER").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  status: mysqlEnum("status", ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]).default("PENDING").notNull(),
  invitedBy: int("invitedBy").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invite = typeof invites.$inferSelect;
export type InsertInvite = typeof invites.$inferInsert;

// ─── Audit Logs ─────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 128 }).notNull(),
  entity: varchar("entity", { length: 128 }).notNull(),
  entityId: varchar("entityId", { length: 128 }),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
export const incidents = mysqlTable("incidents", {
  id: int("id").autoincrement().primaryKey(),
  executionId: int("executionId").notNull(),
  severity: mysqlEnum("severity", ["CRITICAL", "MAJOR", "MINOR", "INFO"]).default("INFO").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  stepIndex: int("stepIndex"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
export const probes = mysqlTable("probes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  probeType: mysqlEnum("probeType", ["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]).default("LINUX_EDGE").notNull(),
  status: mysqlEnum("status", ["ONLINE", "OFFLINE", "DEGRADED"]).default("OFFLINE").notNull(),
  host: varchar("host", { length: 255 }),
  port: int("port"),
  capabilities: json("capabilities"),
  config: json("config"),
  lastSeenAt: timestamp("lastSeenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProbeRow = typeof probes.$inferSelect;
export type InsertProbe = typeof probes.$inferInsert;

// ─── AI Generated Scripts ───────────────────────────────────────────────────
export const generatedScripts = mysqlTable("generated_scripts", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scenarioId: int("scenarioId"),
  name: varchar("name", { length: 255 }).notNull(),
  framework: varchar("framework", { length: 64 }).notNull(),
  language: varchar("language", { length: 64 }).default("typescript").notNull(),
  code: text("code").notNull(),
  version: int("version").default(1).notNull(),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "DEPRECATED"]).default("DRAFT").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
  version: int("version").default(1).notNull(),
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
