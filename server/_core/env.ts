export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // ── S3 / MinIO ───────────────────────────────────────────────────────────
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3AccessKey: process.env.S3_ACCESS_KEY ?? "",
  s3SecretKey: process.env.S3_SECRET_KEY ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "agilestest-artifacts",
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  s3PublicUrl: process.env.S3_PUBLIC_URL ?? "",

  // ── Retention (days) ─────────────────────────────────────────────────────
  retentionDaysArtifacts: parseInt(process.env.RETENTION_DAYS_ARTIFACTS ?? "90", 10),
  retentionDaysRuns: parseInt(process.env.RETENTION_DAYS_RUNS ?? "180", 10),
  retentionDaysSessions: parseInt(process.env.RETENTION_DAYS_SESSIONS ?? "30", 10),

  // ── Observability ────────────────────────────────────────────────────────
  logLevel: process.env.LOG_LEVEL ?? "info",
  metricsEnabled: process.env.METRICS_ENABLED === "true",

  // ── Security ─────────────────────────────────────────────────────────────
  corsOrigin: process.env.CORS_ORIGIN ?? "",
  rateLimitLoginMax: parseInt(process.env.RATE_LIMIT_LOGIN_MAX ?? "10", 10),
  rateLimitLoginWindowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS ?? "900000", 10),
  metricsBasicAuthUser: process.env.METRICS_BASIC_AUTH_USER ?? "",
  metricsBasicAuthPassword: process.env.METRICS_BASIC_AUTH_PASSWORD ?? "",

  // ── AI Config ───────────────────────────────────────────────────────────
  aiConfigLocked: process.env.AI_CONFIG_LOCKED === "true",
  aiConfigMasterKey: process.env.AI_CONFIG_MASTER_KEY ?? "",
  aiConfigMasterKeyFile: process.env.AI_CONFIG_MASTER_KEY_FILE ?? "",
};
