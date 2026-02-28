import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks (vi.mock is hoisted, so variables must be created via vi.hoisted) ───

const {
  listDriveRunsCursor,
  getDriveRunByUid,
  createDriveRun,
  updateDriveRun,
  deleteDriveRun,
  bulkInsertLocationSamples,
  getLocationSamplesByRun,
  listDriveRunEventsCursor,
  createDriveRunEvent,
  getDb,
  writeAuditLog,
  storagePut,
} = vi.hoisted(() => ({
  listDriveRunsCursor: vi.fn(),
  getDriveRunByUid: vi.fn(),
  createDriveRun: vi.fn(),
  updateDriveRun: vi.fn(),
  deleteDriveRun: vi.fn(),
  bulkInsertLocationSamples: vi.fn(),
  getLocationSamplesByRun: vi.fn(),
  listDriveRunEventsCursor: vi.fn(),
  createDriveRunEvent: vi.fn(),
  getDb: vi.fn(),
  writeAuditLog: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("./db", () => ({
  listDriveRunsCursor,
  getDriveRunByUid,
  createDriveRun,
  updateDriveRun,
  deleteDriveRun,
  bulkInsertLocationSamples,
  getLocationSamplesByRun,
  listDriveRunEventsCursor,
  createDriveRunEvent,
  getDb,
}));

vi.mock("./lib/auditLog", () => ({ writeAuditLog }));
vi.mock("../drizzle/schema", () => ({ artifacts: {} }));
vi.mock("./storage", () => ({ storagePut }));

// ─── Import router ──────────────────────────────────────────────────────────

import {
  driveRunsRouter,
  driveTelemetryRouter,
  driveRunEventsRouter,
  driveUploadsRouter,
} from "./routers/driveRuns";

// ─── Test data ──────────────────────────────────────────────────────────────

const mockRun = {
  id: 1, uid: "run-test-uid-001", orgId: "org-1", projectUid: "proj-1",
  campaignUid: null, routeUid: null, deviceUid: null, probeUid: null,
  status: "DRAFT", startedAt: null, endedAt: null, createdBy: "user-1",
  metaJson: null, createdAt: new Date(), updatedAt: new Date(),
};

const mockGpsSample = {
  id: 1, uid: "gps-001", orgId: "org-1", runUid: "run-test-uid-001",
  lat: 48.8566, lon: 2.3522, altitudeM: 35, speedMps: 1.5,
  headingDeg: 90, accuracyM: 5, source: "GPS",
  sampledAt: new Date(), createdAt: new Date(),
};

const mockEvent = {
  id: 1, uid: "evt-001", orgId: "org-1", runUid: "run-test-uid-001",
  ts: new Date(), type: "NOTE", severity: "INFO", message: "Test note",
  dataJson: null, createdAt: new Date(),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function createCaller(router: any, user = { openId: "user-1", role: "admin", full_name: "Test User" }) {
  return router.createCaller({
    user,
    req: {} as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  });
}

function resetMocks() {
  vi.clearAllMocks();
  listDriveRunsCursor.mockResolvedValue({ items: [{ ...mockRun }], nextCursor: null });
  getDriveRunByUid.mockResolvedValue({ ...mockRun });
  createDriveRun.mockResolvedValue({ insertId: 1 });
  updateDriveRun.mockResolvedValue(undefined);
  deleteDriveRun.mockResolvedValue(undefined);
  bulkInsertLocationSamples.mockResolvedValue(undefined);
  getLocationSamplesByRun.mockResolvedValue([{ ...mockGpsSample }]);
  listDriveRunEventsCursor.mockResolvedValue({ items: [{ ...mockEvent }], nextCursor: null });
  createDriveRunEvent.mockResolvedValue({ insertId: 1 });
  getDb.mockResolvedValue(null);
  writeAuditLog.mockResolvedValue(undefined);
  storagePut.mockResolvedValue({ url: "https://s3.example.com/test-file.pcap", key: "test-key" });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("driveRunsRouter", () => {
  beforeEach(() => resetMocks());

  it("list — returns runs for an org", async () => {
    const caller = createCaller(driveRunsRouter);
    const result = await caller.list({ orgId: "org-1", limit: 50 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].uid).toBe("run-test-uid-001");
    expect(listDriveRunsCursor).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-1" }));
  });

  it("list — passes search parameter to DB", async () => {
    const caller = createCaller(driveRunsRouter);
    await caller.list({ orgId: "org-1", search: "Abidjan", limit: 50 });
    expect(listDriveRunsCursor).toHaveBeenCalledWith(expect.objectContaining({ search: "Abidjan" }));
  });

  it("list — trims search and ignores empty string", async () => {
    const caller = createCaller(driveRunsRouter);
    await caller.list({ orgId: "org-1", search: "   ", limit: 50 });
    expect(listDriveRunsCursor).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }));
  });

  it("list — combines search with status filter", async () => {
    const caller = createCaller(driveRunsRouter);
    await caller.list({ orgId: "org-1", search: "test", status: "COMPLETED", limit: 50 });
    expect(listDriveRunsCursor).toHaveBeenCalledWith(expect.objectContaining({ search: "test", status: "COMPLETED" }));
  });

  it("get — returns a single run by uid", async () => {
    const caller = createCaller(driveRunsRouter);
    const result = await caller.get({ runUid: "run-test-uid-001" });
    expect(result.uid).toBe("run-test-uid-001");
  });

  it("get — throws NOT_FOUND for unknown uid", async () => {
    getDriveRunByUid.mockResolvedValueOnce(undefined);
    const caller = createCaller(driveRunsRouter);
    await expect(caller.get({ runUid: "nonexistent" })).rejects.toThrow();
  });

  it("create — creates a new run", async () => {
    const caller = createCaller(driveRunsRouter);
    const result = await caller.create({ orgId: "org-1", projectUid: "proj-1" });
    expect(result.success).toBe(true);
    expect(result.runUid).toBeDefined();
    expect(createDriveRun).toHaveBeenCalled();
  });

  it("start — transitions DRAFT to RUNNING", async () => {
    const caller = createCaller(driveRunsRouter);
    const result = await caller.start({ runUid: "run-test-uid-001" });
    expect(result.success).toBe(true);
    expect(updateDriveRun).toHaveBeenCalledWith("run-test-uid-001", expect.objectContaining({ status: "RUNNING" }));
  });

  it("start — rejects if run not found", async () => {
    getDriveRunByUid.mockResolvedValueOnce(undefined);
    const caller = createCaller(driveRunsRouter);
    await expect(caller.start({ runUid: "nonexistent" })).rejects.toThrow();
  });

  it("start — rejects if run is not DRAFT", async () => {
    getDriveRunByUid.mockResolvedValueOnce({ ...mockRun, status: "COMPLETED" });
    const caller = createCaller(driveRunsRouter);
    await expect(caller.start({ runUid: "run-test-uid-001" })).rejects.toThrow();
  });

  it("stop — transitions RUNNING to COMPLETED", async () => {
    getDriveRunByUid.mockResolvedValueOnce({ ...mockRun, status: "RUNNING" });
    const caller = createCaller(driveRunsRouter);
    const result = await caller.stop({ runUid: "run-test-uid-001", finalStatus: "COMPLETED" });
    expect(result.success).toBe(true);
    expect(updateDriveRun).toHaveBeenCalledWith("run-test-uid-001", expect.objectContaining({ status: "COMPLETED" }));
  });

  it("stop — rejects if run is not RUNNING/UPLOADING", async () => {
    const caller = createCaller(driveRunsRouter);
    await expect(caller.stop({ runUid: "run-test-uid-001", finalStatus: "COMPLETED" })).rejects.toThrow();
  });

  it("delete — removes a run", async () => {
    const caller = createCaller(driveRunsRouter);
    const result = await caller.delete({ runUid: "run-test-uid-001" });
    expect(result.success).toBe(true);
    // delete uses inline DB queries, not deleteDriveRun helper
  });

  it("delete — rejects if run not found", async () => {
    getDriveRunByUid.mockResolvedValueOnce(undefined);
    const caller = createCaller(driveRunsRouter);
    await expect(caller.delete({ runUid: "nonexistent" })).rejects.toThrow();
  });

  it("create — accepts a name field", async () => {
    const caller = createCaller(driveRunsRouter);
    const result = await caller.create({ orgId: "org-1", projectUid: "proj-1", name: "Drive Abidjan Nord" });
    expect(result.success).toBe(true);
    expect(createDriveRun).toHaveBeenCalledWith(expect.objectContaining({ name: "Drive Abidjan Nord" }));
  });

  it("create — trims whitespace from name", async () => {
    const caller = createCaller(driveRunsRouter);
    await caller.create({ orgId: "org-1", projectUid: "proj-1", name: "  Test Run  " });
    expect(createDriveRun).toHaveBeenCalledWith(expect.objectContaining({ name: "Test Run" }));
  });

  it("create — sets name to null when empty string", async () => {
    const caller = createCaller(driveRunsRouter);
    await caller.create({ orgId: "org-1", projectUid: "proj-1", name: "   " });
    expect(createDriveRun).toHaveBeenCalledWith(expect.objectContaining({ name: null }));
  });

  it("create — works without name (optional)", async () => {
    const caller = createCaller(driveRunsRouter);
    const result = await caller.create({ orgId: "org-1", projectUid: "proj-1" });
    expect(result.success).toBe(true);
    expect(createDriveRun).toHaveBeenCalledWith(expect.objectContaining({ name: null }));
  });

  it("rename — renames a run", async () => {
    const caller = createCaller(driveRunsRouter);
    const result = await caller.rename({ runUid: "run-test-uid-001", name: "Nouveau Nom" });
    expect(result.success).toBe(true);
    expect(updateDriveRun).toHaveBeenCalledWith("run-test-uid-001", { name: "Nouveau Nom" });
  });

  it("rename — rejects if run not found", async () => {
    getDriveRunByUid.mockResolvedValueOnce(undefined);
    const caller = createCaller(driveRunsRouter);
    await expect(caller.rename({ runUid: "nonexistent", name: "Test" })).rejects.toThrow();
  });

  it("rename — sets name to null when empty string", async () => {
    const caller = createCaller(driveRunsRouter);
    await caller.rename({ runUid: "run-test-uid-001", name: "   " });
    expect(updateDriveRun).toHaveBeenCalledWith("run-test-uid-001", { name: null });
  });
});

describe("driveTelemetryRouter", () => {
  beforeEach(() => resetMocks());

  it("pushSamples — pushes GPS samples", async () => {
    const caller = createCaller(driveTelemetryRouter);
    const result = await caller.pushSamples({
      orgId: "org-1",
      runUid: "run-test-uid-001",
      samples: [{ ts: new Date().toISOString(), lat: 48.8566, lon: 2.3522 }],
    });
    expect(result.success).toBe(true);
    expect(result.inserted).toBe(1);
    expect(bulkInsertLocationSamples).toHaveBeenCalled();
  });

  it("pushSamples — rejects if run not found", async () => {
    getDriveRunByUid.mockResolvedValueOnce(undefined);
    const caller = createCaller(driveTelemetryRouter);
    await expect(
      caller.pushSamples({
        orgId: "org-1",
        runUid: "nonexistent",
        samples: [{ ts: new Date().toISOString(), lat: 48.8, lon: 2.3 }],
      })
    ).rejects.toThrow();
  });

  it("getTrack — returns GPS track for a run", async () => {
    const caller = createCaller(driveTelemetryRouter);
    const result = await caller.getTrack({ runUid: "run-test-uid-001", orgId: "org-1" });
    expect(result).toHaveLength(1);
    expect(result[0].lat).toBe(48.8566);
    expect(getLocationSamplesByRun).toHaveBeenCalledWith("run-test-uid-001", "org-1");
  });
});

describe("driveRunEventsRouter", () => {
  beforeEach(() => resetMocks());

  it("list — returns events for a run", async () => {
    const caller = createCaller(driveRunEventsRouter);
    const result = await caller.list({ orgId: "org-1", runUid: "run-test-uid-001", limit: 50 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe("NOTE");
  });

  it("create — creates a new event", async () => {
    getDriveRunByUid.mockResolvedValueOnce({ ...mockRun, status: "RUNNING" });
    const caller = createCaller(driveRunEventsRouter);
    const result = await caller.create({
      orgId: "org-1",
      runUid: "run-test-uid-001",
      ts: new Date().toISOString(),
      type: "NOTE",
      message: "Test event",
    });
    expect(result.success).toBe(true);
    expect(result.eventUid).toBeDefined();
    expect(createDriveRunEvent).toHaveBeenCalled();
  });

  it("create — rejects if run not found", async () => {
    getDriveRunByUid.mockResolvedValueOnce(undefined);
    const caller = createCaller(driveRunEventsRouter);
    await expect(
      caller.create({
        orgId: "org-1",
        runUid: "nonexistent",
        ts: new Date().toISOString(),
        type: "NOTE",
      })
    ).rejects.toThrow();
  });
});

describe("driveUploadsRouter", () => {
  beforeEach(() => resetMocks());

  it("uploadFile — uploads a file to S3", async () => {
    const caller = createCaller(driveUploadsRouter);
    const result = await caller.uploadFile({
      runUid: "run-test-uid-001",
      orgId: "org-1",
      projectUid: "proj-1",
      filename: "test.pcap",
      base64: Buffer.from("test content").toString("base64"),
      fileType: "PCAP",
    });
    expect(result.success).toBe(true);
    expect(result.url).toBeDefined();
  });

  it("uploadFile — rejects if run not found", async () => {
    getDriveRunByUid.mockResolvedValueOnce(undefined);
    const caller = createCaller(driveUploadsRouter);
    await expect(
      caller.uploadFile({
        runUid: "nonexistent",
        orgId: "org-1",
        projectUid: "proj-1",
        filename: "test.pcap",
        base64: Buffer.from("test").toString("base64"),
      })
    ).rejects.toThrow();
  });

  it("uploadFile — rejects files over 50MB", async () => {
    const caller = createCaller(driveUploadsRouter);
    const largeBase64 = Buffer.alloc(51 * 1024 * 1024).toString("base64");
    await expect(
      caller.uploadFile({
        runUid: "run-test-uid-001",
        orgId: "org-1",
        projectUid: "proj-1",
        filename: "huge.pcap",
        base64: largeBase64,
      })
    ).rejects.toThrow();
  });

  it("listFiles — returns files for a run", async () => {
    const caller = createCaller(driveUploadsRouter);
    const result = await caller.listFiles({ runUid: "run-test-uid-001" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("driveRuns — structural checks", () => {
  it("driveRunsRouter has expected endpoints", () => {
    const procedures = Object.keys((driveRunsRouter as any)._def.procedures ?? (driveRunsRouter as any)._def.record ?? {});
    expect(procedures).toContain("list");
    expect(procedures).toContain("get");
    expect(procedures).toContain("create");
    expect(procedures).toContain("start");
    expect(procedures).toContain("stop");
    expect(procedures).toContain("rename");
    expect(procedures).toContain("delete");
  });

  it("driveTelemetryRouter has expected endpoints", () => {
    const procedures = Object.keys((driveTelemetryRouter as any)._def.procedures ?? (driveTelemetryRouter as any)._def.record ?? {});
    expect(procedures).toContain("pushSamples");
    expect(procedures).toContain("getTrack");
  });

  it("driveRunEventsRouter has expected endpoints", () => {
    const procedures = Object.keys((driveRunEventsRouter as any)._def.procedures ?? (driveRunEventsRouter as any)._def.record ?? {});
    expect(procedures).toContain("list");
    expect(procedures).toContain("create");
  });

  it("driveUploadsRouter has expected endpoints", () => {
    const procedures = Object.keys((driveUploadsRouter as any)._def.procedures ?? (driveUploadsRouter as any)._def.record ?? {});
    expect(procedures).toContain("uploadFile");
    expect(procedures).toContain("listFiles");
  });
});
