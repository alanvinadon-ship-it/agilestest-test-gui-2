/**
 * runnerConfig.ts — tRPC router for Playwright runner configuration.
 * Stores settings in app_settings table, keyed by "playwright_*" prefix.
 */
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { writeAuditLog } from "../lib/auditLog";
import { loadPlaywrightConfig } from "../runner/playwrightConfig";

const SETTING_KEYS = {
  runnerMode: "playwright_runner_mode",
  remoteEndpoint: "playwright_remote_endpoint",
  remoteToken: "playwright_remote_token",
  headless: "playwright_headless",
  timeoutMs: "playwright_timeout_ms",
  enableScreenshots: "playwright_enable_screenshots",
  enableTrace: "playwright_enable_trace",
  enableVideo: "playwright_enable_video",
} as const;

export const runnerConfigRouter = router({
  /** Get current runner configuration (admin only) */
  get: protectedProcedure.query(async () => {
    const keys = Object.values(SETTING_KEYS);
    const settings = await db.getAppSettings(keys);

    // Merge: DB settings override env defaults
    const envConfig = loadPlaywrightConfig();

    return {
      runnerMode: settings[SETTING_KEYS.runnerMode] || envConfig.runnerMode,
      remoteEndpoint: settings[SETTING_KEYS.remoteEndpoint] || envConfig.remoteEndpoint || "",
      remoteToken: settings[SETTING_KEYS.remoteToken] ? "••••••••" : "",
      headless: settings[SETTING_KEYS.headless] !== undefined
        ? settings[SETTING_KEYS.headless] !== "false"
        : envConfig.headless,
      timeoutMs: settings[SETTING_KEYS.timeoutMs]
        ? parseInt(settings[SETTING_KEYS.timeoutMs]!, 10)
        : envConfig.timeoutMs,
      enableScreenshots: settings[SETTING_KEYS.enableScreenshots] !== undefined
        ? settings[SETTING_KEYS.enableScreenshots] !== "false"
        : envConfig.enableScreenshots,
      enableTrace: settings[SETTING_KEYS.enableTrace] === "true" || envConfig.enableTrace,
      enableVideo: settings[SETTING_KEYS.enableVideo] === "true" || envConfig.enableVideo,
      // Diagnostic info
      hasRemoteToken: !!settings[SETTING_KEYS.remoteToken],
      hasRemoteEndpoint: !!(settings[SETTING_KEYS.remoteEndpoint] || envConfig.remoteEndpoint),
      source: {
        runnerMode: settings[SETTING_KEYS.runnerMode] ? "db" : "env",
        remoteEndpoint: settings[SETTING_KEYS.remoteEndpoint] ? "db" : (envConfig.remoteEndpoint ? "env" : "none"),
      },
    };
  }),

  /** Update runner configuration (admin only) */
  update: adminProcedure
    .input(
      z.object({
        runnerMode: z.enum(["LOCAL", "REMOTE", "AUTO"]).optional(),
        remoteEndpoint: z.string().optional(),
        remoteToken: z.string().optional(),
        headless: z.boolean().optional(),
        timeoutMs: z.number().int().min(1000).max(120000).optional(),
        enableScreenshots: z.boolean().optional(),
        enableTrace: z.boolean().optional(),
        enableVideo: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const updates: { key: string; value: string | null }[] = [];

      if (input.runnerMode !== undefined) {
        updates.push({ key: SETTING_KEYS.runnerMode, value: input.runnerMode });
      }
      if (input.remoteEndpoint !== undefined) {
        updates.push({ key: SETTING_KEYS.remoteEndpoint, value: input.remoteEndpoint || null });
      }
      if (input.remoteToken !== undefined && input.remoteToken !== "••••••••") {
        updates.push({ key: SETTING_KEYS.remoteToken, value: input.remoteToken || null });
      }
      if (input.headless !== undefined) {
        updates.push({ key: SETTING_KEYS.headless, value: String(input.headless) });
      }
      if (input.timeoutMs !== undefined) {
        updates.push({ key: SETTING_KEYS.timeoutMs, value: String(input.timeoutMs) });
      }
      if (input.enableScreenshots !== undefined) {
        updates.push({ key: SETTING_KEYS.enableScreenshots, value: String(input.enableScreenshots) });
      }
      if (input.enableTrace !== undefined) {
        updates.push({ key: SETTING_KEYS.enableTrace, value: String(input.enableTrace) });
      }
      if (input.enableVideo !== undefined) {
        updates.push({ key: SETTING_KEYS.enableVideo, value: String(input.enableVideo) });
      }

      // Persist each setting
      for (const { key, value } of updates) {
        await db.setAppSetting(key, value, ctx.user.openId);
      }

      await writeAuditLog({
        userId: ctx.user.openId,
        action: "RUNNER_CONFIG_UPDATED",
        entity: "RUNNER_CONFIG",
        details: { fields: updates.map((u) => u.key) },
      });

      return { success: true, updatedFields: updates.length };
    }),

  /** Test connectivity to remote endpoint (admin only) */
  testConnection: adminProcedure.mutation(async () => {
    try {
      const { resolveRunner } = await import("../runner/runnerResolver");
      const config = loadPlaywrightConfig();
      // Override with DB settings
      const keys = Object.values(SETTING_KEYS);
      const settings = await db.getAppSettings(keys);
      if (settings[SETTING_KEYS.runnerMode]) {
        config.runnerMode = settings[SETTING_KEYS.runnerMode] as any;
      }
      if (settings[SETTING_KEYS.remoteEndpoint]) {
        config.remoteEndpoint = settings[SETTING_KEYS.remoteEndpoint];
      }
      if (settings[SETTING_KEYS.remoteToken]) {
        config.remoteToken = settings[SETTING_KEYS.remoteToken];
      }

      const result = await resolveRunner(config);
      return {
        success: result.runner !== null,
        diagnostic: result.diagnostic,
      };
    } catch (err: any) {
      return {
        success: false,
        diagnostic: null,
        error: err.message || "Erreur inconnue",
      };
    }
  }),
});
