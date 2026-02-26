import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import { probes, probePolicies, capturePolicies } from "../../drizzle/schema";
import { v4 as uuid } from "uuid";

// ── Probes ──
export async function listProbes(site?: string) {
  const db = await getDb();
  if (!db) return [];
  if (site) {
    return db.select().from(probes).where(eq(probes.site, site)).orderBy(desc(probes.createdAt));
  }
  return db.select().from(probes).orderBy(desc(probes.createdAt));
}

export async function getProbeByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(probes).where(eq(probes.uid, uid)).limit(1);
  return rows[0];
}

export async function createProbe(data: {
  site: string;
  zone: string;
  type: "LINUX_EDGE" | "K8S_CLUSTER" | "NETWORK_TAP";
  status?: "ONLINE" | "OFFLINE" | "DEGRADED";
  capabilities?: string[];
  authTokenHash?: string;
  metadata?: Record<string, unknown>;
  version?: string;
  interfaces?: string[];
  heartbeatIntervalSec?: number;
  allowlistCidrs?: string[];
  tlsEnabled?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(probes).values({ uid, ...data });
  return getProbeByUid(uid);
}

export async function updateProbe(uid: string, data: Partial<{
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  capabilities: string[];
  metadata: Record<string, unknown>;
  version: string;
  lastSeenAt: Date;
  uptimeSeconds: number;
  cpuPercent: number;
  diskFreeMb: number;
  interfaces: string[];
  activeSessions: number;
  totalCaptures: number;
  lastError: string;
  healthStatus: "healthy" | "degraded" | "unhealthy";
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(probes).set(updateSet).where(eq(probes.uid, uid));
  }
  return getProbeByUid(uid);
}

export async function deleteProbe(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(probes).where(eq(probes.uid, uid));
  return { success: true };
}

// ── Probe Policies ──
export async function listProbePolicies(probeId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(probePolicies).where(eq(probePolicies.probeId, probeId)).orderBy(desc(probePolicies.createdAt));
}

export async function createProbePolicy(data: {
  probeId: string;
  maxCaptureDurationSec?: number;
  maxCaptureSizeMb?: number;
  pcapInterfacesAllowlist?: string[];
  pcapBpfAllowlist?: string[];
  storageKind?: string;
  storageEndpoint?: string;
  storageBucket?: string;
  storagePrefix?: string;
  redactionEnabled?: boolean;
  redactionPatterns?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(probePolicies).values({ uid, ...data });
  const rows = await db.select().from(probePolicies).where(eq(probePolicies.uid, uid)).limit(1);
  return rows[0];
}

export async function deleteProbePolicy(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(probePolicies).where(eq(probePolicies.uid, uid));
  return { success: true };
}

// ── Capture Policies ──
export async function listCapturePolicies(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(capturePolicies).where(eq(capturePolicies.projectId, projectId)).orderBy(desc(capturePolicies.createdAt));
}

export async function createCapturePolicy(data: {
  projectId: string;
  name: string;
  captureMode: "RUNNER" | "PROBE";
  triggerOn?: string[];
  autoCapture?: boolean;
  duration?: number;
  maxSize?: number;
  bpfFilter?: string;
  interfaceName?: string;
  probeId?: string;
  enabled?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(capturePolicies).values({ uid, ...data });
  const rows = await db.select().from(capturePolicies).where(eq(capturePolicies.uid, uid)).limit(1);
  return rows[0];
}

export async function updateCapturePolicy(uid: string, data: Partial<{
  name: string;
  enabled: boolean;
  captureMode: "RUNNER" | "PROBE";
  autoCapture: boolean;
  duration: number;
  maxSize: number;
  bpfFilter: string;
  interfaceName: string;
  probeId: string;
  triggerOn: string[];
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(capturePolicies).set(updateSet).where(eq(capturePolicies.uid, uid));
  }
  const rows = await db.select().from(capturePolicies).where(eq(capturePolicies.uid, uid)).limit(1);
  return rows[0];
}

export async function deleteCapturePolicy(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(capturePolicies).where(eq(capturePolicies.uid, uid));
  return { success: true };
}
