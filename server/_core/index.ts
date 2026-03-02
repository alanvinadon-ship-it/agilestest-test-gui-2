import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import sseStreamRouter from "../routes/sseStream";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

// ── Observability & Security ──────────────────────────────────────────────
import {
  requestIdMiddleware,
  requestLoggingMiddleware,
  metricsMiddleware,
  registerHealthEndpoints,
} from "../observability";
import {
  registerSecurityMiddleware,
  corsMiddleware,
} from "../security";

// ── Drive Ingestion (registers job handler) ──────────────────────────────
import "../driveIngestion";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── 1. Observability middleware (earliest possible) ──────────────────
  // Request ID must be first so all subsequent middleware/routes can use it
  app.use(requestIdMiddleware);
  app.use(requestLoggingMiddleware);
  app.use(metricsMiddleware);

  // ── 2. Security middleware (before any routes) ──────────────────────
  // Security headers, rate limiting on /api/oauth and /api/trpc
  registerSecurityMiddleware(app);
  app.use(corsMiddleware);

  // ── 3. Body parsers ─────────────────────────────────────────────────
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── 4. Health & metrics endpoints ───────────────────────────────────
  // Registered before app routes so /healthz, /readyz, /metrics are always accessible
  registerHealthEndpoints(app);

  // ── 5. OAuth callback under /api/oauth/callback ─────────────────────
  registerOAuthRoutes(app);

  // ── 6. SSE Streaming for AI ──────────────────────────────────────────
  app.use(sseStreamRouter);

  // ── 7. tRPC API ─────────────────────────────────────────────────────
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ── 7. Frontend (Vite dev or static) ────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
