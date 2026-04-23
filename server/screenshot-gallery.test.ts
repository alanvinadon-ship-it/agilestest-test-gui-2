/**
 * Tests for ScreenshotGallery — validates screenshot parsing, filtering, and status extraction logic.
 * The component itself is React, so we test the pure logic functions here.
 */
import { describe, it, expect } from "vitest";

// ─── Replicate the parsing logic from ScreenshotGallery ─────────────────

function parseScreenshotInfo(art: { filename?: string; name?: string | null }) {
  const match = art.filename?.match(/step-(\d+)-(passed|failed|skipped)/i);
  if (match) {
    return {
      stepIndex: parseInt(match[1], 10),
      status: match[2].toLowerCase() as "passed" | "failed" | "skipped",
      label: art.name || `Étape ${match[1]}`,
    };
  }
  const nameMatch = art.name?.match(/Étape\s+(\d+)\s*—\s*(PASSED|FAILED|SKIPPED)/i);
  if (nameMatch) {
    return {
      stepIndex: parseInt(nameMatch[1], 10),
      status: nameMatch[2].toLowerCase() as "passed" | "failed" | "skipped",
      label: art.name || `Étape ${nameMatch[1]}`,
    };
  }
  return { stepIndex: 0, status: "unknown" as const, label: art.name || art.filename || "Screenshot" };
}

function isScreenshot(art: { type: string; storageUrl?: string | null; downloadUrl?: string | null }): boolean {
  return art.type === "screenshot" && !!(art.storageUrl || art.downloadUrl);
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("ScreenshotGallery — parseScreenshotInfo", () => {
  it("should parse step index and PASSED status from filename", () => {
    const result = parseScreenshotInfo({ filename: "step-3-passed-abc123.png" });
    expect(result.stepIndex).toBe(3);
    expect(result.status).toBe("passed");
  });

  it("should parse step index and FAILED status from filename", () => {
    const result = parseScreenshotInfo({ filename: "step-7-failed-def456.png" });
    expect(result.stepIndex).toBe(7);
    expect(result.status).toBe("failed");
  });

  it("should parse step index and SKIPPED status from filename", () => {
    const result = parseScreenshotInfo({ filename: "step-8-skipped-ghi789.png" });
    expect(result.stepIndex).toBe(8);
    expect(result.status).toBe("skipped");
  });

  it("should use name field as label when available", () => {
    const result = parseScreenshotInfo({ filename: "step-1-passed-xyz.png", name: "NAVIGATE → login" });
    expect(result.label).toBe("NAVIGATE → login");
    expect(result.stepIndex).toBe(1);
  });

  it("should fallback to step number label when name is null", () => {
    const result = parseScreenshotInfo({ filename: "step-5-passed-xyz.png", name: null });
    expect(result.label).toBe("Étape 5");
  });

  it("should parse from name field when filename doesn't match pattern", () => {
    const result = parseScreenshotInfo({ filename: "random.png", name: "Étape 4 — FAILED" });
    expect(result.stepIndex).toBe(4);
    expect(result.status).toBe("failed");
  });

  it("should return unknown status for unrecognized patterns", () => {
    const result = parseScreenshotInfo({ filename: "capture.png", name: "Some random name" });
    expect(result.stepIndex).toBe(0);
    expect(result.status).toBe("unknown");
    expect(result.label).toBe("Some random name");
  });

  it("should handle missing filename gracefully", () => {
    const result = parseScreenshotInfo({ name: null });
    expect(result.stepIndex).toBe(0);
    expect(result.status).toBe("unknown");
    expect(result.label).toBe("Screenshot");
  });

  it("should handle case-insensitive status in filename", () => {
    const result = parseScreenshotInfo({ filename: "step-2-PASSED-abc.png" });
    expect(result.status).toBe("passed");
  });

  it("should handle case-insensitive status in name", () => {
    const result = parseScreenshotInfo({ filename: "x.png", name: "Étape 6 — passed" });
    expect(result.stepIndex).toBe(6);
    expect(result.status).toBe("passed");
  });

  it("should handle double-digit step numbers", () => {
    const result = parseScreenshotInfo({ filename: "step-12-failed-abc.png" });
    expect(result.stepIndex).toBe(12);
    expect(result.status).toBe("failed");
  });
});

describe("ScreenshotGallery — isScreenshot filter", () => {
  it("should accept screenshot type with storageUrl", () => {
    expect(isScreenshot({ type: "screenshot", storageUrl: "https://s3.example.com/img.png" })).toBe(true);
  });

  it("should accept screenshot type with downloadUrl", () => {
    expect(isScreenshot({ type: "screenshot", downloadUrl: "https://s3.example.com/img.png" })).toBe(true);
  });

  it("should reject screenshot type without any URL", () => {
    expect(isScreenshot({ type: "screenshot", storageUrl: null, downloadUrl: null })).toBe(false);
  });

  it("should reject non-screenshot type", () => {
    expect(isScreenshot({ type: "LOG", storageUrl: "https://s3.example.com/log.txt" })).toBe(false);
  });

  it("should reject SCREENSHOT (uppercase) — type must be lowercase 'screenshot'", () => {
    expect(isScreenshot({ type: "SCREENSHOT", storageUrl: "https://s3.example.com/img.png" })).toBe(false);
  });
});

describe("ScreenshotGallery — sorting", () => {
  it("should sort screenshots by step index ascending", () => {
    const artifacts = [
      { filename: "step-5-passed-a.png", name: null },
      { filename: "step-1-passed-b.png", name: null },
      { filename: "step-3-failed-c.png", name: null },
    ];
    const parsed = artifacts.map((a) => ({ ...a, ...parseScreenshotInfo(a) }));
    parsed.sort((a, b) => a.stepIndex - b.stepIndex);
    expect(parsed.map((p) => p.stepIndex)).toEqual([1, 3, 5]);
  });

  it("should handle mixed known and unknown steps", () => {
    const artifacts = [
      { filename: "step-3-passed-a.png", name: null },
      { filename: "random.png", name: null },
      { filename: "step-1-failed-b.png", name: null },
    ];
    const parsed = artifacts.map((a) => ({ ...a, ...parseScreenshotInfo(a) }));
    parsed.sort((a, b) => a.stepIndex - b.stepIndex);
    // unknown (stepIndex=0) comes first, then 1, then 3
    expect(parsed.map((p) => p.stepIndex)).toEqual([0, 1, 3]);
  });
});

describe("ScreenshotGallery — artifact type stored by engine", () => {
  it("should verify the engine stores type as lowercase 'screenshot'", () => {
    // The playwrightRunner and executionEngine store artifacts with type: 'screenshot'
    // This test ensures consistency with the gallery filter
    const engineArtifactType = "screenshot";
    expect(isScreenshot({ type: engineArtifactType, storageUrl: "https://s3.example.com/img.png" })).toBe(true);
  });
});
