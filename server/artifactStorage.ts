// ============================================================================
// AgilesTest — Artifact Storage Provider (S3 / MinIO)
// Signed URL upload/download, size/mime limits, checksum support
// ============================================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

// ── Configuration ──────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "text/plain",
  "text/csv",
  "text/xml",
  "application/json",
  "application/xml",
  "application/pdf",
  // Archives
  "application/zip",
  "application/gzip",
  "application/x-tar",
  "application/x-gzip",
  // JMeter / test artifacts
  "application/octet-stream",
  // Images (screenshots)
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  // Logs
  "text/x-log",
  "application/x-pcap",
  // PCAP
  "application/vnd.tcpdump.pcap",
]);

// ── S3 Client ──────────────────────────────────────────────────────────────

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3Client) return _s3Client;

  if (!ENV.s3Endpoint || !ENV.s3AccessKey || !ENV.s3SecretKey) {
    throw new Error(
      "S3 configuration missing: set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY"
    );
  }

  _s3Client = new S3Client({
    endpoint: ENV.s3Endpoint,
    region: ENV.s3Region,
    forcePathStyle: ENV.s3ForcePathStyle,
    credentials: {
      accessKeyId: ENV.s3AccessKey,
      secretAccessKey: ENV.s3SecretKey,
    },
  });

  return _s3Client;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateUploadUrlInput {
  /** Relative key within the bucket (e.g. "runs/123/results.jtl") */
  key: string;
  /** MIME type of the file */
  contentType: string;
  /** File size in bytes (for validation) */
  sizeBytes: number;
  /** Optional SHA-256 checksum (hex) */
  checksumSha256?: string;
}

export interface CreateUploadUrlResult {
  /** Pre-signed PUT URL */
  uploadUrl: string;
  /** The S3 key that was used */
  key: string;
  /** Expiry timestamp (ISO) */
  expiresAt: string;
}

export interface GetDownloadUrlResult {
  /** Pre-signed GET URL */
  downloadUrl: string;
  /** Expiry timestamp (ISO) */
  expiresAt: string;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a pre-signed PUT URL for uploading an artifact.
 * Validates size and MIME type before generating the URL.
 */
export async function createUploadUrl(
  input: CreateUploadUrlInput
): Promise<CreateUploadUrlResult> {
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(input.contentType)) {
    throw new Error(
      `MIME type '${input.contentType}' is not allowed. Allowed types: ${[...ALLOWED_MIME_TYPES].join(", ")}`
    );
  }

  // Validate size
  if (input.sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size ${input.sizeBytes} bytes exceeds maximum ${MAX_FILE_SIZE_BYTES} bytes (${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB)`
    );
  }

  if (input.sizeBytes <= 0) {
    throw new Error("File size must be positive");
  }

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: ENV.s3Bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
    ...(input.checksumSha256
      ? { ChecksumSHA256: input.checksumSha256 }
      : {}),
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: SIGNED_URL_EXPIRY_SECONDS,
  });

  const expiresAt = new Date(
    Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000
  ).toISOString();

  return { uploadUrl, key: input.key, expiresAt };
}

/**
 * Confirm that an upload was successful by checking the object exists in S3.
 * Returns metadata about the uploaded object.
 */
export async function confirmUpload(key: string): Promise<{
  exists: boolean;
  sizeBytes: number;
  contentType: string;
  etag: string;
}> {
  const client = getS3Client();

  try {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: ENV.s3Bucket,
        Key: key,
      })
    );

    return {
      exists: true,
      sizeBytes: head.ContentLength ?? 0,
      contentType: head.ContentType ?? "application/octet-stream",
      etag: head.ETag ?? "",
    };
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return {
        exists: false,
        sizeBytes: 0,
        contentType: "",
        etag: "",
      };
    }
    throw err;
  }
}

/**
 * Create a pre-signed GET URL for downloading an artifact.
 */
export async function getDownloadUrl(
  key: string
): Promise<GetDownloadUrlResult> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: ENV.s3Bucket,
    Key: key,
  });

  const downloadUrl = await getSignedUrl(client, command, {
    expiresIn: SIGNED_URL_EXPIRY_SECONDS,
  });

  const expiresAt = new Date(
    Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000
  ).toISOString();

  return { downloadUrl, expiresAt };
}

/**
 * Delete an artifact from S3.
 */
export async function deleteArtifact(key: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
    })
  );
}

/**
 * Build the storage key for an execution artifact.
 */
export function buildArtifactKey(
  projectId: number,
  executionId: number,
  filename: string
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  return `projects/${projectId}/executions/${executionId}/${timestamp}_${sanitized}`;
}

// ── Exports for validation ─────────────────────────────────────────────────

export { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES, SIGNED_URL_EXPIRY_SECONDS };
