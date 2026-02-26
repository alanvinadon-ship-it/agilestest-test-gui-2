// ============================================================================
// AgilesTest — Integration Tests: Health, Readyz, Metrics, Security
// Tests the wired middleware via Express app simulation
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Observability Middleware Unit Tests ─────────────────────────────────────

describe("requestIdMiddleware", () => {
  it("should generate a UUID if no x-request-id header is present", async () => {
    const { requestIdMiddleware } = await import("./observability");
    const req = { headers: {} } as any;
    const res = { setHeader: vi.fn() } as any;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it("should preserve existing x-request-id header", async () => {
    const { requestIdMiddleware } = await import("./observability");
    const existingId = "my-custom-request-id-123";
    const req = { headers: { "x-request-id": existingId } } as any;
    const res = { setHeader: vi.fn() } as any;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", existingId);
    expect(next).toHaveBeenCalled();
  });
});

describe("metricsMiddleware", () => {
  it("should increment http total counter", async () => {
    const { metricsMiddleware, metrics } = await import("./observability");
    const before = metrics.http.total;
    const req = { method: "GET", originalUrl: "/test" } as any;
    const res = { on: vi.fn() } as any;
    const next = vi.fn();

    metricsMiddleware(req, res, next);

    expect(metrics.http.total).toBe(before + 1);
    expect(metrics.http.byMethod["GET"]).toBeGreaterThanOrEqual(1);
    expect(next).toHaveBeenCalled();
  });

  it("should track tRPC calls on finish", async () => {
    const { metricsMiddleware, metrics } = await import("./observability");
    const beforeTotal = metrics.trpc.total;
    const req = { method: "GET", originalUrl: "/api/trpc/auth.me" } as any;
    let finishCallback: Function;
    const res = {
      on: vi.fn((event: string, cb: Function) => {
        if (event === "finish") finishCallback = cb;
      }),
      statusCode: 200,
    } as any;
    const next = vi.fn();

    metricsMiddleware(req, res, next);
    finishCallback!();

    expect(metrics.trpc.total).toBe(beforeTotal + 1);
    expect(metrics.trpc.success).toBeGreaterThanOrEqual(1);
    expect(metrics.trpc.byProcedure["auth.me"]).toBeGreaterThanOrEqual(1);
  });
});

// ── Security Middleware Unit Tests ──────────────────────────────────────────

describe("securityHeadersMiddleware", () => {
  it("should set all security headers", async () => {
    const { securityHeadersMiddleware } = await import("./security");
    const headers: Record<string, string> = {};
    const req = {} as any;
    const res = {
      setHeader: vi.fn((key: string, value: string) => {
        headers[key] = value;
      }),
    } as any;
    const next = vi.fn();

    securityHeadersMiddleware(req, res, next);

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=(), payment=()"
    );
    expect(next).toHaveBeenCalled();
  });
});

describe("rateLimitMiddleware", () => {
  it("should allow requests within limit", async () => {
    const { rateLimitMiddleware } = await import("./security");
    const middleware = rateLimitMiddleware({
      maxRequests: 5,
      windowMs: 60000,
      keyPrefix: "test-allow",
    });

    const req = { ip: "192.168.1.100", socket: { remoteAddress: "192.168.1.100" } } as any;
    const headers: Record<string, any> = {};
    const res = {
      setHeader: vi.fn((k: string, v: any) => { headers[k] = v; }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(headers["X-RateLimit-Limit"]).toBe(5);
    expect(headers["X-RateLimit-Remaining"]).toBe(4);
  });

  it("should block requests exceeding limit", async () => {
    const { rateLimitMiddleware } = await import("./security");
    const middleware = rateLimitMiddleware({
      maxRequests: 2,
      windowMs: 60000,
      keyPrefix: "test-block",
    });

    const req = { ip: "10.0.0.99", socket: { remoteAddress: "10.0.0.99" } } as any;
    const headers: Record<string, any> = {};
    const res = {
      setHeader: vi.fn((k: string, v: any) => { headers[k] = v; }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    // First 2 requests should pass
    middleware(req, res, next);
    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);

    // 3rd request should be blocked
    next.mockClear();
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Too Many Requests" })
    );
  });
});

describe("corsMiddleware", () => {
  it("should set CORS headers in development", async () => {
    const { corsMiddleware } = await import("./security");
    const headers: Record<string, string> = {};
    const req = {
      headers: { origin: "http://localhost:5173" },
      method: "GET",
    } as any;
    const res = {
      setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
      status: vi.fn().mockReturnThis(),
      end: vi.fn(),
    } as any;
    const next = vi.fn();

    corsMiddleware(req, res, next);

    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
    expect(headers["Access-Control-Allow-Headers"]).toContain("x-request-id");
    expect(next).toHaveBeenCalled();
  });

  it("should respond 204 to OPTIONS preflight", async () => {
    const { corsMiddleware } = await import("./security");
    const req = {
      headers: { origin: "http://localhost:5173" },
      method: "OPTIONS",
    } as any;
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn(),
    } as any;
    const next = vi.fn();

    corsMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});

// ── Health Endpoints Registration Tests ────────────────────────────────────

describe("registerHealthEndpoints", () => {
  it("should register /healthz, /readyz, /metrics routes", async () => {
    const { registerHealthEndpoints } = await import("./observability");
    const routes: string[] = [];
    const mockApp = {
      get: vi.fn((path: string) => {
        routes.push(path);
      }),
    } as any;

    registerHealthEndpoints(mockApp);

    expect(routes).toContain("/healthz");
    expect(routes).toContain("/readyz");
    expect(routes).toContain("/metrics");
  });
});

// ── Server Startup Order Tests ─────────────────────────────────────────────

describe("Server middleware wiring order", () => {
  it("should have observability and security imports available", async () => {
    const obs = await import("./observability");
    const sec = await import("./security");

    expect(obs.requestIdMiddleware).toBeDefined();
    expect(obs.requestLoggingMiddleware).toBeDefined();
    expect(obs.metricsMiddleware).toBeDefined();
    expect(obs.registerHealthEndpoints).toBeDefined();
    expect(sec.registerSecurityMiddleware).toBeDefined();
    expect(sec.corsMiddleware).toBeDefined();
  });
});

// ── incrementJobMetric Tests ───────────────────────────────────────────────

describe("incrementJobMetric", () => {
  it("should increment completed counter", async () => {
    const { incrementJobMetric, metrics } = await import("./observability");
    const before = metrics.jobs.completed;
    incrementJobMetric("completed", "parseJmeterJtl");
    expect(metrics.jobs.completed).toBe(before + 1);
    expect(metrics.jobs.byName["parseJmeterJtl"]).toBeGreaterThanOrEqual(1);
  });

  it("should increment failed counter", async () => {
    const { incrementJobMetric, metrics } = await import("./observability");
    const before = metrics.jobs.failed;
    incrementJobMetric("failed", "aiAnalyzeRun");
    expect(metrics.jobs.failed).toBe(before + 1);
  });
});
