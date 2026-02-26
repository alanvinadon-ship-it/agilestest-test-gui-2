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
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  domain: varchar("domain", { length: 64 }).default("WEB").notNull(),
  status: mysqlEnum("status", ["ACTIVE", "ARCHIVED", "DRAFT"]).default("ACTIVE").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Project Memberships ────────────────────────────────────────────────────
export const projectMemberships = mysqlTable("project_memberships", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["ADMIN", "MANAGER", "VIEWER"]).default("VIEWER").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
export const testProfiles = mysqlTable("test_profiles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  profileType: varchar("profileType", { length: 64 }).default("WEB").notNull(),
  config: json("config"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TestProfile = typeof testProfiles.$inferSelect;
export type InsertTestProfile = typeof testProfiles.$inferInsert;

// ─── Test Scenarios ─────────────────────────────────────────────────────────
export const testScenarios = mysqlTable("test_scenarios", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  profileId: int("profileId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  testType: mysqlEnum("testType", ["VABF", "VSR", "VABE"]).default("VABF").notNull(),
  status: mysqlEnum("status", ["DRAFT", "FINAL", "DEPRECATED"]).default("DRAFT").notNull(),
  priority: mysqlEnum("priority", ["P0", "P1", "P2"]).default("P1").notNull(),
  steps: json("steps"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TestScenario = typeof testScenarios.$inferSelect;
export type InsertTestScenario = typeof testScenarios.$inferInsert;

// ─── Datasets ───────────────────────────────────────────────────────────────
export const datasets = mysqlTable("datasets", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  datasetType: varchar("datasetType", { length: 128 }).notNull(),
  data: json("data"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = typeof datasets.$inferInsert;

// ─── Executions ─────────────────────────────────────────────────────────────
export const executions = mysqlTable("executions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  profileId: int("profileId"),
  scenarioId: int("scenarioId"),
  status: mysqlEnum("status", ["PENDING", "RUNNING", "PASSED", "FAILED", "ERROR", "CANCELLED"]).default("PENDING").notNull(),
  runnerType: varchar("runnerType", { length: 64 }),
  scriptId: varchar("scriptId", { length: 128 }),
  scriptVersion: int("scriptVersion"),
  datasetBundleId: int("datasetBundleId"),
  targetEnv: mysqlEnum("targetEnv", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).default("DEV"),
  runnerId: varchar("runnerId", { length: 128 }),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
  durationMs: int("durationMs"),
  artifactsCount: int("artifactsCount").default(0).notNull(),
  incidentsCount: int("incidentsCount").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Execution = typeof executions.$inferSelect;
export type InsertExecution = typeof executions.$inferInsert;

// ─── Artifacts ──────────────────────────────────────────────────────────────
export const artifacts = mysqlTable("artifacts", {
  id: int("id").autoincrement().primaryKey(),
  executionId: int("executionId").notNull(),
  type: varchar("type", { length: 64 }).default("OTHER").notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  sizeBytes: int("sizeBytes").default(0).notNull(),
  storagePath: varchar("storagePath", { length: 1024 }),
  storageUrl: varchar("storageUrl", { length: 1024 }),
  checksum: varchar("checksum", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
// Tracks health state per probe for alerting (RED > 5min → notify, anti-spam 30min)
export const probeAlertState = mysqlTable("probe_alert_state", {
  id: int("id").autoincrement().primaryKey(),
  probeId: int("probeId").notNull(),
  orgId: int("orgId").notNull(),
  /** Current health state: GREEN, ORANGE, RED */
  healthState: mysqlEnum("healthState", ["GREEN", "ORANGE", "RED"]).default("GREEN").notNull(),
  /** When the probe first entered RED state (null if not RED) */
  redSinceAt: timestamp("redSinceAt"),
  /** Last time a notification was sent for this probe */
  lastNotifiedAt: timestamp("lastNotifiedAt"),
  /** Number of consecutive RED alerts sent */
  alertCount: int("alertCount").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProbeAlertState = typeof probeAlertState.$inferSelect;
export type InsertProbeAlertState = typeof probeAlertState.$inferInsert;
