/**
 * Orchestration Stub — Serveur minimal pour le développement local.
 * Expose les endpoints nécessaires au Runner Agent.
 *
 * En production, ces endpoints sont fournis par le vrai service Orchestration.
 */

import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = process.env.PORT || 4000;

// In-memory store
const jobs = [];
const executions = [];

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function now() { return new Date().toISOString(); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;
  const path = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Runner-ID');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  console.log(`${method} ${path}`);

  // ─── POST /api/v1/executions ────────────────────────────────────────
  if (method === 'POST' && path === '/api/v1/executions') {
    const body = await parseBody(req);
    const executionId = `exec_${randomUUID().slice(0, 8)}`;
    const execution = {
      id: executionId,
      ...body,
      status: 'PENDING',
      created_at: now(),
    };
    executions.push(execution);

    // Create job
    const job = {
      job_id: `job_${randomUUID().slice(0, 8)}`,
      execution_id: executionId,
      project_id: body.project_id,
      runner_id: null,
      status: 'PENDING',
      script_id: body.script_id,
      script_version: body.script_version || 1,
      download_url: body.download_url || null,
      dataset_bundle_id: body.dataset_bundle_id || null,
      target_env: body.target_env || 'DEV',
      artifact_upload_policy: body.artifact_upload_policy || ['screenshot', 'trace', 'log'],
      metrics: null,
      artifact_manifest: null,
      created_at: now(),
      started_at: null,
      finished_at: null,
    };
    jobs.push(job);

    return json(res, { data: { execution, job } }, 201);
  }

  // ─── GET /api/v1/jobs/next ──────────────────────────────────────────
  if (method === 'GET' && path === '/api/v1/jobs/next') {
    const runnerId = url.searchParams.get('runner_id') || 'unknown';
    const pending = jobs.find(j => j.status === 'PENDING');
    if (!pending) {
      return json(res, { data: null }, 204);
    }
    // Lock
    pending.status = 'RUNNING';
    pending.runner_id = runnerId;
    pending.started_at = now();

    // Update execution
    const exec = executions.find(e => e.id === pending.execution_id);
    if (exec) {
      exec.status = 'RUNNING';
      exec.runner_id = runnerId;
      exec.started_at = now();
    }

    return json(res, { data: pending });
  }

  // ─── POST /api/v1/jobs/:id/heartbeat ────────────────────────────────
  const heartbeatMatch = path.match(/^\/api\/v1\/jobs\/([^/]+)\/heartbeat$/);
  if (method === 'POST' && heartbeatMatch) {
    return json(res, { ok: true });
  }

  // ─── POST /api/v1/jobs/:id/complete ─────────────────────────────────
  const completeMatch = path.match(/^\/api\/v1\/jobs\/([^/]+)\/complete$/);
  if (method === 'POST' && completeMatch) {
    const jobId = completeMatch[1];
    const body = await parseBody(req);
    const job = jobs.find(j => j.job_id === jobId);
    if (!job) return json(res, { error: 'Job not found' }, 404);

    job.status = body.status;
    job.finished_at = now();
    job.metrics = body.metrics;
    job.artifact_manifest = body.artifact_manifest;

    // Update execution
    const exec = executions.find(e => e.id === job.execution_id);
    if (exec) {
      exec.status = body.status === 'DONE'
        ? (body.metrics?.failed > 0 ? 'FAILED' : 'PASSED')
        : 'ERROR';
      exec.finished_at = now();
      exec.duration_ms = body.metrics?.duration_ms;
      exec.artifacts_count = (body.artifact_manifest || []).length;
      exec.incidents_count = body.metrics?.failed || 0;
    }

    console.log(`Job ${jobId} completed: ${body.status}`);
    return json(res, { data: job });
  }

  // ─── GET /api/v1/jobs ───────────────────────────────────────────────
  if (method === 'GET' && path === '/api/v1/jobs') {
    return json(res, { data: jobs, total: jobs.length });
  }

  // ─── GET /api/v1/executions ─────────────────────────────────────────
  if (method === 'GET' && path === '/api/v1/executions') {
    return json(res, { data: executions, total: executions.length });
  }

  // ─── POST /api/v1/dataset-bundles/:id/resolve ───────────────────────
  const resolveMatch = path.match(/^\/api\/v1\/dataset-bundles\/([^/]+)\/resolve$/);
  if (method === 'POST' && resolveMatch) {
    const bundleId = resolveMatch[1];
    const body = await parseBody(req);
    // Stub: return empty merged JSON
    return json(res, {
      data: {
        bundle_id: bundleId,
        env: body.env || 'DEV',
        merged_json: {},
        secrets_placeholder_keys: [],
        resolved_at: now(),
      }
    });
  }

  // ─── Fallback ───────────────────────────────────────────────────────
  json(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  console.log(`Orchestration Stub listening on port ${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /api/v1/executions`);
  console.log(`  GET  /api/v1/jobs/next?runner_id=...`);
  console.log(`  POST /api/v1/jobs/:id/heartbeat`);
  console.log(`  POST /api/v1/jobs/:id/complete`);
  console.log(`  POST /api/v1/dataset-bundles/:id/resolve`);
});
