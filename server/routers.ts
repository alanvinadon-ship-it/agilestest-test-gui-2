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
} from "./routers/bundles";
import { driveCampaignsRouter } from "./routers/driveCampaigns";
import {
  driveRoutesRouter,
  driveDevicesRouter,
  driveProbeLinksRouter,
  driveJobsRouter,
} from "./routers/driveEntities";

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

  // Drive campaigns
  driveCampaigns: driveCampaignsRouter,

  // Drive sub-entities (routes, devices, probe links, jobs)
  driveRoutes: driveRoutesRouter,
  driveDevices: driveDevicesRouter,
  driveProbeLinks: driveProbeLinksRouter,
  driveJobs: driveJobsRouter,
});

export type AppRouter = typeof appRouter;
