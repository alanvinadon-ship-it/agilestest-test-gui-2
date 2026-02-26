import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as notifDb from "../db/notifications";

export const notifSettingsRouter = router({
  // ── Settings ──
  getSettings: protectedProcedure
    .input(z.object({ channel: z.enum(["SMS", "EMAIL"]) }))
    .query(({ input }) => notifDb.getSettings(input.channel)),

  listSettings: protectedProcedure.query(() => notifDb.listSettings()),

  upsertSettings: protectedProcedure
    .input(z.object({
      channel: z.enum(["SMS", "EMAIL"]),
      provider: z.string(),
      enabled: z.boolean().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      updatedBy: z.string().optional(),
    }))
    .mutation(({ input }) => notifDb.upsertSettings(input)),

  // ── Templates ──
  listTemplates: protectedProcedure
    .input(z.object({ channel: z.enum(["SMS", "EMAIL"]).optional() }))
    .query(({ input }) => notifDb.listTemplates(input.channel)),

  getTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(({ input }) => notifDb.getTemplateById(input.templateId)),

  upsertTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      channel: z.enum(["SMS", "EMAIL"]),
      name: z.string(),
      description: z.string().optional(),
      subject: z.string().optional(),
      bodyText: z.string().optional(),
      bodyHtml: z.string().optional(),
      variablesSchema: z.array(z.object({
        name: z.string(), description: z.string(), example: z.string(),
      })).optional(),
      isSystem: z.boolean().optional(),
      status: z.enum(["ACTIVE", "DISABLED"]).optional(),
      updatedBy: z.string().optional(),
    }))
    .mutation(({ input }) => notifDb.upsertTemplate(input)),

  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(({ input }) => notifDb.deleteTemplate(input.templateId)),

  // ── Rules ──
  listRules: protectedProcedure.query(() => notifDb.listRules()),

  getRule: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .query(({ input }) => notifDb.getRuleById(input.ruleId)),

  upsertRule: protectedProcedure
    .input(z.object({
      ruleId: z.string(),
      eventType: z.string(),
      enabled: z.boolean().optional(),
      channelsEnabled: z.array(z.string()).optional(),
      templateSmsId: z.string().optional(),
      templateEmailId: z.string().optional(),
      recipients: z.array(z.string()).optional(),
      customRecipientsEmails: z.array(z.string()).optional(),
      customRecipientsMsisdn: z.array(z.string()).optional(),
      throttlePolicy: z.object({
        max_per_hour: z.number(), dedup_window_min: z.number(),
      }).optional(),
      updatedBy: z.string().optional(),
    }))
    .mutation(({ input }) => notifDb.upsertRule(input)),

  deleteRule: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(({ input }) => notifDb.deleteRule(input.ruleId)),

  // ── Delivery Logs ──
  listDeliveryLogs: protectedProcedure
    .input(z.object({
      channel: z.enum(["SMS", "EMAIL"]).optional(),
      status: z.enum(["SENT", "FAILED", "SKIPPED", "THROTTLED"]).optional(),
      limit: z.number().optional(),
    }))
    .query(({ input }) => notifDb.listDeliveryLogs(input)),

  createDeliveryLog: protectedProcedure
    .input(z.object({
      channel: z.enum(["SMS", "EMAIL"]),
      provider: z.string(),
      eventType: z.string(),
      ruleId: z.string().optional(),
      templateId: z.string().optional(),
      recipient: z.string(),
      status: z.enum(["SENT", "FAILED", "SKIPPED", "THROTTLED"]),
      errorMessage: z.string().optional(),
      traceId: z.string().optional(),
      metadata: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(({ input }) => notifDb.createDeliveryLog(input)),
});
