import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

// Feature routers
import { notificationsRouter } from "./routers/notifications";
import { projectsRouter } from "./routers/projects";
import { profilesRouter } from "./routers/profiles";
import { scenariosRouter } from "./routers/scenarios";
import { datasetsRouter } from "./routers/datasets";
import { executionsRouter } from "./routers/executions";
import { capturesRouter } from "./routers/captures";
import { probesRouter } from "./routers/probes";
import { drivetestRouter } from "./routers/drivetest";
import { adminRouter } from "./routers/admin";
import { notifSettingsRouter } from "./routers/notifSettings";

export const appRouter = router({
  // System
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Core modules
  projects: projectsRouter,
  profiles: profilesRouter,
  scenarios: scenariosRouter,
  datasets: datasetsRouter,
  executions: executionsRouter,

  // Captures & Probes
  captures: capturesRouter,
  probes: probesRouter,

  // Drive Test
  drivetest: drivetestRouter,

  // Admin (RBAC, Invites, Audit)
  admin: adminRouter,

  // Notifications (SMTP email, settings, templates, rules, delivery)
  notifications: notificationsRouter,
  notifSettings: notifSettingsRouter,
});

export type AppRouter = typeof appRouter;
