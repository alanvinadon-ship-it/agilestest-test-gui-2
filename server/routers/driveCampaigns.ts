import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { driveCampaigns } from "../../drizzle/schema";
import { eq, and, desc, lt, like, sql, SQL } from "drizzle-orm";
import { randomUUID } from "crypto";

const envEnum = z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]);
const statusEnum = z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]);

export const driveCampaignsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        status: statusEnum.optional(),
        targetEnv: envEnum.optional(),
        search: z.string().optional(),
        pageSize: z.number().int().min(1).max(100).default(30),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });
      const pageSize = input.pageSize;
      const conditions: SQL[] = [
        eq(driveCampaigns.projectId, input.projectId),
      ];
      if (input.status) conditions.push(eq(driveCampaigns.status, input.status));
      if (input.targetEnv)
        conditions.push(eq(driveCampaigns.targetEnv, input.targetEnv));
      if (input.search)
        conditions.push(like(driveCampaigns.name, `%${input.search}%`));
      if (input.cursor) conditions.push(lt(driveCampaigns.id, input.cursor));
      const where = and(...conditions);
      const rows = await db
        .select()
        .from(driveCampaigns)
        .where(where)
        .orderBy(desc(driveCampaigns.id))
        .limit(pageSize + 1);
      const hasMore = rows.length > pageSize;
      const data = hasMore ? rows.slice(0, pageSize) : rows;
      const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : undefined;
      return { data, nextCursor, hasMore };
    }),

  get: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });
      const [campaign] = await db
        .select()
        .from(driveCampaigns)
        .where(eq(driveCampaigns.uid, input.campaignId))
        .limit(1);
      if (!campaign)
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      return campaign;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        targetEnv: envEnum.optional(),
        networkType: z.string().optional(),
        area: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: statusEnum.default("DRAFT"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });
      const uid = randomUUID();
      await db.insert(driveCampaigns).values({
        uid,
        projectId: input.projectId,
        name: input.name,
        description: input.description ?? null,
        targetEnv: input.targetEnv ?? null,
        networkType: input.networkType ?? null,
        area: input.area ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        status: input.status,
        createdBy: ctx.user?.openId ?? null,
      });
      return { success: true, campaignId: uid };
    }),

  update: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        targetEnv: envEnum.optional(),
        networkType: z.string().optional(),
        area: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: statusEnum.optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });
      const u: Record<string, unknown> = {};
      if (input.name !== undefined) u.name = input.name;
      if (input.description !== undefined) u.description = input.description;
      if (input.targetEnv !== undefined) u.targetEnv = input.targetEnv;
      if (input.networkType !== undefined) u.networkType = input.networkType;
      if (input.area !== undefined) u.area = input.area;
      if (input.startDate !== undefined) u.startDate = input.startDate;
      if (input.endDate !== undefined) u.endDate = input.endDate;
      if (input.status !== undefined) u.status = input.status;
      if (Object.keys(u).length) {
        await db
          .update(driveCampaigns)
          .set(u)
          .where(eq(driveCampaigns.uid, input.campaignId));
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });
      await db
        .delete(driveCampaigns)
        .where(eq(driveCampaigns.uid, input.campaignId));
      return { success: true };
    }),
});
