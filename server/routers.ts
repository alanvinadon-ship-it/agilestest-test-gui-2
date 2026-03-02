import { z } from "zod";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, ONE_YEAR_MS, PASSWORD_RESET_TOKEN_EXPIRY_MS, PASSWORD_RESET_TOKEN_LENGTH } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { writeAuditLog } from "./lib/auditLog";
import { sendEmail } from "./emailService";
import type { SmtpConfig } from "./emailService";

const SmtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.enum(['NONE', 'STARTTLS', 'TLS']),
  username: z.string().min(1),
  password: z.string().min(1),
  from_email: z.string().email(),
  from_name: z.string().default('AgilesTest'),
  reply_to: z.string().optional(),
  timeout_ms: z.number().int().min(1000).max(60000).default(15000),
});

function buildSmtpConfig(input: z.infer<typeof SmtpConfigSchema>): SmtpConfig {
  return {
    host: input.host,
    port: input.port,
    secure: input.secure,
    username: input.username,
    password: input.password,
    from_email: input.from_email,
    from_name: input.from_name,
    reply_to: input.reply_to,
    timeout_ms: input.timeout_ms,
  };
}

function buildPasswordResetEmailHtml(params: { resetLink: string; userName: string; expiresMinutes: number }): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a1a2e; color: #e0e0e0; padding: 30px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: #f97316; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 18px;">
            AgilesTest
          </div>
        </div>

        <h2 style="color: #f97316; margin-top: 0; text-align: center;">R\u00e9initialisation de mot de passe</h2>

        <p style="font-size: 15px; line-height: 1.6;">Bonjour <strong>${params.userName}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6;">
          Vous avez demand\u00e9 la r\u00e9initialisation de votre mot de passe sur AgilesTest.
          Cliquez sur le bouton ci-dessous pour d\u00e9finir un nouveau mot de passe :
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.resetLink}"
             style="display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
            R\u00e9initialiser mon mot de passe
          </a>
        </div>

        <p style="font-size: 13px; color: #999; text-align: center;">
          Ce lien expire dans <strong>${params.expiresMinutes} minutes</strong>.<br>
          Si vous n'avez pas demand\u00e9 cette r\u00e9initialisation, ignorez cet email.
        </p>

        <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;" />

        <p style="font-size: 11px; color: #555; text-align: center; margin-bottom: 0;">
          Cet email a \u00e9t\u00e9 envoy\u00e9 automatiquement par AgilesTest.
        </p>
      </div>
    </div>
  `;
}
import { notificationsRouter } from "./routers/notifications";
import { adminRouter, invitePublicRouter } from "./routers/admin";
import { projectsRouter } from "./routers/projects";
import {
  profilesRouter,
  scenariosRouter,
  datasetsRouter,
  executionsRouter,
  capturesRouter,
  probesRouter,
  scriptsRouter,
} from "./routers/testing";
import { uiRouter } from "./routers/ui";
import { artifactsRouter } from "./routers/artifacts";
import { jobsRouter } from "./routers/jobs";
import { reportsRouter } from "./routers/reports";
import { analyticsRouter } from "./routers/analytics";
import { webhooksRouter } from "./routers/webhooks";
import {
  bundlesRouter,
  bundleItemsRouter,
  datasetInstancesRouter,
  datasetTypesRouter,
  datasetSecretsRouter,
} from "./routers/bundles";
import { driveCampaignsRouter } from "./routers/driveCampaigns";
import {
  driveRoutesRouter,
  driveDevicesRouter,
  driveProbeLinksRouter,
  driveJobsRouter,
} from "./routers/driveEntities";
import { capturePoliciesRouter } from "./routers/capturePolicies";
import { kpiSamplesRouter, driveRunSummariesRouter } from "./routers/kpiData";
import { collectorRouter } from "./routers/collector";
import { aiGenerationRouter } from "./routers/aiGeneration";
import { scenarioTemplatesRouter } from "./routers/scenarioTemplates";
import { driveRunsRouter, driveTelemetryRouter, driveRunEventsRouter, driveUploadsRouter } from "./routers/driveRuns";
import { driveAiRouter } from "./routers/driveAi";
import { aiSettingsRouter } from "./routers/aiSettings";
import { aiEnginesRouter } from "./routers/aiEngines";
import { aiRoutingRouter } from "./routers/aiRouting";
import { keycloakRouter } from "./routers/keycloak";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    /** Login with email + password (for invited users who accepted their invitation) */
    loginWithPassword: publicProcedure
      .input(
        z.object({
          email: z.string().email("Adresse email invalide"),
          password: z.string().min(1, "Le mot de passe est requis"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // 1. Find user by email
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Identifiants invalides.",
          });
        }

        // 2. Check that user has a password hash (set during invite acceptance)
        if (!user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Ce compte utilise la connexion OAuth. Veuillez vous connecter via le bouton Manus.",
          });
        }

        // 3. Check account status
        if (user.status === "DISABLED") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Ce compte a été désactivé. Contactez un administrateur.",
          });
        }

        // 4. Verify password with bcrypt
        const isValid = await bcrypt.compare(input.password, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Identifiants invalides.",
          });
        }

        // 5. Create session token (same as OAuth flow)
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.fullName ?? user.name ?? "",
          expiresInMs: ONE_YEAR_MS,
        });

        // 6. Set session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        // 7. Update last signed in
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        // 8. Audit log
        await writeAuditLog({
          userId: user.id,
          action: "LOGIN_PASSWORD",
          entity: "user",
          entityId: String(user.id),
          details: { email: input.email, method: "password" },
        });

        return {
          success: true,
          user: {
            id: user.id,
            name: user.fullName ?? user.name,
            email: user.email,
            role: user.role,
          },
        };
      }),

    /** Request a password reset link by email */
    requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email("Adresse email invalide"),
        origin: z.string().url("Origine invalide"),
        smtp: SmtpConfigSchema,
      })
    )
    .mutation(async ({ input }) => {
      // Always return success to prevent email enumeration
      const user = await db.getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        // Silently succeed — don't reveal whether the email exists
        return { success: true, message: "Si cette adresse est enregistrée, un email de réinitialisation a été envoyé." };
      }

      if (user.status === "DISABLED") {
        return { success: true, message: "Si cette adresse est enregistrée, un email de réinitialisation a été envoyé." };
      }

      // Generate secure token
      const token = crypto.randomBytes(PASSWORD_RESET_TOKEN_LENGTH).toString("hex");
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MS);

      await db.createPasswordResetToken({
        userId: user.id,
        email: user.email!,
        token,
        expiresAt,
      });

      // Build reset link
      const resetLink = `${input.origin}/reset-password?token=${token}`;
      const expiresMinutes = Math.round(PASSWORD_RESET_TOKEN_EXPIRY_MS / 60000);

      // Send email
      const smtpConfig = buildSmtpConfig(input.smtp);
      const html = buildPasswordResetEmailHtml({
        resetLink,
        userName: user.fullName ?? user.name ?? user.email ?? "Utilisateur",
        expiresMinutes,
      });

      try {
        await sendEmail(smtpConfig, {
          to: user.email!,
          subject: "[AgilesTest] Réinitialisation de votre mot de passe",
          html,
        });
      } catch (err) {
        console.error("[PasswordReset] Failed to send email:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'envoi de l'email. Vérifiez la configuration SMTP.",
        });
      }

      // Audit log
      await writeAuditLog({
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        entity: "user",
        entityId: String(user.id),
        details: { email: user.email },
      });

      return { success: true, message: "Si cette adresse est enregistrée, un email de réinitialisation a été envoyé." };
    }),

  /** Verify a password reset token is valid */
  verifyResetToken: publicProcedure
    .input(z.object({ token: z.string().min(1, "Token requis") }))
    .query(async ({ input }) => {
      const resetToken = await db.getValidResetToken(input.token);
      if (!resetToken) {
        return { valid: false, email: null };
      }
      return { valid: true, email: resetToken.email };
    }),

  /** Reset password using a valid token */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token requis"),
        newPassword: z
          .string()
          .min(8, "Le mot de passe doit contenir au moins 8 caractères")
          .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre"
          ),
      })
    )
    .mutation(async ({ input }) => {
      const resetToken = await db.getValidResetToken(input.token);
      if (!resetToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce lien de réinitialisation est invalide ou a expiré.",
        });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(input.newPassword, 12);

      // Update user password
      await db.updateUserPassword(resetToken.userId, passwordHash);

      // Mark token as used
      await db.markResetTokenUsed(input.token);

      // Audit log
      await writeAuditLog({
        userId: resetToken.userId,
        action: "PASSWORD_RESET_COMPLETED",
        entity: "user",
        entityId: String(resetToken.userId),
        details: { email: resetToken.email },
      });

      return { success: true, message: "Votre mot de passe a été réinitialisé avec succès." };
    }),

    /** Change password for the currently authenticated user (requires old password) */
    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1, "Le mot de passe actuel est requis"),
          newPassword: z
            .string()
            .min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères")
            .regex(
              /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
              "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre"
            ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = ctx.user;

        // 1. Check that user has a password (invite-based account)
        if (!user.passwordHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ce compte utilise la connexion OAuth et ne dispose pas de mot de passe à modifier.",
          });
        }

        // 2. Verify current password
        const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Le mot de passe actuel est incorrect.",
          });
        }

        // 3. Prevent setting the same password
        const isSame = await bcrypt.compare(input.newPassword, user.passwordHash);
        if (isSame) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Le nouveau mot de passe doit être différent de l'ancien.",
          });
        }

        // 4. Hash and update
        const newHash = await bcrypt.hash(input.newPassword, 12);
        await db.updateUserPassword(user.id, newHash);

        // 5. Audit log
        await writeAuditLog({
          userId: user.id,
          action: "PASSWORD_CHANGED",
          entity: "user",
          entityId: String(user.id),
          details: { email: user.email, method: "self-service" },
        });

        return { success: true, message: "Votre mot de passe a été modifié avec succès." };
      }),

    /** Upload a profile avatar (base64 image → S3 → update DB) */
    uploadAvatar: protectedProcedure
      .input(
        z.object({
          /** Base64-encoded image data (without the data:... prefix) */
          imageBase64: z.string().min(1, "Image requise"),
          /** MIME type of the image */
          mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"], {
            error: "Format d'image non supporté. Utilisez JPEG, PNG, WebP ou GIF.",
          }),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = ctx.user;

        // 1. Decode base64 to buffer
        const buffer = Buffer.from(input.imageBase64, "base64");

        // 2. Validate file size (max 2 MB)
        const MAX_SIZE = 2 * 1024 * 1024;
        if (buffer.length > MAX_SIZE) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "L'image ne doit pas dépasser 2 Mo.",
          });
        }

        // 3. Validate minimum size (at least 100 bytes to avoid empty/corrupt files)
        if (buffer.length < 100) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Le fichier image semble invalide ou vide.",
          });
        }

        // 4. Upload to S3 with unique key
        const { storagePut } = await import("./storage");
        const ext = input.mimeType.split("/")[1] === "jpeg" ? "jpg" : input.mimeType.split("/")[1];
        const randomSuffix = crypto.randomBytes(8).toString("hex");
        const fileKey = `avatars/${user.id}-${randomSuffix}.${ext}`;

        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // 5. Update DB
        await db.updateUserAvatar(user.id, url);

        // 6. Audit log
        await writeAuditLog({
          userId: user.id,
          action: "AVATAR_UPLOADED",
          entity: "user",
          entityId: String(user.id),
          details: { fileKey, mimeType: input.mimeType, sizeBytes: buffer.length },
        });

        return { success: true, avatarUrl: url };
      }),

    /** Remove the current profile avatar */
    removeAvatar: protectedProcedure
      .mutation(async ({ ctx }) => {
        const user = ctx.user;

        if (!user.avatarUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Aucun avatar à supprimer.",
          });
        }

        // Update DB (set to null)
        await db.updateUserAvatar(user.id, null);

        // Audit log
        await writeAuditLog({
          userId: user.id,
          action: "AVATAR_REMOVED",
          entity: "user",
          entityId: String(user.id),
          details: { previousUrl: user.avatarUrl },
        });

        return { success: true };
      }),
  }),

  notifications: notificationsRouter,

  // Admin (users, invites, audit logs)
  admin: adminRouter,
  // Public invite verification & acceptance (no auth)
  invite: invitePublicRouter,

  // Projects CRUD
  projects: projectsRouter,

  // UI widgets (sidebar counts, etc.)
  ui: uiRouter,

  // Artifacts (S3/MinIO signed URLs)
  artifacts: artifactsRouter,

  // Jobs queue (async processing)
  jobs: jobsRouter,

  // Testing domain
  profiles: profilesRouter,
  scenarios: scenariosRouter,
  datasets: datasetsRouter,
  executions: executionsRouter,
  captures: capturesRouter,
  probes: probesRouter,
  scripts: scriptsRouter,
  reports: reportsRouter,
  analytics: analyticsRouter,
  webhooks: webhooksRouter,

  // Bundles & dataset instances
  bundles: bundlesRouter,
  bundleItems: bundleItemsRouter,
  datasetInstances: datasetInstancesRouter,
  datasetTypes: datasetTypesRouter,
  datasetSecrets: datasetSecretsRouter,

  // Drive campaigns
  driveCampaigns: driveCampaignsRouter,

  // Drive sub-entities (routes, devices, probe links, jobs)
  driveRoutes: driveRoutesRouter,
  driveDevices: driveDevicesRouter,
  driveProbeLinks: driveProbeLinksRouter,
  driveJobs: driveJobsRouter,

  // Capture policies
  capturePolicies: capturePoliciesRouter,

  // KPI data (samples + run summaries)
  kpiSamples: kpiSamplesRouter,
  driveRunSummaries: driveRunSummariesRouter,

  // Collector (active capture sessions)
  collector: collectorRouter,

  // AI Generation (LLM-powered script generation)
  aiGeneration: aiGenerationRouter,

  // Scenario Templates (pre-built library)
  scenarioTemplates: scenarioTemplatesRouter,

  // Drive Runs (mobile field test sessions)
  driveRuns: driveRunsRouter,
  driveTelemetry: driveTelemetryRouter,
  driveRunEvents: driveRunEventsRouter,
  driveUploads: driveUploadsRouter,
  driveAi: driveAiRouter,
  aiSettings: aiSettingsRouter,
  aiEngines: aiEnginesRouter,
  aiRouting: aiRoutingRouter,
  keycloak: keycloakRouter,

  // Branding (logo + favicon)
  branding: router({
    /** Public: get current branding settings (logo + favicon URLs) */
    get: publicProcedure.query(async () => {
      const settings = await db.getAppSettings(["branding_logo_url", "branding_favicon_url"]);
      return {
        logoUrl: settings["branding_logo_url"] ?? null,
        faviconUrl: settings["branding_favicon_url"] ?? null,
      };
    }),

    /** Admin: upload a new logo */
    uploadLogo: adminProcedure
      .input(
        z.object({
          base64: z.string().min(1, "Image data is required"),
          mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"], {
            message: "Format autorisé : PNG, JPEG, WebP ou SVG",
          }),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
        if (buffer.length > MAX_SIZE) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Le fichier ne doit pas dépasser 2 Mo." });
        }
        const ext = input.mimeType === "image/svg+xml" ? "svg" : input.mimeType.split("/")[1];
        const key = `branding/logo-${Date.now()}.${ext}`;
        const { storagePut } = await import("./storage");
        const { url } = await storagePut(key, buffer, input.mimeType);
        await db.setAppSetting("branding_logo_url", url, ctx.user.openId);
        await writeAuditLog({ userId: ctx.user.openId, action: "BRANDING_LOGO_UPDATED", entity: "BRANDING", details: { url } });
        return { logoUrl: url };
      }),

    /** Admin: remove the logo (revert to default) */
    removeLogo: adminProcedure.mutation(async ({ ctx }) => {
      await db.setAppSetting("branding_logo_url", null, ctx.user.openId);
      await writeAuditLog({ userId: ctx.user.openId, action: "BRANDING_LOGO_REMOVED", entity: "BRANDING" });
      return { success: true };
    }),

    /** Admin: upload a new favicon */
    uploadFavicon: adminProcedure
      .input(
        z.object({
          base64: z.string().min(1, "Image data is required"),
          mimeType: z.enum(["image/png", "image/x-icon", "image/svg+xml", "image/ico", "image/vnd.microsoft.icon"], {
            message: "Format autorisé : PNG, ICO ou SVG",
          }),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const MAX_SIZE = 512 * 1024; // 512 KB
        if (buffer.length > MAX_SIZE) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Le favicon ne doit pas dépasser 512 Ko." });
        }
        const ext = input.mimeType.includes("svg") ? "svg" : input.mimeType.includes("png") ? "png" : "ico";
        const key = `branding/favicon-${Date.now()}.${ext}`;
        const { storagePut } = await import("./storage");
        const { url } = await storagePut(key, buffer, input.mimeType);
        await db.setAppSetting("branding_favicon_url", url, ctx.user.openId);
        await writeAuditLog({ userId: ctx.user.openId, action: "BRANDING_FAVICON_UPDATED", entity: "BRANDING", details: { url } });
        return { faviconUrl: url };
      }),

    /** Admin: remove the favicon (revert to default) */
    removeFavicon: adminProcedure.mutation(async ({ ctx }) => {
      await db.setAppSetting("branding_favicon_url", null, ctx.user.openId);
      await writeAuditLog({ userId: ctx.user.openId, action: "BRANDING_FAVICON_REMOVED", entity: "BRANDING" });
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
