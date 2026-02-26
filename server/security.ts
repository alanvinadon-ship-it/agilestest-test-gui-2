// ============================================================================
// AgilesTest — Security Middleware
// Helmet, rate limiting, CORS strict
// ============================================================================

import { Request, Response, NextFunction, Express } from "express";
import { ENV } from "./_core/env";

// ── Security Headers (Helmet-like) ────────────────────────────────────────

export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  // Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // XSS protection (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // HSTS (only in production)
  if (ENV.isProduction) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  next();
}

// ── Rate Limiting ─────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function rateLimitMiddleware(options: {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.keyPrefix || "rl"}:${ip}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    const remaining = Math.max(0, options.maxRequests - entry.count);
    res.setHeader("X-RateLimit-Limit", options.maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(entry.resetAt / 1000)
    );

    if (entry.count > options.maxRequests) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({
        error: "Too Many Requests",
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

// ── CORS ──────────────────────────────────────────────────────────────────

export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const origin = req.headers.origin;

  if (ENV.corsOrigin) {
    // Strict CORS: only allow configured origins
    const allowedOrigins = ENV.corsOrigin.split(",").map((o) => o.trim());
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  } else if (!ENV.isProduction) {
    // Dev: allow all origins
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-request-id"
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}

// ── Register all security middleware ───────────────────────────────────────

export function registerSecurityMiddleware(app: Express) {
  // Security headers on all routes
  app.use(securityHeadersMiddleware);

  // Rate limit on login/auth endpoints
  app.use(
    "/api/oauth",
    rateLimitMiddleware({
      maxRequests: ENV.rateLimitLoginMax,
      windowMs: ENV.rateLimitLoginWindowMs,
      keyPrefix: "login",
    })
  );

  // Rate limit on tRPC (general, more permissive)
  app.use(
    "/api/trpc",
    rateLimitMiddleware({
      maxRequests: 200,
      windowMs: 60_000,
      keyPrefix: "trpc",
    })
  );
}
