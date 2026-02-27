import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-drive-user",
    email: "drive@test.com",
    name: "Drive Tester",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

let testCampaignId: string;
let testRouteId: string;
let testDeviceId: string;
let testJobId: string;

const caller = appRouter.createCaller(createAuthContext());

// ─── Setup: create a campaign ──────────────────────────────────────────────

describe("driveEntities setup", () => {
  it("creates a test campaign for sub-entity tests", async () => {
    const result = await caller.driveCampaigns.create({
      projectId: "test-project-drive-entities",
      name: "Test Campaign for Drive Entities",
      targetEnv: "DEV",
      networkType: "4G",
    });
    expect(result.success).toBe(true);
    expect(result.campaignId).toBeTruthy();
    testCampaignId = result.campaignId;
  });
});

// ─── Drive Routes ──────────────────────────────────────────────────────────

describe("driveRoutes", () => {
  it("creates a route", async () => {
    const result = await caller.driveRoutes.create({
      campaignId: testCampaignId,
      name: "Route Abidjan Centre",
      expectedDurationMin: 45,
      routeGeojson: { type: "LineString", coordinates: [[-3.99, 5.32], [-3.98, 5.34]] },
    });
    expect(result.success).toBe(true);
    expect(result.routeId).toBeTruthy();
    testRouteId = result.routeId;
  });

  it("lists routes for the campaign", async () => {
    const result = await caller.driveRoutes.list({
      campaignId: testCampaignId,
      limit: 50,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    const found = result.items.find((r) => r.uid === testRouteId);
    expect(found).toBeTruthy();
    expect(found!.name).toBe("Route Abidjan Centre");
  });

  it("gets a route by ID", async () => {
    const route = await caller.driveRoutes.get({ routeId: testRouteId });
    expect(route.uid).toBe(testRouteId);
    expect(route.name).toBe("Route Abidjan Centre");
    expect(route.expectedDurationMin).toBe(45);
  });

  it("updates a route", async () => {
    const result = await caller.driveRoutes.update({
      routeId: testRouteId,
      name: "Route Abidjan Centre v2",
      expectedDurationMin: 60,
    });
    expect(result.success).toBe(true);

    const updated = await caller.driveRoutes.get({ routeId: testRouteId });
    expect(updated.name).toBe("Route Abidjan Centre v2");
    expect(updated.expectedDurationMin).toBe(60);
  });

  it("returns empty list for unknown campaign", async () => {
    const result = await caller.driveRoutes.list({
      campaignId: "nonexistent-campaign-id",
      limit: 50,
    });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── Drive Devices ─────────────────────────────────────────────────────────

describe("driveDevices", () => {
  it("creates a device", async () => {
    const result = await caller.driveDevices.create({
      campaignId: testCampaignId,
      name: "Galaxy S24 Test",
      deviceType: "ANDROID",
      model: "Samsung Galaxy S24",
      osVersion: "Android 15",
      diagCapable: true,
      toolsEnabled: ["GNetTrack", "iperf3"],
    });
    expect(result.success).toBe(true);
    expect(result.deviceId).toBeTruthy();
    testDeviceId = result.deviceId;
  });

  it("lists devices for the campaign", async () => {
    const result = await caller.driveDevices.list({
      campaignId: testCampaignId,
      limit: 50,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    const found = result.items.find((d) => d.uid === testDeviceId);
    expect(found).toBeTruthy();
    expect(found!.model).toBe("Samsung Galaxy S24");
  });

  it("gets a device by ID", async () => {
    const device = await caller.driveDevices.get({ deviceId: testDeviceId });
    expect(device.uid).toBe(testDeviceId);
    expect(device.deviceType).toBe("ANDROID");
  });

  it("updates a device", async () => {
    const result = await caller.driveDevices.update({
      deviceId: testDeviceId,
      model: "Samsung Galaxy S24 Ultra",
      notes: "Upgraded model",
    });
    expect(result.success).toBe(true);

    const updated = await caller.driveDevices.get({ deviceId: testDeviceId });
    expect(updated.model).toBe("Samsung Galaxy S24 Ultra");
    expect(updated.notes).toBe("Upgraded model");
  });

  it("returns empty for unknown campaign", async () => {
    const result = await caller.driveDevices.list({
      campaignId: "nonexistent",
      limit: 50,
    });
    expect(result.items).toHaveLength(0);
  });
});

// ─── Drive Jobs ────────────────────────────────────────────────────────────

describe("driveJobs", () => {
  it("creates a job", async () => {
    const result = await caller.driveJobs.create({
      campaignId: testCampaignId,
      routeId: testRouteId,
      deviceId: testDeviceId,
    });
    expect(result.success).toBe(true);
    expect(result.jobId).toBeTruthy();
    testJobId = result.jobId;
  });

  it("lists jobs for the campaign", async () => {
    const result = await caller.driveJobs.list({
      campaignId: testCampaignId,
      limit: 50,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    const found = result.items.find((j) => j.uid === testJobId);
    expect(found).toBeTruthy();
    expect(found!.status).toBe("PENDING");
  });

  it("gets a job by ID", async () => {
    const job = await caller.driveJobs.get({ jobId: testJobId });
    expect(job.uid).toBe(testJobId);
    expect(job.status).toBe("PENDING");
  });

  it("updates job status to RUNNING", async () => {
    const result = await caller.driveJobs.updateStatus({
      jobId: testJobId,
      status: "RUNNING",
      progressPct: 25,
    });
    expect(result.success).toBe(true);

    const updated = await caller.driveJobs.get({ jobId: testJobId });
    expect(updated.status).toBe("RUNNING");
    expect(updated.progressPct).toBe(25);
    expect(updated.startedAt).toBeTruthy();
  });

  it("updates job status to DONE", async () => {
    const result = await caller.driveJobs.updateStatus({
      jobId: testJobId,
      status: "DONE",
      progressPct: 100,
    });
    expect(result.success).toBe(true);

    const updated = await caller.driveJobs.get({ jobId: testJobId });
    expect(updated.status).toBe("DONE");
    expect(updated.progressPct).toBe(100);
    expect(updated.finishedAt).toBeTruthy();
  });

  it("filters jobs by status", async () => {
    const result = await caller.driveJobs.list({
      campaignId: testCampaignId,
      status: "DONE",
      limit: 50,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items.every((j) => j.status === "DONE")).toBe(true);
  });
});

// ─── Cleanup ───────────────────────────────────────────────────────────────

describe("driveEntities cleanup", () => {
  it("deletes the test job", async () => {
    const result = await caller.driveJobs.delete({ jobId: testJobId });
    expect(result.success).toBe(true);
  });

  it("deletes the test device", async () => {
    const result = await caller.driveDevices.delete({ deviceId: testDeviceId });
    expect(result.success).toBe(true);
  });

  it("deletes the test route", async () => {
    const result = await caller.driveRoutes.delete({ routeId: testRouteId });
    expect(result.success).toBe(true);
  });

  it("deletes the test campaign", async () => {
    const result = await caller.driveCampaigns.delete({ campaignId: testCampaignId });
    expect(result.success).toBe(true);
  });
});
