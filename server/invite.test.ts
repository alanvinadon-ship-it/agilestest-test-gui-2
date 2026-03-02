import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the DB module
vi.mock("./db", () => {
  const mockRows: Record<string, any[]> = {
    invites: [],
    users: [],
  };

  return {
    getDb: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn((table: any) => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              const tableName = table?.name ?? table?.[Symbol.for("drizzle:Name")] ?? "invites";
              return mockRows[tableName] ?? [];
            }),
          })),
          limit: vi.fn(() => []),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => Promise.resolve()),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
      execute: vi.fn(() => []),
    })),
    __mockRows: mockRows,
  };
});

// Mock audit log
vi.mock("./lib/auditLog", () => ({
  writeAuditLog: vi.fn(() => Promise.resolve()),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("invite.verifyToken", () => {
  it("returns NOT_FOUND for empty/invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.invite.verifyToken({ token: "nonexistent_token_abc123" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("NOT_FOUND");
    }
  });

  it("requires a non-empty token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.invite.verifyToken({ token: "" })).rejects.toThrow();
  });
});

describe("invite.accept", () => {
  it("rejects with NOT_FOUND for invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.invite.accept({
        token: "nonexistent_token_xyz789",
        fullName: "Test User",
        password: "securepass123",
      })
    ).rejects.toThrow("Invitation non trouvée");
  });

  it("validates password minimum length", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.invite.accept({
        token: "sometoken",
        fullName: "Test User",
        password: "short",
      })
    ).rejects.toThrow();
  });

  it("validates fullName minimum length", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.invite.accept({
        token: "sometoken",
        fullName: "A",
        password: "securepass123",
      })
    ).rejects.toThrow();
  });
});
