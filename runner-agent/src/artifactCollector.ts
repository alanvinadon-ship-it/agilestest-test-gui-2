/**
 * Artifact Collector — Collecte les artefacts Playwright après exécution
 *
 * Scan le répertoire d'artefacts et retourne les fichiers à uploader
 * selon la politique d'upload configurée.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import type { LocalArtifact } from './s3Uploader';

// ─── Mapping extensions → artifact type ──────────────────────────────────

const EXT_TO_TYPE: Record<string, string> = {
  '.log': 'LOG',
  '.txt': 'LOG',
  '.png': 'SCREENSHOT',
  '.jpg': 'SCREENSHOT',
  '.jpeg': 'SCREENSHOT',
  '.webp': 'SCREENSHOT',
  '.mp4': 'VIDEO',
  '.webm': 'VIDEO',
  '.har': 'HAR',
  '.zip': 'TRACE',
  '.json': 'OTHER',
  '.pcap': 'PCAP',
  '.pcapng': 'PCAP',
};

const POLICY_TO_TYPES: Record<string, string[]> = {
  screenshot: ['SCREENSHOT'],
  trace: ['TRACE'],
  video: ['VIDEO'],
  log: ['LOG'],
  har: ['HAR'],
  pcap: ['PCAP'],
};

// ─── Functions ───────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

export function collectArtifacts(
  artifactDir: string,
  uploadPolicy: string[]
): LocalArtifact[] {
  const allFiles = walkDir(artifactDir);
  const allowedTypes = new Set<string>();

  // Build allowed types from policy
  for (const policy of uploadPolicy) {
    const types = POLICY_TO_TYPES[policy];
    if (types) {
      for (const t of types) allowedTypes.add(t);
    }
  }

  // Always include LOG
  allowedTypes.add('LOG');

  const artifacts: LocalArtifact[] = [];

  for (const filePath of allFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const type = EXT_TO_TYPE[ext] || 'OTHER';

    // Skip if not in upload policy (unless OTHER and we want everything)
    if (!allowedTypes.has(type) && type !== 'OTHER') continue;

    const stat = fs.statSync(filePath);
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    artifacts.push({
      type,
      filename: path.basename(filePath),
      localPath: filePath,
      sizeBytes: stat.size,
      mimeType: mimeType as string,
    });
  }

  console.log(`[COLLECT] Found ${artifacts.length} artifacts in ${artifactDir}`);
  for (const a of artifacts) {
    console.log(`  ${a.type.padEnd(12)} ${a.filename} (${(a.sizeBytes / 1024).toFixed(1)} KB)`);
  }

  return artifacts;
}
