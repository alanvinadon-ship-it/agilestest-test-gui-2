import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { notificationsRouter } from "./routers/notifications";
import { adminRouter } from "./routers/admin";
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
  }),

  notifications: notificationsRouter,

  // Admin (users, invites, audit logs)
  admin: adminRouter,

  // Projects CRUD
  projects: projectsRouter,

  // Testing domain
  profiles: profilesRouter,
  scenarios: scenariosRouter,
  datasets: datasetsRouter,
  executions: executionsRouter,
  captures: capturesRouter,
  probes: probesRouter,
  scripts: scriptsRouter,
});

export type AppRouter = typeof appRouter;
