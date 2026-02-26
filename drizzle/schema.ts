import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  float,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ═══════════════════════════════════════════════════════════════════════════
// 1. USERS (existing, extended)
// ═══════════════════════════════════════════════════════════════════════════
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  fullName: varchar("full_name", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  status: mysqlEnum("status", ["ACTIVE", "DISABLED", "INVITED"]).default("ACTIVE").notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// 2. PROJECTS
// ═══════════════════════════════════════════════════════════════════════════
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  domain: varchar("domain", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["ACTIVE", "ARCHIVED", "DRAFT"]).default("ACTIVE").notNull(),
  createdBy: varchar("created_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_projects_status").on(t.status),
  index("idx_projects_domain").on(t.domain),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 3. TEST PROFILES
// ═══════════════════════════════════════════════════════════════════════════
export const testProfiles = mysqlTable("test_profiles", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  protocol: varchar("protocol", { length: 50 }).default("CUSTOM"),
  testType: mysqlEnum("test_type", ["VABF", "VSR", "VABE"]).notNull(),
  domain: varchar("domain", { length: 50 }),
  profileType: varchar("profile_type", { length: 50 }),
  targetHost: varchar("target_host", { length: 255 }),
  targetPort: int("target_port").default(0),
  parameters: json("parameters").$type<Record<string, unknown>>(),
  config: json("config").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_profiles_project").on(t.projectId),
  index("idx_profiles_test_type").on(t.testType),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 4. TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════
export const testScenarios = mysqlTable("test_scenarios", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  scenarioCode: varchar("scenario_code", { length: 100 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  profileId: varchar("profile_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  testType: mysqlEnum("test_type", ["VABF", "VSR", "VABE"]).notNull(),
  status: mysqlEnum("status", ["DRAFT", "FINAL", "DEPRECATED"]).default("DRAFT").notNull(),
  version: int("version").default(1),
  steps: json("steps").$type<Array<{
    id: string;
    order: number;
    action: string;
    description: string;
    expected_result: string;
    parameters: Record<string, unknown>;
  }>>(),
  requiredDatasetTypes: json("required_dataset_types").$type<string[]>(),
  artifactPolicy: json("artifact_policy").$type<string[]>(),
  kpiThresholds: json("kpi_thresholds").$type<Record<string, number>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_scenarios_project").on(t.projectId),
  index("idx_scenarios_profile").on(t.profileId),
  index("idx_scenarios_status").on(t.status),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 5. DATASET TYPES (gabarits)
// ═══════════════════════════════════════════════════════════════════════════
export const datasetTypes = mysqlTable("dataset_types", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  datasetTypeId: varchar("dataset_type_id", { length: 100 }).notNull(),
  domain: varchar("domain", { length: 50 }).notNull(),
  testType: varchar("test_type", { length: 10 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  schemaFields: json("schema_fields").$type<Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    example?: string;
    enum_values?: string[];
  }>>(),
  examplePlaceholders: json("example_placeholders").$type<Record<string, string>>(),
  tags: json("tags").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("idx_dataset_types_slug").on(t.datasetTypeId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 6. DATASETS
// ═══════════════════════════════════════════════════════════════════════════
export const datasets = mysqlTable("datasets", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  format: mysqlEnum("format", ["CSV", "JSON", "YAML"]).default("JSON").notNull(),
  rowCount: int("row_count").default(0),
  sizeBytes: int("size_bytes").default(0),
  storageUrl: varchar("storage_url", { length: 500 }),
  datasetTypeId: varchar("dataset_type_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_datasets_project").on(t.projectId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 7. DATASET INSTANCES
// ═══════════════════════════════════════════════════════════════════════════
export const datasetInstances = mysqlTable("dataset_instances", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  datasetTypeId: varchar("dataset_type_id", { length: 100 }).notNull(),
  env: mysqlEnum("env", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).notNull(),
  version: int("version").default(1),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "DEPRECATED"]).default("DRAFT").notNull(),
  valuesJson: json("values_json").$type<Record<string, unknown>>(),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_di_project").on(t.projectId),
  index("idx_di_type").on(t.datasetTypeId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 8. DATASET BUNDLES
// ═══════════════════════════════════════════════════════════════════════════
export const datasetBundles = mysqlTable("dataset_bundles", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  env: mysqlEnum("env", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).notNull(),
  version: int("version").default(1),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "DEPRECATED"]).default("DRAFT").notNull(),
  tags: json("tags").$type<string[]>(),
  createdBy: varchar("created_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_bundles_project").on(t.projectId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 9. BUNDLE ITEMS (many-to-many: bundle <-> dataset_instance)
// ═══════════════════════════════════════════════════════════════════════════
export const bundleItems = mysqlTable("bundle_items", {
  id: int("id").autoincrement().primaryKey(),
  bundleId: varchar("bundle_id", { length: 36 }).notNull(),
  datasetId: varchar("dataset_id", { length: 36 }).notNull(),
}, (t) => [
  index("idx_bi_bundle").on(t.bundleId),
  index("idx_bi_dataset").on(t.datasetId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 10. DATASET SECRETS
// ═══════════════════════════════════════════════════════════════════════════
export const datasetSecrets = mysqlTable("dataset_secrets", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: varchar("dataset_id", { length: 36 }).notNull(),
  keyPath: varchar("key_path", { length: 255 }).notNull(),
  isSecret: boolean("is_secret").default(true).notNull(),
}, (t) => [
  index("idx_ds_dataset").on(t.datasetId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 11. EXECUTIONS
// ═══════════════════════════════════════════════════════════════════════════
export const executions = mysqlTable("executions", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  profileId: varchar("profile_id", { length: 36 }).notNull(),
  scenarioId: varchar("scenario_id", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["PENDING", "RUNNING", "PASSED", "FAILED", "ERROR", "CANCELLED"]).default("PENDING").notNull(),
  runnerType: varchar("runner_type", { length: 50 }),
  scriptId: varchar("script_id", { length: 36 }),
  scriptVersion: int("script_version"),
  datasetBundleId: varchar("dataset_bundle_id", { length: 36 }),
  targetEnv: mysqlEnum("target_env", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]),
  runnerId: varchar("runner_id", { length: 64 }),
  aiRepairFromExecutionId: varchar("ai_repair_from_execution_id", { length: 36 }),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  durationMs: int("duration_ms"),
  artifactsCount: int("artifacts_count").default(0),
  incidentsCount: int("incidents_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_exec_project").on(t.projectId),
  index("idx_exec_status").on(t.status),
  index("idx_exec_scenario").on(t.scenarioId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 12. RUNNER JOBS
// ═══════════════════════════════════════════════════════════════════════════
export const runnerJobs = mysqlTable("runner_jobs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  executionId: varchar("execution_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  runnerId: varchar("runner_id", { length: 64 }),
  status: mysqlEnum("status", ["PENDING", "RUNNING", "DONE", "FAILED"]).default("PENDING").notNull(),
  scriptId: varchar("script_id", { length: 36 }),
  scriptVersion: int("script_version"),
  downloadUrl: varchar("download_url", { length: 500 }),
  datasetBundleId: varchar("dataset_bundle_id", { length: 36 }),
  targetEnv: mysqlEnum("target_env", ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]),
  artifactUploadPolicy: json("artifact_upload_policy").$type<string[]>(),
  metrics: json("metrics").$type<{
    total_tests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration_ms: number;
  }>(),
  artifactManifest: json("artifact_manifest").$type<Array<{
    artifact_type: string;
    filename: string;
    storage_path: string;
    size_bytes: number;
    sha256: string;
    content_type: string;
  }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
}, (t) => [
  index("idx_rj_execution").on(t.executionId),
  index("idx_rj_status").on(t.status),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 13. ARTIFACTS
// ═══════════════════════════════════════════════════════════════════════════
export const artifacts = mysqlTable("artifacts", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  executionId: varchar("execution_id", { length: 36 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  filename: varchar("filename", { length: 500 }).notNull(),
  name: varchar("name", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  contentType: varchar("content_type", { length: 100 }),
  sizeBytes: int("size_bytes").default(0),
  storagePath: varchar("storage_path", { length: 500 }),
  storageUrl: varchar("storage_url", { length: 500 }),
  s3Uri: varchar("s3_uri", { length: 500 }),
  checksum: varchar("checksum", { length: 128 }),
  captureJobId: varchar("capture_job_id", { length: 36 }),
  downloadUrl: varchar("download_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  uploadedAt: timestamp("uploaded_at"),
}, (t) => [
  index("idx_art_execution").on(t.executionId),
  index("idx_art_type").on(t.type),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 14. INCIDENTS
// ═══════════════════════════════════════════════════════════════════════════
export const incidents = mysqlTable("incidents", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  executionId: varchar("execution_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  severity: mysqlEnum("severity", ["CRITICAL", "MAJOR", "MINOR", "INFO"]).default("INFO").notNull(),
  stepName: varchar("step_name", { length: 255 }),
  expectedResult: text("expected_result"),
  actualResult: text("actual_result"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
}, (t) => [
  index("idx_inc_execution").on(t.executionId),
  index("idx_inc_project").on(t.projectId),
  index("idx_inc_severity").on(t.severity),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 15. ANALYSES
// ═══════════════════════════════════════════════════════════════════════════
export const analyses = mysqlTable("analyses", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  incidentId: varchar("incident_id", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"]).default("PENDING").notNull(),
  observation: text("observation"),
  hypotheses: json("hypotheses").$type<Array<{
    id: string;
    description: string;
    confidence: number;
    selected: boolean;
  }>>(),
  rootCause: text("root_cause"),
  rootCauseJustification: text("root_cause_justification"),
  recommendedSolution: text("recommended_solution"),
  confidenceScore: float("confidence_score"),
  pipelinePhases: json("pipeline_phases").$type<Array<{ phase: string; content: string }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (t) => [
  index("idx_ana_incident").on(t.incidentId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 16. CAPTURE JOBS
// ═══════════════════════════════════════════════════════════════════════════
export const captureJobs = mysqlTable("capture_jobs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  executionId: varchar("execution_id", { length: 36 }).notNull(),
  incidentId: varchar("incident_id", { length: 36 }),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  triggeredBy: varchar("triggered_by", { length: 64 }),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).default("QUEUED").notNull(),
  captureType: mysqlEnum("capture_type", ["LOGS", "PCAP"]).notNull(),
  targetType: mysqlEnum("target_type", ["K8S", "SSH", "PROBE"]).notNull(),
  durationSeconds: int("duration_seconds").default(60),
  maxSizeMb: int("max_size_mb").default(100),
  profile: varchar("profile", { length: 50 }),
  params: json("params").$type<Record<string, unknown>>(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_cj_execution").on(t.executionId),
  index("idx_cj_project").on(t.projectId),
  index("idx_cj_status").on(t.status),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 17. CAPTURE SOURCES
// ═══════════════════════════════════════════════════════════════════════════
export const captureSources = mysqlTable("capture_sources", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  captureId: varchar("capture_id", { length: 36 }).notNull(),
  namespace: varchar("namespace", { length: 100 }),
  podSelector: varchar("pod_selector", { length: 255 }),
  containerName: varchar("container_name", { length: 100 }),
  host: varchar("host", { length: 255 }),
  sshPort: int("ssh_port"),
  sshUser: varchar("ssh_user", { length: 100 }),
  logPaths: json("log_paths").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_cs_capture").on(t.captureId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 18. CAPTURE ARTIFACTS
// ═══════════════════════════════════════════════════════════════════════════
export const captureArtifacts = mysqlTable("capture_artifacts", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  executionId: varchar("execution_id", { length: 36 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  storageUrl: varchar("storage_url", { length: 500 }),
  s3Uri: varchar("s3_uri", { length: 500 }),
  contentType: varchar("content_type", { length: 100 }),
  sizeBytes: int("size_bytes"),
  checksum: varchar("checksum", { length: 128 }),
  captureJobId: varchar("capture_job_id", { length: 36 }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  downloadUrl: varchar("download_url", { length: 500 }),
}, (t) => [
  index("idx_ca_execution").on(t.executionId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 19. PROBES
// ═══════════════════════════════════════════════════════════════════════════
export const probes = mysqlTable("probes", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  site: varchar("site", { length: 100 }).notNull(),
  zone: varchar("zone", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]).notNull(),
  capabilities: json("capabilities").$type<string[]>(),
  status: mysqlEnum("status", ["ONLINE", "OFFLINE", "DEGRADED"]).default("OFFLINE").notNull(),
  authTokenHash: varchar("auth_token_hash", { length: 255 }),
  lastSeenAt: timestamp("last_seen_at"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  version: varchar("version", { length: 50 }),
  uptimeSeconds: int("uptime_seconds"),
  cpuPercent: float("cpu_percent"),
  diskFreeMb: int("disk_free_mb"),
  interfaces: json("interfaces").$type<string[]>(),
  activeSessions: int("active_sessions"),
  totalCaptures: int("total_captures"),
  lastError: text("last_error"),
  healthStatus: mysqlEnum("health_status", ["healthy", "degraded", "unhealthy"]),
  heartbeatIntervalSec: int("heartbeat_interval_sec").default(30),
  allowlistCidrs: json("allowlist_cidrs").$type<string[]>(),
  tlsEnabled: boolean("tls_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_probes_status").on(t.status),
  index("idx_probes_site").on(t.site),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 20. PROBE POLICIES
// ═══════════════════════════════════════════════════════════════════════════
export const probePolicies = mysqlTable("probe_policies", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  probeId: varchar("probe_id", { length: 36 }).notNull(),
  maxCaptureDurationSec: int("max_capture_duration_sec").default(300),
  maxCaptureSizeMb: int("max_capture_size_mb").default(500),
  pcapInterfacesAllowlist: json("pcap_interfaces_allowlist").$type<string[]>(),
  pcapBpfAllowlist: json("pcap_bpf_allowlist").$type<string[]>(),
  storageKind: varchar("storage_kind", { length: 50 }).default("minio"),
  storageEndpoint: varchar("storage_endpoint", { length: 255 }),
  storageBucket: varchar("storage_bucket", { length: 100 }),
  storagePrefix: varchar("storage_prefix", { length: 255 }),
  redactionEnabled: boolean("redaction_enabled").default(false),
  redactionPatterns: json("redaction_patterns").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_pp_probe").on(t.probeId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 21. CAPTURE POLICIES
// ═══════════════════════════════════════════════════════════════════════════
export const capturePolicies = mysqlTable("capture_policies", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  captureMode: mysqlEnum("capture_mode", ["RUNNER", "PROBE"]).notNull(),
  triggerOn: json("trigger_on").$type<string[]>(),
  autoCapture: boolean("auto_capture").default(false),
  duration: int("duration").default(60),
  maxSize: int("max_size").default(100),
  bpfFilter: varchar("bpf_filter", { length: 500 }),
  interfaceName: varchar("interface_name", { length: 100 }),
  probeId: varchar("probe_id", { length: 36 }),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_cp_project").on(t.projectId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 22. CAPTURE SESSIONS
// ═══════════════════════════════════════════════════════════════════════════
export const captureSessions = mysqlTable("capture_sessions", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  policyId: varchar("policy_id", { length: 36 }).notNull(),
  executionId: varchar("execution_id", { length: 36 }),
  probeId: varchar("probe_id", { length: 36 }),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).default("QUEUED").notNull(),
  pcapPath: varchar("pcap_path", { length: 500 }),
  pcapSize: int("pcap_size"),
  packetCount: int("packet_count"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_csess_policy").on(t.policyId),
  index("idx_csess_execution").on(t.executionId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 23. DRIVE CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════
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
}, (t) => [
  index("idx_dc_project").on(t.projectId),
  index("idx_dc_status").on(t.status),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 24. DRIVE ROUTES
// ═══════════════════════════════════════════════════════════════════════════
export const driveRoutes = mysqlTable("drive_routes", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  routeGeojson: json("route_geojson"),
  checkpointsGeojson: json("checkpoints_geojson"),
  expectedDurationMin: int("expected_duration_min"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_dr_campaign").on(t.campaignId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 25. TEST DEVICES
// ═══════════════════════════════════════════════════════════════════════════
export const testDevices = mysqlTable("test_devices", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  model: varchar("model", { length: 255 }).notNull(),
  osVersion: varchar("os_version", { length: 100 }),
  diagCapable: boolean("diag_capable").default(false),
  toolsEnabled: json("tools_enabled").$type<string[]>(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_td_project").on(t.projectId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 26. DRIVE PROBE CONFIGS
// ═══════════════════════════════════════════════════════════════════════════
export const driveProbeConfigs = mysqlTable("drive_probe_configs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  location: json("location").$type<{ lat: number; lon: number; label: string }>(),
  captureType: varchar("capture_type", { length: 50 }),
  retentionDays: int("retention_days").default(30),
  maxSizeMb: int("max_size_mb").default(500),
  rotation: boolean("rotation").default(true),
  outputTarget: varchar("output_target", { length: 50 }),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_dpc_project").on(t.projectId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 27. DRIVE JOBS
// ═══════════════════════════════════════════════════════════════════════════
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
  artifactsManifest: json("artifacts_manifest").$type<Array<{
    artifact_type: string;
    filename: string;
    minio_path: string;
    size_bytes: number;
    sha256: string;
    content_type: string;
  }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
}, (t) => [
  index("idx_dj_campaign").on(t.campaignId),
  index("idx_dj_status").on(t.status),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 28. KPI SAMPLES
// ═══════════════════════════════════════════════════════════════════════════
export const kpiSamples = mysqlTable("kpi_samples", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  driveJobId: varchar("drive_job_id", { length: 36 }).notNull(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  routeId: varchar("route_id", { length: 36 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  lat: float("lat").notNull(),
  lon: float("lon").notNull(),
  kpiName: varchar("kpi_name", { length: 50 }).notNull(),
  value: float("value").notNull(),
  unit: varchar("unit", { length: 20 }),
  cellId: varchar("cell_id", { length: 50 }),
  technology: varchar("technology", { length: 20 }),
}, (t) => [
  index("idx_kpi_job").on(t.driveJobId),
  index("idx_kpi_campaign").on(t.campaignId),
  index("idx_kpi_name").on(t.kpiName),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 29. DRIVE RUN SUMMARIES
// ═══════════════════════════════════════════════════════════════════════════
export const driveRunSummaries = mysqlTable("drive_run_summaries", {
  id: int("id").autoincrement().primaryKey(),
  driveJobId: varchar("drive_job_id", { length: 36 }).notNull().unique(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  totalSamples: int("total_samples").default(0),
  durationSec: int("duration_sec").default(0),
  distanceKm: float("distance_km").default(0),
  kpiAverages: json("kpi_averages").$type<Record<string, number>>(),
  kpiMin: json("kpi_min").$type<Record<string, number>>(),
  kpiMax: json("kpi_max").$type<Record<string, number>>(),
  thresholdViolations: json("threshold_violations").$type<Array<{
    kpi_name: string;
    threshold: number;
    actual_avg: number;
    direction: string;
    violation_count: number;
    total_samples: number;
  }>>(),
  overallPass: boolean("overall_pass").default(true),
}, (t) => [
  index("idx_drs_campaign").on(t.campaignId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 30. DRIVE IMPORTS
// ═══════════════════════════════════════════════════════════════════════════
export const driveImports = mysqlTable("drive_imports", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  sourceFilename: varchar("source_filename", { length: 500 }).notNull(),
  sourceFormat: mysqlEnum("source_format", ["CSV", "JSON", "GPX", "GEOJSON", "IPERF3"]).notNull(),
  samplesImported: int("samples_imported").default(0),
  samplesSkipped: int("samples_skipped").default(0),
  errors: json("errors").$type<string[]>(),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
}, (t) => [
  index("idx_di2_campaign").on(t.campaignId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 31. INVITES
// ═══════════════════════════════════════════════════════════════════════════
export const invites = mysqlTable("invites", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("invite_role", ["ADMIN", "MANAGER", "VIEWER"]).default("VIEWER").notNull(),
  status: mysqlEnum("invite_status", ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]).default("PENDING").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  invitedBy: varchar("invited_by", { length: 64 }),
  invitedByName: varchar("invited_by_name", { length: 255 }),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_inv_email").on(t.email),
  index("idx_inv_status").on(t.status),
  index("idx_inv_token").on(t.token),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 32. PROJECT MEMBERSHIPS
// ═══════════════════════════════════════════════════════════════════════════
export const projectMemberships = mysqlTable("project_memberships", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  projectName: varchar("project_name", { length: 255 }),
  userId: varchar("user_id", { length: 64 }).notNull(),
  userEmail: varchar("user_email", { length: 320 }),
  userName: varchar("user_name", { length: 255 }),
  projectRole: mysqlEnum("project_role", ["PROJECT_ADMIN", "PROJECT_EDITOR", "PROJECT_VIEWER"]).default("PROJECT_VIEWER").notNull(),
  addedBy: varchar("added_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_pm_project").on(t.projectId),
  index("idx_pm_user").on(t.userId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 33. ROLES (RBAC)
// ═══════════════════════════════════════════════════════════════════════════
export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  scope: mysqlEnum("scope", ["GLOBAL", "PROJECT"]).default("GLOBAL").notNull(),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════════════════
// 34. PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════
export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  module: varchar("module", { length: 100 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  description: text("description"),
}, (t) => [
  uniqueIndex("idx_perm_module_action").on(t.module, t.action),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 35. ROLE PERMISSIONS (many-to-many)
// ═══════════════════════════════════════════════════════════════════════════
export const rolePermissions = mysqlTable("role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  roleId: varchar("role_id", { length: 36 }).notNull(),
  permissionId: varchar("permission_id", { length: 36 }).notNull(),
}, (t) => [
  index("idx_rp_role").on(t.roleId),
  index("idx_rp_perm").on(t.permissionId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 36. USER ROLES (many-to-many)
// ═══════════════════════════════════════════════════════════════════════════
export const userRoles = mysqlTable("user_roles", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  roleId: varchar("role_id", { length: 36 }).notNull(),
}, (t) => [
  index("idx_ur_user").on(t.userId),
  index("idx_ur_role").on(t.roleId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 37. AUDIT LOGS
// ═══════════════════════════════════════════════════════════════════════════
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  actorId: varchar("actor_id", { length: 64 }),
  actorName: varchar("actor_name", { length: 255 }),
  actorEmail: varchar("actor_email", { length: 320 }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 36 }),
  targetLabel: varchar("target_label", { length: 500 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  traceId: varchar("trace_id", { length: 64 }),
}, (t) => [
  index("idx_al_action").on(t.action),
  index("idx_al_entity").on(t.entityType),
  index("idx_al_actor").on(t.actorId),
  index("idx_al_ts").on(t.timestamp),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 38. NOTIFICATION SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
export const notificationSettings = mysqlTable("notification_settings", {
  id: int("id").autoincrement().primaryKey(),
  channel: mysqlEnum("channel", ["SMS", "EMAIL"]).notNull().unique(),
  provider: varchar("provider", { length: 50 }).notNull(),
  enabled: boolean("enabled").default(false),
  config: json("config").$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updated_by", { length: 64 }),
});

// ═══════════════════════════════════════════════════════════════════════════
// 39. NOTIFICATION TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════
export const notificationTemplates = mysqlTable("notification_templates", {
  id: int("id").autoincrement().primaryKey(),
  templateId: varchar("template_id", { length: 100 }).notNull().unique(),
  channel: mysqlEnum("notif_tpl_channel", ["SMS", "EMAIL"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  subject: varchar("subject", { length: 500 }),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  variablesSchema: json("variables_schema").$type<Array<{
    name: string;
    description: string;
    example: string;
  }>>(),
  isSystem: boolean("is_system").default(false),
  status: mysqlEnum("notif_tpl_status", ["ACTIVE", "DISABLED"]).default("ACTIVE").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updated_by", { length: 64 }),
});

// ═══════════════════════════════════════════════════════════════════════════
// 40. NOTIFICATION RULES
// ═══════════════════════════════════════════════════════════════════════════
export const notificationRules = mysqlTable("notification_rules", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: varchar("rule_id", { length: 100 }).notNull().unique(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(true),
  channelsEnabled: json("channels_enabled").$type<string[]>(),
  templateSmsId: varchar("template_sms_id", { length: 100 }),
  templateEmailId: varchar("template_email_id", { length: 100 }),
  recipients: json("recipients").$type<string[]>(),
  customRecipientsEmails: json("custom_recipients_emails").$type<string[]>(),
  customRecipientsMsisdn: json("custom_recipients_msisdn").$type<string[]>(),
  throttlePolicy: json("throttle_policy").$type<{ max_per_hour: number; dedup_window_min: number }>(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updated_by", { length: 64 }),
});

// ═══════════════════════════════════════════════════════════════════════════
// 41. NOTIFICATION DELIVERY LOGS
// ═══════════════════════════════════════════════════════════════════════════
export const notificationDeliveryLogs = mysqlTable("notification_delivery_logs", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  ts: timestamp("ts").defaultNow().notNull(),
  channel: mysqlEnum("ndl_channel", ["SMS", "EMAIL"]).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  ruleId: varchar("rule_id", { length: 100 }),
  templateId: varchar("template_id", { length: 100 }),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  status: mysqlEnum("ndl_status", ["SENT", "FAILED", "SKIPPED", "THROTTLED"]).notNull(),
  errorMessage: text("error_message"),
  traceId: varchar("trace_id", { length: 64 }),
  metadata: json("metadata").$type<Record<string, string>>(),
}, (t) => [
  index("idx_ndl_channel").on(t.channel),
  index("idx_ndl_status").on(t.status),
  index("idx_ndl_ts").on(t.ts),
]);

// ═══════════════════════════════════════════════════════════════════════════
// 42. GENERATED SCRIPTS (IA)
// ═══════════════════════════════════════════════════════════════════════════
export const generatedScripts = mysqlTable("generated_scripts", {
  id: int("id").autoincrement().primaryKey(),
  uid: varchar("uid", { length: 36 }).notNull().unique(),
  scenarioId: varchar("scenario_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  version: int("version").default(1),
  language: varchar("language", { length: 50 }).default("typescript"),
  framework: varchar("framework", { length: 50 }).default("playwright"),
  code: text("code"),
  status: mysqlEnum("script_status", ["DRAFT", "VALIDATED", "DEPRECATED"]).default("DRAFT").notNull(),
  generatedBy: varchar("generated_by", { length: 50 }).default("AI"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_gs_scenario").on(t.scenarioId),
  index("idx_gs_project").on(t.projectId),
]);
