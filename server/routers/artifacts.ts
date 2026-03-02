// ============================================================================
// AgilesTest — Artifacts tRPC Router
// Signed URL upload/download, confirmation, listing
// ============================================================================

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createUploadUrl,
  confirmUpload,
  getDownloadUrl,
  deleteArtifact,
  buildArtifactKey,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from "../artifactStorage";
import { getDb } from "../db";
import { artifacts, executions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export const artifactsRouter = router({
  /**
   * Get a pre-signed PUT URL for uploading an artifact.
   */
  createUploadUrl: protectedProcedure
    .input(
      z.object({
        executionId: z.number(),
        filename: z.string().min(1).max(512),
        contentType: z.string().min(1).max(128),
        sizeBytes: z.number().positive(),
        checksumSha256: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [execution] = await db
        .select()
        .from(executions)
        .where(eq(executions.id, input.executionId))
        .limit(1);

      if (!execution) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Execution not found" });
      }

      const key = buildArtifactKey(
        Number(execution.projectId),
        input.executionId,
        input.filename
      );

      const result = await createUploadUrl({
        key,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
      });

      return result;
    }),

  /**
   * Confirm an upload was successful and register the artifact in DB.
   */
  confirmUpload: protectedProcedure
    .input(
      z.object({
        executionId: z.number(),
        key: z.string().min(1),
        filename: z.string().min(1).max(512),
        type: z.string().default("OTHER"),
        checksumSha256: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const s3Info = await confirmUpload(input.key);

      if (!s3Info.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Upload not found in storage. Please upload the file first.",
        });
      }

      // execution_id is varchar in DB, look up the execution's uid
      const [exec] = await db.select().from(executions).where(eq(executions.id, input.executionId)).limit(1);
      const executionUid = exec?.uid ?? String(input.executionId);
      const [inserted] = await db.insert(artifacts).values({
        uid: randomUUID(),
        executionId: executionUid,
        type: input.type,
        filename: input.filename,
        mimeType: s3Info.contentType,
        sizeBytes: s3Info.sizeBytes,
        storagePath: input.key,
        checksum: input.checksumSha256 ?? null,
      });

      return {
        id: inserted.insertId,
        key: input.key,
        sizeBytes: s3Info.sizeBytes,
        contentType: s3Info.contentType,
      };
    }),

  /**
   * Get a pre-signed GET URL for downloading an artifact.
   */
  getDownloadUrl: protectedProcedure
    .input(z.object({ artifactId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [artifact] = await db
        .select()
        .from(artifacts)
        .where(eq(artifacts.id, input.artifactId))
        .limit(1);

      if (!artifact || !artifact.storagePath) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artifact not found" });
      }

      const result = await getDownloadUrl(artifact.storagePath);

      return {
        ...result,
        filename: artifact.filename,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
      };
    }),

  /**
   * List artifacts for an execution.
   */
  listByExecution: protectedProcedure
    .input(z.object({ executionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // artifacts.execution_id is varchar (uid), look up execution uid first
      const [exec] = await db.select().from(executions).where(eq(executions.id, input.executionId)).limit(1);
      const executionUid = exec?.uid ?? String(input.executionId);
      const rows = await db
        .select()
        .from(artifacts)
        .where(eq(artifacts.executionId, executionUid));

      return rows;
    }),

  /**
   * Delete an artifact (DB + S3).
   */
  delete: protectedProcedure
    .input(z.object({ artifactId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [artifact] = await db
        .select()
        .from(artifacts)
        .where(eq(artifacts.id, input.artifactId))
        .limit(1);

      if (!artifact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artifact not found" });
      }

      if (artifact.storagePath) {
        await deleteArtifact(artifact.storagePath);
      }

      await db.delete(artifacts).where(eq(artifacts.id, input.artifactId));

      return { deleted: true };
    }),

  /**
   * Get upload constraints for the frontend.
   */
  getUploadConstraints: protectedProcedure.query(() => {
    return {
      maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
      maxFileSizeMB: MAX_FILE_SIZE_BYTES / 1024 / 1024,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    };
  }),
});
