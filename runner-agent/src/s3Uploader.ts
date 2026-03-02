/**
 * S3/MinIO Uploader — Upload des artefacts vers MinIO (S3 compatible)
 *
 * Convention de chemin : /{project_id}/{execution_id}/{artifact_type}/{filename}
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as mime from 'mime-types';

// ─── Configuration ───────────────────────────────────────────────────────

const s3Config = {
  endpoint: `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true, // Required for MinIO
};

const BUCKET = process.env.MINIO_BUCKET || 'agilestest-artifacts';

const s3 = new S3Client(s3Config);

// ─── Types ───────────────────────────────────────────────────────────────

export interface LocalArtifact {
  type: string;
  filename: string;
  localPath: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ArtifactManifestEntry {
  type: string;
  filename: string;
  s3_key: string;
  s3_uri: string;
  size_bytes: number;
  mime_type: string;
  checksum: string | null;
  download_url: string;
}

// ─── Functions ───────────────────────────────────────────────────────────

function computeChecksum(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

export async function uploadArtifacts(
  artifacts: LocalArtifact[],
  projectId: string,
  executionId: string
): Promise<ArtifactManifestEntry[]> {
  const manifest: ArtifactManifestEntry[] = [];

  for (const artifact of artifacts) {
    const s3Key = `${projectId}/${executionId}/${artifact.type.toLowerCase()}/${artifact.filename}`;
    const s3Uri = `s3://${BUCKET}/${s3Key}`;

    console.log(`[S3] Uploading ${artifact.filename} → ${s3Key}`);

    try {
      const fileContent = fs.readFileSync(artifact.localPath);
      const checksum = computeChecksum(artifact.localPath);

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: fileContent,
        ContentType: artifact.mimeType,
        Metadata: {
          'execution-id': executionId,
          'artifact-type': artifact.type,
          'checksum-sha256': checksum,
        },
      }));

      // Construct download URL (MinIO presigned or direct)
      const downloadUrl = `${s3Config.endpoint}/${BUCKET}/${s3Key}`;

      manifest.push({
        type: artifact.type,
        filename: artifact.filename,
        s3_key: s3Key,
        s3_uri: s3Uri,
        size_bytes: artifact.sizeBytes,
        mime_type: artifact.mimeType,
        checksum,
        download_url: downloadUrl,
      });

      console.log(`[S3] ✓ ${artifact.filename} (${(artifact.sizeBytes / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      console.error(`[S3] ✗ Failed to upload ${artifact.filename}: ${err.message}`);
    }
  }

  console.log(`[S3] Uploaded ${manifest.length}/${artifacts.length} artifacts`);
  return manifest;
}
