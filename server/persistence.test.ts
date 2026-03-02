import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-persistence-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("persistence - profiles CRUD via tRPC", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  it("profiles.list returns data array and pagination", async () => {
    // We need a valid projectId; list with a dummy one should return empty
    const result = await caller.profiles.list({ projectId: "999999", page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.pagination).toHaveProperty("page");
    expect(result.pagination).toHaveProperty("total");
  });
});

describe("persistence - scenarios CRUD via tRPC", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  it("scenarios.list returns data array and pagination", async () => {
    const result = await caller.scenarios.list({ projectId: "999999", page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect(Array.isArray(result.data)).toBe(true);
  });
});
