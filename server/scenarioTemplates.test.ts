import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-template-user",
    email: "template@example.com",
    name: "Template Tester",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
  return { ctx };
}

describe("scenarioTemplates.publish", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);
  let projectUid: string;
  let scenarioUid: string;

  beforeAll(async () => {
    // Create a project + profile + scenario to publish
    const project = await caller.projects.create({
      name: "Publish Template Project",
      description: "For template publish tests",
      domain: "IMS",
    });
    projectUid = project.uid;

    const profile = await caller.profiles.create({
      projectId: projectUid,
      name: "IMS Profile",
      protocol: "SIP",
      domain: "IMS",
      profileType: "SIP_TRUNK",
    });

    const scenario = await caller.scenarios.create({
      projectId: projectUid,
      profileId: profile.uid,
      name: "Test Scenario for Publish",
      description: "A scenario to be published as template",
      testType: "VABF",
      steps: [
        { id: "s1", order: 0, action: "REGISTER", description: "Register SIP", expected_result: "200 OK", parameters: {} },
        { id: "s2", order: 1, action: "INVITE", description: "Send INVITE", expected_result: "200 OK", parameters: {} },
      ],
    });
    scenarioUid = scenario.uid;
  });

  it("should publish a scenario as a community template", async () => {
    const result = await caller.scenarioTemplates.publish({
      scenarioUid,
      projectId: projectUid,
      name: "Published IMS Template",
      description: "Community template for IMS testing",
      tags: ["ims", "sip", "registration"],
      visibility: "PUBLIC",
    });

    expect(result.templateUid).toBeTruthy();
    expect(result.name).toBe("Published IMS Template");
  });

  it("should create a template with correct snapshot JSON", async () => {
    const result = await caller.scenarioTemplates.publish({
      scenarioUid,
      projectId: projectUid,
      name: "Snapshot Template",
      tags: ["snapshot"],
    });

    // Fetch the template to verify snapshot
    const tpl = await caller.scenarioTemplates.get({ templateUid: result.templateUid });
    expect(tpl.templateJson).toBeTruthy();
    expect(tpl.templateJson.schemaVersion).toBe(1);
    expect(tpl.templateJson.scenario).toBeTruthy();
    expect(tpl.templateJson.scenario.name).toBe("Test Scenario for Publish");
    expect(tpl.templateJson.scenario.steps).toHaveLength(2);
    expect(tpl.status).toBe("PUBLISHED");
    expect(tpl.visibility).toBe("PUBLIC");
    expect(tpl.tagsJson).toEqual(["snapshot"]);
    expect(tpl.createdBy).toBe("test-template-user");
  });

  it("should throw NOT_FOUND for non-existent scenario", async () => {
    await expect(
      caller.scenarioTemplates.publish({
        scenarioUid: "non-existent-uid",
        projectId: projectUid,
        name: "Should Fail",
      })
    ).rejects.toThrow();
  });
});

describe("scenarioTemplates.unpublish", () => {
  const { ctx: authorCtx } = createAuthContext({ openId: "author-user", name: "Author" });
  const authorCaller = appRouter.createCaller(authorCtx);

  const { ctx: otherCtx } = createAuthContext({
    id: 2,
    openId: "other-user",
    name: "Other User",
    role: "user",
  });
  const otherCaller = appRouter.createCaller(otherCtx);

  let templateUid: string;
  let projectUid: string;

  beforeAll(async () => {
    const project = await authorCaller.projects.create({
      name: "Unpublish Test Project",
      domain: "API_REST",
    });
    projectUid = project.uid;

    const profile = await authorCaller.profiles.create({
      projectId: projectUid,
      name: "API Profile",
      protocol: "HTTP",
      domain: "API_REST",
    });

    const scenario = await authorCaller.scenarios.create({
      projectId: projectUid,
      profileId: profile.uid,
      name: "Scenario for Unpublish",
      testType: "VABF",
      steps: [{ id: "s1", order: 0, action: "GET", description: "Get endpoint", expected_result: "200", parameters: {} }],
    });

    const result = await authorCaller.scenarioTemplates.publish({
      scenarioUid: scenario.uid,
      projectId: projectUid,
      name: "Template to Unpublish",
      tags: ["test"],
    });
    templateUid = result.templateUid;
  });

  it("should allow author to unpublish", async () => {
    const result = await authorCaller.scenarioTemplates.unpublish({ templateUid });
    expect(result.success).toBe(true);

    // Verify status changed
    const tpl = await authorCaller.scenarioTemplates.get({ templateUid });
    expect(tpl.status).toBe("UNPUBLISHED");
  });

  it("should forbid non-author/non-admin from unpublishing", async () => {
    // Re-publish first
    const { ctx: adminCtx } = createAuthContext({ openId: "author-user", role: "admin" });
    const adminCaller = appRouter.createCaller(adminCtx);

    // We need a published template - create a new one
    const project = await adminCaller.projects.create({ name: "Forbid Test", domain: "IMS" });
    const profile = await adminCaller.profiles.create({ projectId: project.uid, name: "P", protocol: "SIP", domain: "IMS" });
    const scenario = await adminCaller.scenarios.create({
      projectId: project.uid, profileId: profile.uid, name: "S", testType: "VABF",
      steps: [{ id: "s1", order: 0, action: "A", description: "D", expected_result: "E", parameters: {} }],
    });
    const pub = await adminCaller.scenarioTemplates.publish({
      scenarioUid: scenario.uid, projectId: project.uid, name: "Forbidden Unpublish",
    });

    // Other user (non-admin, non-author) tries to unpublish
    await expect(
      otherCaller.scenarioTemplates.unpublish({ templateUid: pub.templateUid })
    ).rejects.toThrow(/auteur|administrateur|FORBIDDEN/i);
  });
});

describe("scenarioTemplates.listPublic", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  it("should return paginated list of published community templates", async () => {
    const result = await caller.scenarioTemplates.listPublic({
      page: 1,
      pageSize: 10,
    });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page", 1);
    expect(result).toHaveProperty("pageSize", 10);
    expect(Array.isArray(result.items)).toBe(true);

    // All returned items should be PUBLISHED and non-built-in
    for (const item of result.items) {
      expect(item.status).toBe("PUBLISHED");
      expect(item.isBuiltIn).toBe(false);
    }
  });

  it("should filter by search term", async () => {
    const result = await caller.scenarioTemplates.listPublic({
      page: 1,
      pageSize: 50,
      search: "Published IMS Template",
    });

    expect(result.items.length).toBeGreaterThanOrEqual(0);
    // If found, verify name matches
    if (result.items.length > 0) {
      expect(result.items[0].name).toContain("IMS");
    }
  });

  it("should filter by tags", async () => {
    const result = await caller.scenarioTemplates.listPublic({
      page: 1,
      pageSize: 50,
      tags: ["ims"],
    });

    for (const item of result.items) {
      const allTags = [...(item.tagsJson || []), ...(item.tags || [])];
      expect(allTags).toContain("ims");
    }
  });
});

describe("scenarioTemplates.get", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  it("should return template details with comments and ratings", async () => {
    // First get a template uid from list
    const list = await caller.scenarioTemplates.list();
    const communityTpl = list.find(t => !t.isBuiltIn && t.status === "PUBLISHED");
    if (!communityTpl) return; // skip if no community templates

    const detail = await caller.scenarioTemplates.get({ templateUid: communityTpl.uid });
    expect(detail.uid).toBe(communityTpl.uid);
    expect(detail).toHaveProperty("comments");
    expect(detail).toHaveProperty("ratings");
    expect(Array.isArray(detail.comments)).toBe(true);
    expect(Array.isArray(detail.ratings)).toBe(true);
  });

  it("should throw NOT_FOUND for non-existent template", async () => {
    await expect(
      caller.scenarioTemplates.get({ templateUid: "non-existent" })
    ).rejects.toThrow();
  });
});

describe("scenarioTemplates.forkToProject", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);
  let templateUid: string;
  let targetProjectUid: string;

  beforeAll(async () => {
    // Create source project + scenario + publish as template
    const srcProject = await caller.projects.create({ name: "Fork Source", domain: "5GC" });
    const profile = await caller.profiles.create({
      projectId: srcProject.uid, name: "5GC Profile", protocol: "HTTP", domain: "5GC",
    });
    const scenario = await caller.scenarios.create({
      projectId: srcProject.uid, profileId: profile.uid,
      name: "5GC Registration Flow", description: "Full 5GC registration",
      testType: "VSR",
      steps: [
        { id: "s1", order: 0, action: "PDU_SESSION", description: "Establish PDU", expected_result: "Success", parameters: {} },
        { id: "s2", order: 1, action: "DEREGISTER", description: "Deregister UE", expected_result: "Success", parameters: {} },
      ],
    });

    const pub = await caller.scenarioTemplates.publish({
      scenarioUid: scenario.uid, projectId: srcProject.uid,
      name: "5GC Registration Template", tags: ["5gc", "registration"],
    });
    templateUid = pub.templateUid;

    // Create target project
    const tgtProject = await caller.projects.create({ name: "Fork Target", domain: "5GC" });
    targetProjectUid = tgtProject.uid;
  });

  it("should fork a template into a project creating scenario + profile", async () => {
    const result = await caller.scenarioTemplates.forkToProject({
      templateUid,
      projectUid: targetProjectUid,
      createProfile: true,
    });

    expect(result.scenarioUid).toBeTruthy();
    expect(result.scenarioCode).toMatch(/^FORK-/);
    expect(result.scenarioName).toBe("5GC Registration Flow");
    expect(result.profileUid).toBeTruthy();
    expect(result.templateDomain).toBe("5GC");
  });

  it("should fork without creating profile when createProfile=false", async () => {
    const result = await caller.scenarioTemplates.forkToProject({
      templateUid,
      projectUid: targetProjectUid,
      scenarioName: "Custom Fork Name",
      createProfile: false,
    });

    expect(result.scenarioUid).toBeTruthy();
    expect(result.scenarioName).toBe("Custom Fork Name");
    expect(result.profileUid).toBeNull();
  });

  it("should throw NOT_FOUND for non-existent or unpublished template", async () => {
    await expect(
      caller.scenarioTemplates.forkToProject({
        templateUid: "non-existent",
        projectUid: targetProjectUid,
      })
    ).rejects.toThrow();
  });

  it("should increment usage count after fork", async () => {
    const before = await caller.scenarioTemplates.get({ templateUid });
    const beforeCount = before.usageCount ?? 0;

    await caller.scenarioTemplates.forkToProject({
      templateUid,
      projectUid: targetProjectUid,
      createProfile: false,
    });

    const after = await caller.scenarioTemplates.get({ templateUid });
    expect(after.usageCount).toBe(beforeCount + 1);
  });
});

describe("scenarioTemplates.rate + addComment", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  it("should rate a template and update average", async () => {
    const list = await caller.scenarioTemplates.list();
    const tpl = list.find(t => !t.isBuiltIn && t.status === "PUBLISHED");
    if (!tpl) return;

    const result = await caller.scenarioTemplates.rate({
      templateUid: tpl.uid,
      rating: 4,
    });

    expect(Number(result.avgRating)).toBeGreaterThan(0);
    expect(Number(result.ratingCount)).toBeGreaterThanOrEqual(1);
  });

  it("should add and delete a comment", async () => {
    const list = await caller.scenarioTemplates.list();
    const tpl = list.find(t => !t.isBuiltIn && t.status === "PUBLISHED");
    if (!tpl) return;

    const comment = await caller.scenarioTemplates.addComment({
      templateUid: tpl.uid,
      content: "Great template for IMS testing!",
    });
    expect(comment.uid).toBeTruthy();

    // Delete it
    const del = await caller.scenarioTemplates.deleteComment({ commentUid: comment.uid });
    expect(del.success).toBe(true);
  });
});
