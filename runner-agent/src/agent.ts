/**
 * AgilesTest Runner Agent
 *
 * Flow :
 *   1) Poll orchestration for next PENDING job
 *   2) Download script package (zip)
 *   3) Write resolved dataset to runtime (json)
 *   4) Run Playwright with config
 *   5) Collect artifacts (trace.zip, screenshots, logs)
 *   6) Upload to MinIO/S3
 *   7) POST /jobs/:id/complete
 */

import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadArtifacts } from './s3Uploader';
import { collectArtifacts } from './artifactCollector';
import { startTcpdump, stopTcpdump, getPcapArtifacts, resetSession as resetTcpdumpSession } from './tcpdumpCapture';
import { ProbeSessionManager } from './probeSessionManager';
import type { TcpdumpConfig } from './tcpdumpCapture';
import type { ProbeSpanTapConfig } from './probeSessionManager';

// ─── Configuration ───────────────────────────────────────────────────────

const CONFIG = {
  runnerId: process.env.RUNNER_ID || `runner-${uuidv4().slice(0, 8)}`,
  orchestrationUrl: process.env.ORCHESTRATION_URL || 'http://localhost:4000',
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
  workspaceDir: process.env.WORKSPACE_DIR || '/workspace',
  artifactsDir: process.env.ARTIFACTS_DIR || '/artifacts',
};

// ─── Types ───────────────────────────────────────────────────────────────

interface RunnerJob {
  job_id: string;
  execution_id: string;
  project_id: string;
  script_id: string;
  script_version: number;
  download_url: string | null;
  dataset_bundle_id: string | null;
  target_env: string;
  artifact_upload_policy: string[];
  /** Capture policy resolved by orchestration */
  capture_mode?: 'NONE' | 'RUNNER_TCPDUMP' | 'PROBE_SPAN_TAP';
  capture_config?: {
    runner_tcpdump?: TcpdumpConfig;
    probe_span_tap?: ProbeSpanTapConfig;
    retention_days?: number;
  };
}

interface ArtifactManifestEntry {
  type: string;
  filename: string;
  s3_key: string;
  s3_uri: string;
  size_bytes: number;
  mime_type: string;
  checksum: string | null;
  download_url: string;
}

interface JobMetrics {
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  playwright_version?: string;
  browser?: string;
}

// ─── API Client ──────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: CONFIG.orchestrationUrl,
  timeout: 30000,
  headers: {
    'X-Runner-ID': CONFIG.runnerId,
    'Content-Type': 'application/json',
  },
});

// ─── Core Functions ──────────────────────────────────────────────────────

async function pollForJob(): Promise<RunnerJob | null> {
  try {
    const res = await api.get(`/api/v1/jobs/next`, {
      params: { runner_id: CONFIG.runnerId },
    });
    if (res.status === 200 && res.data?.data) {
      return res.data.data as RunnerJob;
    }
    return null;
  } catch (err: any) {
    if (err.response?.status === 404 || err.response?.status === 204) {
      return null; // No pending jobs
    }
    console.error(`[POLL] Error: ${err.message}`);
    return null;
  }
}

async function downloadScriptPackage(job: RunnerJob): Promise<string> {
  const scriptDir = path.join(CONFIG.workspaceDir, job.job_id);
  fs.mkdirSync(scriptDir, { recursive: true });

  if (job.download_url) {
    console.log(`[DOWNLOAD] Script package from ${job.download_url}`);
    const zipPath = path.join(scriptDir, 'script-package.zip');

    const res = await api.get(job.download_url, { responseType: 'arraybuffer' });
    fs.writeFileSync(zipPath, Buffer.from(res.data));

    // Unzip
    execSync(`unzip -o ${zipPath} -d ${scriptDir}`, { stdio: 'pipe' });
    console.log(`[DOWNLOAD] Extracted to ${scriptDir}`);
  } else {
    // Fallback: fetch script files from API
    console.log(`[DOWNLOAD] Fetching script files from API`);
    const res = await api.get(`/api/v1/scripts/${job.script_id}`);
    const script = res.data?.data;
    if (script?.files) {
      for (const file of script.files) {
        const filePath = path.join(scriptDir, file.path);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, file.content, 'utf-8');
      }
    }
  }

  return scriptDir;
}

async function resolveDataset(job: RunnerJob): Promise<Record<string, unknown>> {
  if (!job.dataset_bundle_id) return {};

  try {
    const res = await api.post(
      `/api/v1/dataset-bundles/${job.dataset_bundle_id}/resolve`,
      { env: job.target_env }
    );
    return res.data?.data?.merged_json || {};
  } catch (err: any) {
    console.warn(`[DATASET] Failed to resolve bundle: ${err.message}`);
    return {};
  }
}

async function runPlaywright(scriptDir: string, datasetJson: Record<string, unknown>, job: RunnerJob): Promise<JobMetrics> {
  const startTime = Date.now();

  // Write dataset to runtime file
  const datasetPath = path.join(scriptDir, 'dataset.json');
  fs.writeFileSync(datasetPath, JSON.stringify(datasetJson, null, 2), 'utf-8');

  // Write Playwright config if not present
  const configPath = path.join(scriptDir, 'playwright.config.ts');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = `
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  timeout: 60000,
  retries: 0,
  use: {
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
  reporter: [
    ['json', { outputFile: 'test-results.json' }],
    ['list'],
  ],
  outputDir: '${CONFIG.artifactsDir}/${job.job_id}',
});
`;
    fs.writeFileSync(configPath, defaultConfig, 'utf-8');
  }

  // Install dependencies if package.json exists
  const pkgPath = path.join(scriptDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    console.log('[RUN] Installing script dependencies...');
    execSync('npm install', { cwd: scriptDir, stdio: 'pipe' });
  }

  // Run Playwright
  console.log('[RUN] Executing Playwright tests...');
  const artifactDir = path.join(CONFIG.artifactsDir, job.job_id);
  fs.mkdirSync(artifactDir, { recursive: true });

  let exitCode = 0;
  try {
    execSync(
      `npx playwright test --config=${configPath}`,
      {
        cwd: scriptDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          DATASET_PATH: datasetPath,
          TARGET_ENV: job.target_env,
          PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(artifactDir, 'test-results.json'),
        },
        timeout: 300000, // 5 min max
      }
    );
  } catch (err: any) {
    exitCode = err.status || 1;
    // Save stderr as log
    const logPath = path.join(artifactDir, 'playwright-stderr.log');
    fs.writeFileSync(logPath, err.stderr?.toString() || err.message, 'utf-8');
    console.log(`[RUN] Playwright exited with code ${exitCode}`);
  }

  // Parse results
  const resultsPath = path.join(artifactDir, 'test-results.json');
  let metrics: JobMetrics = {
    total_tests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration_ms: Date.now() - startTime,
    playwright_version: '1.42.1',
    browser: 'chromium',
  };

  if (fs.existsSync(resultsPath)) {
    try {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      if (results.stats) {
        metrics.total_tests = results.stats.expected || 0;
        metrics.passed = results.stats.expected || 0;
        metrics.failed = results.stats.unexpected || 0;
        metrics.skipped = results.stats.skipped || 0;
      }
    } catch { /* ignore parse errors */ }
  }

  if (exitCode !== 0 && metrics.failed === 0) {
    metrics.failed = 1;
    metrics.total_tests = Math.max(metrics.total_tests, 1);
  }

  return metrics;
}

async function sendHeartbeat(jobId: string): Promise<void> {
  try {
    await api.post(`/api/v1/jobs/${jobId}/heartbeat`);
  } catch { /* ignore */ }
}

async function completeJob(
  jobId: string,
  status: 'DONE' | 'FAILED',
  metrics: JobMetrics,
  manifest: ArtifactManifestEntry[],
  errorMessage?: string
): Promise<void> {
  await api.post(`/api/v1/jobs/${jobId}/complete`, {
    status,
    metrics,
    artifact_manifest: manifest,
    error_message: errorMessage,
  });
  console.log(`[COMPLETE] Job ${jobId} → ${status}`);
}

// ─── Main Loop ───────────────────────────────────────────────────────────

async function processJob(job: RunnerJob): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[JOB] Processing ${job.job_id}`);
  console.log(`  execution: ${job.execution_id}`);
  console.log(`  script: ${job.script_id} v${job.script_version}`);
  console.log(`  env: ${job.target_env}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Heartbeat interval
  const heartbeatInterval = setInterval(() => sendHeartbeat(job.job_id), 15000);

  // Probe session manager (Mode B)
  const probeManager = new ProbeSessionManager(CONFIG.orchestrationUrl, CONFIG.runnerId);

  try {
    // 0. Start network capture if configured
    const captureMode = job.capture_mode || 'NONE';
    let tcpdumpSession = null;

    if (captureMode === 'RUNNER_TCPDUMP' && job.capture_config?.runner_tcpdump) {
      console.log('[CAPTURE] Mode A — Starting tcpdump on runner...');
      const artifactDir = path.join(CONFIG.artifactsDir, job.job_id);
      tcpdumpSession = startTcpdump(
        job.capture_config.runner_tcpdump,
        artifactDir,
        job.job_id
      );
      if (tcpdumpSession.status === 'FAILED') {
        console.error(`[CAPTURE] tcpdump failed to start: ${tcpdumpSession.errorMessage}`);
      } else {
        console.log(`[CAPTURE] tcpdump running (PID=${tcpdumpSession.pid})`);
      }
    }

    if (captureMode === 'PROBE_SPAN_TAP' && job.capture_config?.probe_span_tap) {
      console.log('[CAPTURE] Mode B — Starting probe capture session...');
      try {
        await probeManager.startCaptureSession(
          job.capture_config.probe_span_tap,
          job.execution_id,
          job.project_id
        );
      } catch (err: any) {
        console.error(`[CAPTURE] Probe session failed: ${err.message}`);
        // Non-blocking: continue test execution even if probe capture fails
      }
    }

    // 1. Download script package
    const scriptDir = await downloadScriptPackage(job);

    // 2. Resolve dataset bundle
    const datasetJson = await resolveDataset(job);

    // 3. Run Playwright
    const metrics = await runPlaywright(scriptDir, datasetJson, job);

    // 4. Stop network capture
    if (captureMode === 'RUNNER_TCPDUMP' && tcpdumpSession?.status === 'RUNNING') {
      console.log('[CAPTURE] Stopping tcpdump...');
      tcpdumpSession = await stopTcpdump() || tcpdumpSession;
    }

    if (captureMode === 'PROBE_SPAN_TAP') {
      console.log('[CAPTURE] Stopping probe capture...');
      await probeManager.stopCaptureSession();
    }

    // 5. Collect artifacts (including PCAP)
    const artifactDir = path.join(CONFIG.artifactsDir, job.job_id);
    const localArtifacts = collectArtifacts(artifactDir, [...job.artifact_upload_policy, 'pcap']);

    // Add PCAP artifacts from tcpdump session
    if (tcpdumpSession && tcpdumpSession.pcapFiles.length > 0) {
      const pcapArts = getPcapArtifacts(tcpdumpSession);
      localArtifacts.push(...pcapArts);
      console.log(`[CAPTURE] ${pcapArts.length} PCAP file(s) from tcpdump`);
    }

    // 6. Upload to MinIO/S3
    const manifest = await uploadArtifacts(
      localArtifacts,
      job.project_id,
      job.execution_id
    );

    // Add probe PCAP artifacts to manifest (already uploaded by probe)
    if (captureMode === 'PROBE_SPAN_TAP') {
      const probeManifest = probeManager.getArtifactManifest();
      manifest.push(...probeManifest);
      console.log(`[CAPTURE] ${probeManifest.length} PCAP file(s) from probe`);
    }

    // 7. Complete job
    const status = metrics.failed > 0 ? 'FAILED' : 'DONE';
    await completeJob(job.job_id, status, metrics, manifest);

  } catch (err: any) {
    console.error(`[ERROR] Job ${job.job_id} failed: ${err.message}`);

    // Cleanup captures on error
    try { await stopTcpdump(); } catch { /* ignore */ }
    try { await probeManager.cancelSession(); } catch { /* ignore */ }

    await completeJob(
      job.job_id,
      'FAILED',
      { total_tests: 0, passed: 0, failed: 1, skipped: 0, duration_ms: 0 },
      [],
      err.message
    );
  } finally {
    clearInterval(heartbeatInterval);
    resetTcpdumpSession();
    probeManager.reset();
  }
}

async function main(): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════════╗
║     AgilesTest Runner Agent v1.0.0              ║
║     Runner ID: ${CONFIG.runnerId.padEnd(33)}║
║     Orchestration: ${CONFIG.orchestrationUrl.padEnd(29)}║
╚══════════════════════════════════════════════════╝
  `);

  while (true) {
    const job = await pollForJob();

    if (job) {
      await processJob(job);
    } else {
      process.stdout.write('.');
    }

    await new Promise(r => setTimeout(r, CONFIG.pollIntervalMs));
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
