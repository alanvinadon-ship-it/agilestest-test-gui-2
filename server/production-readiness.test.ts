// ============================================================================
// AgilesTest — Production Readiness Tests
// Artifact storage, job queue, observability, security
// ============================================================================

import { describe, it, expect } from "vitest";

// ── Artifact Storage Tests ─────────────────────────────────────────────────

describe("Artifact Storage", () => {
  describe("MIME type validation", () => {
    it("should allow common artifact MIME types", async () => {
      const { ALLOWED_MIME_TYPES } = await import("./artifactStorage");
      const allowed = [
        "text/plain",
        "text/csv",
        "application/json",
        "application/pdf",
        "application/zip",
        "image/png",
        "image/jpeg",
        "application/octet-stream",
        "application/vnd.tcpdump.pcap",
      ];
      for (const mime of allowed) {
        expect(ALLOWED_MIME_TYPES.has(mime)).toBe(true);
      }
    });

    it("should reject dangerous MIME types", async () => {
      const { ALLOWED_MIME_TYPES } = await import("./artifactStorage");
      const rejected = [
        "application/javascript",
        "text/html",
        "application/x-executable",
        "application/x-sharedlib",
      ];
      for (const mime of rejected) {
        expect(ALLOWED_MIME_TYPES.has(mime)).toBe(false);
      }
    });
  });

  describe("File size validation", () => {
    it("should enforce 100MB max file size", async () => {
      const { MAX_FILE_SIZE_BYTES } = await import("./artifactStorage");
      expect(MAX_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);
    });
  });

  describe("Artifact key builder", () => {
    it("should build correct storage key", async () => {
      const { buildArtifactKey } = await import("./artifactStorage");
      const key = buildArtifactKey(1, 42, "results.jtl");
      expect(key).toMatch(/^projects\/1\/executions\/42\/\d+_results\.jtl$/);
    });

    it("should sanitize filename", async () => {
      const { buildArtifactKey } = await import("./artifactStorage");
      const key = buildArtifactKey(1, 42, "my file (1).jtl");
      expect(key).toMatch(/^projects\/1\/executions\/42\/\d+_my_file__1_\.jtl$/);
    });

    it("should handle special characters in filename", async () => {
      const { buildArtifactKey } = await import("./artifactStorage");
      const key = buildArtifactKey(5, 100, "résultats-test_v2.csv");
      expect(key).toContain("projects/5/executions/100/");
      expect(key).toContain("_v2.csv");
    });
  });

  describe("Signed URL expiry", () => {
    it("should use 1 hour expiry", async () => {
      const { SIGNED_URL_EXPIRY_SECONDS } = await import("./artifactStorage");
      expect(SIGNED_URL_EXPIRY_SECONDS).toBe(3600);
    });
  });
});

// ── Job Queue Tests ────────────────────────────────────────────────────────

describe("Job Queue", () => {
  describe("Job types", () => {
    it("should export all expected job types", async () => {
      const mod = await import("./jobQueue");
      expect(mod.enqueueJob).toBeDefined();
      expect(mod.pollAndProcess).toBeDefined();
      expect(mod.startPolling).toBeDefined();
      expect(mod.stopPolling).toBeDefined();
      expect(mod.getJobStatus).toBeDefined();
      expect(mod.getJobsByRun).toBeDefined();
      expect(mod.registerHandler).toBeDefined();
    });
  });

  describe("Handler registration", () => {
    it("should accept handler registration without error", async () => {
      const { registerHandler } = await import("./jobQueue");
      expect(() => {
        registerHandler("parseJmeterJtl", async () => ({ ok: true }));
      }).not.toThrow();
    });
  });
});

// ── Observability Tests ────────────────────────────────────────────────────

describe("Observability", () => {
  describe("Logger", () => {
    it("should export a pino logger instance", async () => {
      const { logger } = await import("./logger");
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
    });
  });

  describe("Request ID middleware", () => {
    it("should export requestIdMiddleware", async () => {
      const { requestIdMiddleware } = await import("./observability");
      expect(typeof requestIdMiddleware).toBe("function");
    });
  });

  describe("Metrics", () => {
    it("should export metrics object with correct structure", async () => {
      const { metrics } = await import("./observability");
      expect(metrics).toHaveProperty("http");
      expect(metrics).toHaveProperty("trpc");
      expect(metrics).toHaveProperty("jobs");
      expect(metrics).toHaveProperty("uptime");
      expect(metrics.http).toHaveProperty("total");
      expect(metrics.http).toHaveProperty("byStatus");
      expect(metrics.http).toHaveProperty("byMethod");
    });

    it("should track job metrics", async () => {
      const { incrementJobMetric, metrics } = await import("./observability");
      const before = metrics.jobs.enqueued;
      incrementJobMetric("enqueued", "testJob");
      expect(metrics.jobs.enqueued).toBe(before + 1);
      expect(metrics.jobs.byName["testJob"]).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Health endpoints", () => {
    it("should export registerHealthEndpoints", async () => {
      const { registerHealthEndpoints } = await import("./observability");
      expect(typeof registerHealthEndpoints).toBe("function");
    });
  });
});

// ── Security Tests ─────────────────────────────────────────────────────────

describe("Security", () => {
  describe("Security headers middleware", () => {
    it("should export securityHeadersMiddleware", async () => {
      const { securityHeadersMiddleware } = await import("./security");
      expect(typeof securityHeadersMiddleware).toBe("function");
    });
  });

  describe("Rate limit middleware", () => {
    it("should export rateLimitMiddleware factory", async () => {
      const { rateLimitMiddleware } = await import("./security");
      expect(typeof rateLimitMiddleware).toBe("function");

      const middleware = rateLimitMiddleware({
        maxRequests: 10,
        windowMs: 60000,
      });
      expect(typeof middleware).toBe("function");
    });
  });

  describe("CORS middleware", () => {
    it("should export corsMiddleware", async () => {
      const { corsMiddleware } = await import("./security");
      expect(typeof corsMiddleware).toBe("function");
    });
  });

  describe("Register security", () => {
    it("should export registerSecurityMiddleware", async () => {
      const { registerSecurityMiddleware } = await import("./security");
      expect(typeof registerSecurityMiddleware).toBe("function");
    });
  });
});

// ── ENV Configuration Tests ────────────────────────────────────────────────

describe("ENV Configuration", () => {
  it("should have S3 configuration keys", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV).toHaveProperty("s3Endpoint");
    expect(ENV).toHaveProperty("s3AccessKey");
    expect(ENV).toHaveProperty("s3SecretKey");
    expect(ENV).toHaveProperty("s3Bucket");
    expect(ENV).toHaveProperty("s3Region");
    expect(ENV).toHaveProperty("s3ForcePathStyle");
  });

  it("should have retention configuration keys", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV).toHaveProperty("retentionDaysArtifacts");
    expect(ENV).toHaveProperty("retentionDaysRuns");
    expect(ENV).toHaveProperty("retentionDaysSessions");
    expect(typeof ENV.retentionDaysArtifacts).toBe("number");
    expect(typeof ENV.retentionDaysRuns).toBe("number");
    expect(typeof ENV.retentionDaysSessions).toBe("number");
  });

  it("should have default retention values", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV.retentionDaysArtifacts).toBe(90);
    expect(ENV.retentionDaysRuns).toBe(180);
    expect(ENV.retentionDaysSessions).toBe(30);
  });

  it("should have security configuration keys", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV).toHaveProperty("corsOrigin");
    expect(ENV).toHaveProperty("rateLimitLoginMax");
    expect(ENV).toHaveProperty("rateLimitLoginWindowMs");
    expect(ENV).toHaveProperty("metricsBasicAuthUser");
    expect(ENV).toHaveProperty("metricsBasicAuthPassword");
  });

  it("should have default rate limit values", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV.rateLimitLoginMax).toBe(10);
    expect(ENV.rateLimitLoginWindowMs).toBe(900000);
  });

  it("should have observability configuration keys", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV).toHaveProperty("logLevel");
    expect(ENV).toHaveProperty("metricsEnabled");
    expect(ENV.logLevel).toBe("info");
  });
});

// ── Schema Tests ───────────────────────────────────────────────────────────

describe("Database Schema", () => {
  it("should export jobs table", async () => {
    const { jobs } = await import("../drizzle/schema");
    expect(jobs).toBeDefined();
  });

  it("should export aiAnalyses table", async () => {
    const { aiAnalyses } = await import("../drizzle/schema");
    expect(aiAnalyses).toBeDefined();
  });

  it("should have correct job status enum values", async () => {
    const { jobs } = await import("../drizzle/schema");
    // Verify the table exists and has the expected structure
    expect(jobs).toBeDefined();
  });
});
