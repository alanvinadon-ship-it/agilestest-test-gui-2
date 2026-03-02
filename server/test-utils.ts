/**
 * Test Utilities for E2E API Testing
 *
 * Provides helpers for setting up test data, mocking, and validating responses
 */

import { randomUUID } from "crypto";
import { getDb } from "./db";
import {
  aiEngines,
  aiRoutingRules,
  driveRuns,
  driveAiAnalyses,
  driveAiSegments,
  driveAiFeedback,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Generate a unique test organization ID
 */
export function createTestOrgId(): string {
  return `test-org-${randomUUID().slice(0, 8)}`;
}

/**
 * Generate a unique test user ID
 */
export function createTestUserId(): string {
  return `test-user-${randomUUID().slice(0, 8)}`;
}

/**
 * Create test engines for a given organization
 */
export async function createTestEngines(
  orgId: string,
  userId: string
): Promise<{
  primaryEngineUid: string;
  secondaryEngineUid: string;
  tertiaryEngineUid: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const primaryEngineUid = randomUUID();
  const secondaryEngineUid = randomUUID();
  const tertiaryEngineUid = randomUUID();

  await db.insert(aiEngines).values([
    {
      uid: primaryEngineUid,
      orgId,
      name: "GPT-4o Primary",
      provider: "OPENAI",
      model: "gpt-4o",
      enabled: true,
      isPrimary: true,
      baseUrl: null,
      timeoutMs: 30000,
      maxRetries: 2,
      temperature: "0.70" as any,
      maxOutputTokens: 4096,
      secretCiphertext: "mock-encrypted-key-1",
      extraJson: null,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      uid: secondaryEngineUid,
      orgId,
      name: "Claude Sonnet",
      provider: "ANTHROPIC",
      model: "claude-3-sonnet-20240229",
      enabled: true,
      isPrimary: false,
      baseUrl: null,
      timeoutMs: 45000,
      maxRetries: 3,
      temperature: "0.50" as any,
      maxOutputTokens: 8192,
      secretCiphertext: "mock-encrypted-key-2",
      extraJson: null,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      uid: tertiaryEngineUid,
      orgId,
      name: "Gemini Pro",
      provider: "GEMINI",
      model: "gemini-2.0-flash",
      enabled: true,
      isPrimary: false,
      baseUrl: null,
      timeoutMs: 25000,
      maxRetries: 1,
      temperature: "0.80" as any,
      maxOutputTokens: 2048,
      secretCiphertext: "mock-encrypted-key-3",
      extraJson: null,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  return {
    primaryEngineUid,
    secondaryEngineUid,
    tertiaryEngineUid,
  };
}

/**
 * Create a test routing rule
 */
export async function createTestRoutingRule(
  orgId: string,
  userId: string,
  options: {
    useCase: "DRIVE_DIAG" | "ANALYTICS" | "SUMMARIZE" | "INGEST_LONG" | "GENERAL";
    priority: number;
    targetEngineUid: string;
    conditions?: Record<string, any>;
    enabled?: boolean;
  }
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ruleUid = randomUUID();

  await db.insert(aiRoutingRules).values({
    uid: ruleUid,
    orgId,
    name: `Test Rule - ${options.useCase}`,
    enabled: options.enabled ?? true,
    priority: options.priority,
    useCase: options.useCase,
    conditionsJson: options.conditions ?? null,
    targetEngineUid: options.targetEngineUid,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return ruleUid;
}

/**
 * Create a test drive run
 */
export async function createTestDriveRun(
  orgId: string,
  userId: string,
  projectUid: string = randomUUID()
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const runUid = randomUUID();

  await db.insert(driveRuns).values({
    uid: runUid,
    orgId,
    projectUid,
    name: "Test Drive Run",
    status: "COMPLETED",
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return runUid;
}

/**
 * Create a test analysis
 */
export async function createTestAnalysis(
  orgId: string,
  runUid: string,
  userId: string,
  mode: "FAST" | "DEEP" = "FAST"
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const analysisUid = randomUUID();

  await db.insert(driveAiAnalyses).values({
    uid: analysisUid,
    runUid,
    orgId,
    status: "COMPLETED",
    mode,
    model: "gpt-4o",
    qualityScore: 85,
    summaryMd: "# Test Analysis\n\nThis is a test analysis.",
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return analysisUid;
}

/**
 * Create test segments for an analysis
 */
export async function createTestSegments(
  orgId: string,
  analysisUid: string,
  count: number = 2
): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const segmentUids: string[] = [];

  const segmentTypes = [
    "DROP_CALL",
    "LOW_THROUGHPUT",
    "HO_FAIL",
    "HIGH_LATENCY",
    "COVERAGE_HOLE",
  ] as const;

  for (let i = 0; i < count; i++) {
    const segmentUid = randomUUID();
    await db.insert(driveAiSegments).values({
      uid: segmentUid,
      analysisUid,
      orgId,
      segmentType: segmentTypes[i % segmentTypes.length],
      startTs: new Date(Date.now() - 60000 + i * 1000),
      endTs: new Date(Date.now() - 60000 + (i + 1) * 1000),
      diagnosisMd: `# Test Segment ${i + 1}\n\nThis is test segment ${i + 1}`,
      confidence: 0.85 + (i * 0.05),
      createdAt: new Date(),
    });
    segmentUids.push(segmentUid);
  }

  return segmentUids;
}

/**
 * Create test feedback for an analysis
 */
export async function createTestFeedback(
  orgId: string,
  analysisUid: string,
  score: number = 4,
  notes: string = "Good analysis",
  userId: string = "test-user"
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const feedbackUid = randomUUID();

  await db.insert(driveAiFeedback).values({
    uid: feedbackUid,
    analysisUid,
    orgId,
    score,
    notes,
    createdBy: userId,
    createdAt: new Date(),
  });

  return feedbackUid;
}

/**
 * Clean up test data for an organization
 */
export async function cleanupTestData(orgId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(driveAiFeedback).where(eq(driveAiFeedback.orgId, orgId));
  await db.delete(driveAiSegments).where(eq(driveAiSegments.orgId, orgId));
  await db.delete(driveAiAnalyses).where(eq(driveAiAnalyses.orgId, orgId));
  await db.delete(aiRoutingRules).where(eq(aiRoutingRules.orgId, orgId));
  await db.delete(aiEngines).where(eq(aiEngines.orgId, orgId));
  await db.delete(driveRuns).where(eq(driveRuns.orgId, orgId));
}

/**
 * Validate engine resolution response
 */
export function validateEngineResolution(response: any): boolean {
  return (
    response &&
    typeof response === "object" &&
    "engineUid" in response &&
    "engineName" in response &&
    "provider" in response &&
    "source" in response &&
    "timeoutMs" in response &&
    "maxRetries" in response &&
    "temperature" in response &&
    "maxOutputTokens" in response
  );
}

/**
 * Validate routing rule response
 */
export function validateRoutingRule(response: any): boolean {
  return (
    response &&
    typeof response === "object" &&
    "uid" in response &&
    "useCase" in response &&
    "priority" in response &&
    "targetEngineUid" in response &&
    "enabled" in response
  );
}

/**
 * Validate analysis response
 */
export function validateAnalysis(response: any): boolean {
  return (
    response &&
    typeof response === "object" &&
    "uid" in response &&
    "runUid" in response &&
    "selectedEngineUid" in response &&
    "selectedEngineName" in response &&
    "selectedEngineProvider" in response
  );
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Measure execution time
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  const result = await fn();
  const duration = Date.now() - startTime;

  return { result, duration };
}
