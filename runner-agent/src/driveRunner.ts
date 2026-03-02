/**
 * driveRunner.ts — Mode DRIVE du Runner Agent
 * Exécute un runbook de campagne Drive Test :
 *  1. Télécharge le drive package (runbook + commands + parsers)
 *  2. Exécute les commandes (iperf3, ping, tcpdump, etc.)
 *  3. Collecte les outputs (kpi_series, geo, logs, pcap, summary)
 *  4. Upload vers MinIO/S3
 *  5. POST complete avec manifest
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DriveRunConfig {
  campaign_id: string;
  route_id: string;
  device_id: string;
  target_env: string;
  kpi_thresholds: Record<string, number>;
  capture_pcap: boolean;
  capture_video: boolean;
  commands_pack_url?: string;
  probes: ProbeConfig[];
}

interface ProbeConfig {
  probe_id: string;
  name: string;
  capture_type: string;
  enabled: boolean;
}

export interface DriveArtifactEntry {
  artifact_type: 'kpi_series' | 'geo' | 'device_logs' | 'pcap' | 'summary';
  filename: string;
  minio_path: string;
  size_bytes: number;
  sha256: string;
  content_type: string;
}

export interface DriveJobResult {
  status: 'DONE' | 'FAILED';
  artifacts: DriveArtifactEntry[];
  summary: DriveSummary;
  error_message?: string;
}

interface DriveSummary {
  total_samples: number;
  duration_sec: number;
  distance_km: number;
  kpi_averages: Record<string, number>;
  threshold_violations: Array<{
    kpi_name: string;
    threshold: number;
    actual_avg: number;
    direction: 'above' | 'below';
  }>;
  overall_pass: boolean;
}

// ─── Parsers ────────────────────────────────────────────────────────────────

export function parseIperf3Json(filePath: string): Array<{ timestamp: string; kpi_name: string; value: number; unit: string }> {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const results: Array<{ timestamp: string; kpi_name: string; value: number; unit: string }> = [];

  if (raw.intervals) {
    for (const interval of raw.intervals) {
      const ts = new Date(Date.now() - (raw.intervals.length - raw.intervals.indexOf(interval)) * 1000).toISOString();
      const sum = interval.sum || interval.streams?.[0];
      if (sum) {
        if (sum.bits_per_second !== undefined) {
          const mbps = sum.bits_per_second / 1e6;
          results.push({ timestamp: ts, kpi_name: sum.sender ? 'THROUGHPUT_UL' : 'THROUGHPUT_DL', value: parseFloat(mbps.toFixed(2)), unit: 'Mbps' });
        }
        if (sum.jitter_ms !== undefined) {
          results.push({ timestamp: ts, kpi_name: 'JITTER', value: parseFloat(sum.jitter_ms.toFixed(2)), unit: 'ms' });
        }
        if (sum.lost_percent !== undefined) {
          results.push({ timestamp: ts, kpi_name: 'PACKET_LOSS', value: parseFloat(sum.lost_percent.toFixed(2)), unit: '%' });
        }
      }
    }
  }
  return results;
}

export function parsePingOutput(output: string): Array<{ timestamp: string; kpi_name: string; value: number; unit: string }> {
  const results: Array<{ timestamp: string; kpi_name: string; value: number; unit: string }> = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const match = line.match(/time=(\d+\.?\d*)\s*ms/);
    if (match) {
      results.push({
        timestamp: new Date().toISOString(),
        kpi_name: 'LATENCY',
        value: parseFloat(match[1]),
        unit: 'ms',
      });
    }
  }
  return results;
}

export function parseCsvKpi(filePath: string): Array<{ timestamp: string; lat: number; lon: number; kpi_name: string; value: number; unit: string; cell_id?: string }> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const tsIdx = headers.indexOf('timestamp');
  const latIdx = headers.indexOf('lat') !== -1 ? headers.indexOf('lat') : headers.indexOf('latitude');
  const lonIdx = headers.indexOf('lon') !== -1 ? headers.indexOf('lon') : headers.indexOf('longitude');
  const kpiIdx = headers.indexOf('kpi_name') !== -1 ? headers.indexOf('kpi_name') : headers.indexOf('kpi');
  const valIdx = headers.indexOf('value');
  const unitIdx = headers.indexOf('unit');
  const cellIdx = headers.indexOf('cell_id');

  const results: Array<{ timestamp: string; lat: number; lon: number; kpi_name: string; value: number; unit: string; cell_id?: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < Math.max(tsIdx, latIdx, lonIdx, kpiIdx, valIdx) + 1) continue;

    results.push({
      timestamp: cols[tsIdx] || new Date().toISOString(),
      lat: parseFloat(cols[latIdx]) || 0,
      lon: parseFloat(cols[lonIdx]) || 0,
      kpi_name: cols[kpiIdx] || 'UNKNOWN',
      value: parseFloat(cols[valIdx]) || 0,
      unit: cols[unitIdx] || '',
      cell_id: cellIdx !== -1 ? cols[cellIdx] : undefined,
    });
  }
  return results;
}

export function parseGpx(filePath: string): Array<{ lat: number; lon: number; timestamp: string }> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const points: Array<{ lat: number; lon: number; timestamp: string }> = [];
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<time>([^<]+)<\/time>/g;
  let match;
  while ((match = trkptRegex.exec(raw)) !== null) {
    points.push({
      lat: parseFloat(match[1]),
      lon: parseFloat(match[2]),
      timestamp: match[3],
    });
  }
  return points;
}

// ─── SHA-256 ────────────────────────────────────────────────────────────────

function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

// ─── Drive Run Execution ────────────────────────────────────────────────────

export async function executeDriveRun(
  config: DriveRunConfig,
  workDir: string,
  uploadFn: (localPath: string, remotePath: string) => Promise<string>,
  heartbeatFn: () => Promise<void>,
): Promise<DriveJobResult> {
  const outputDir = path.join(workDir, 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const artifacts: DriveArtifactEntry[] = [];
  const allKpiResults: Array<{ timestamp: string; kpi_name: string; value: number; unit: string; lat?: number; lon?: number }> = [];

  try {
    // 1. Download commands pack if URL provided
    if (config.commands_pack_url) {
      console.log(`[DRIVE] Downloading commands pack from ${config.commands_pack_url}`);
      execSync(`curl -sL "${config.commands_pack_url}" -o "${path.join(workDir, 'commands.tar.gz')}"`, { timeout: 30000 });
      execSync(`tar xzf "${path.join(workDir, 'commands.tar.gz')}" -C "${workDir}"`, { timeout: 10000 });
    }

    await heartbeatFn();

    // 2. Execute network measurements
    console.log('[DRIVE] Starting network measurements...');

    // iperf3 test (if available)
    const iperfOutput = path.join(outputDir, 'iperf3_result.json');
    try {
      execSync(`iperf3 -c iperf.he.net -t 10 -J > "${iperfOutput}" 2>/dev/null`, { timeout: 30000 });
      const iperfKpis = parseIperf3Json(iperfOutput);
      allKpiResults.push(...iperfKpis);
      console.log(`[DRIVE] iperf3: ${iperfKpis.length} KPI samples`);
    } catch {
      console.log('[DRIVE] iperf3 not available or failed, skipping');
    }

    await heartbeatFn();

    // ping test
    try {
      const pingOutput = execSync('ping -c 20 -i 0.5 8.8.8.8 2>/dev/null', { timeout: 30000 }).toString();
      const pingKpis = parsePingOutput(pingOutput);
      allKpiResults.push(...pingKpis);
      console.log(`[DRIVE] ping: ${pingKpis.length} latency samples`);
    } catch {
      console.log('[DRIVE] ping failed, skipping');
    }

    await heartbeatFn();

    // 3. pcap capture (if enabled)
    if (config.capture_pcap) {
      const pcapPath = path.join(outputDir, 'capture.pcapng');
      try {
        execSync(`timeout 10 tcpdump -i any -c 1000 -w "${pcapPath}" 2>/dev/null`, { timeout: 15000 });
      } catch {
        console.log('[DRIVE] tcpdump not available or completed');
      }
      if (fs.existsSync(pcapPath)) {
        const remotePath = `/${config.campaign_id}/${config.route_id}/capture.pcapng`;
        await uploadFn(pcapPath, remotePath);
        artifacts.push({
          artifact_type: 'pcap',
          filename: 'capture.pcapng',
          minio_path: remotePath,
          size_bytes: fs.statSync(pcapPath).size,
          sha256: sha256File(pcapPath),
          content_type: 'application/vnd.tcpdump.pcap',
        });
      }
    }

    await heartbeatFn();

    // 4. Write KPI series
    const kpiSeriesPath = path.join(outputDir, 'kpi_series.json');
    fs.writeFileSync(kpiSeriesPath, JSON.stringify(allKpiResults, null, 2));
    const kpiRemotePath = `/${config.campaign_id}/${config.route_id}/kpi_series.json`;
    await uploadFn(kpiSeriesPath, kpiRemotePath);
    artifacts.push({
      artifact_type: 'kpi_series',
      filename: 'kpi_series.json',
      minio_path: kpiRemotePath,
      size_bytes: fs.statSync(kpiSeriesPath).size,
      sha256: sha256File(kpiSeriesPath),
      content_type: 'application/json',
    });

    // 5. Write geo data (simulated track)
    const geoPath = path.join(outputDir, 'geo.geojson');
    const geoData = {
      type: 'FeatureCollection',
      features: allKpiResults
        .filter(r => r.lat && r.lon)
        .map(r => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
          properties: { timestamp: r.timestamp, kpi_name: r.kpi_name, value: r.value },
        })),
    };
    fs.writeFileSync(geoPath, JSON.stringify(geoData, null, 2));
    const geoRemotePath = `/${config.campaign_id}/${config.route_id}/geo.geojson`;
    await uploadFn(geoPath, geoRemotePath);
    artifacts.push({
      artifact_type: 'geo',
      filename: 'geo.geojson',
      minio_path: geoRemotePath,
      size_bytes: fs.statSync(geoPath).size,
      sha256: sha256File(geoPath),
      content_type: 'application/geo+json',
    });

    // 6. Collect device logs
    const logsDir = path.join(outputDir, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, 'agent.log'), `[${new Date().toISOString()}] Drive run completed\n`);
    const logsZipPath = path.join(outputDir, 'device_logs.zip');
    try {
      execSync(`cd "${logsDir}" && zip -r "${logsZipPath}" . 2>/dev/null`, { timeout: 10000 });
    } catch {
      // zip not available, create a tar
      execSync(`cd "${logsDir}" && tar czf "${logsZipPath}.tar.gz" . 2>/dev/null`, { timeout: 10000 });
    }
    if (fs.existsSync(logsZipPath)) {
      const logsRemotePath = `/${config.campaign_id}/${config.route_id}/device_logs.zip`;
      await uploadFn(logsZipPath, logsRemotePath);
      artifacts.push({
        artifact_type: 'device_logs',
        filename: 'device_logs.zip',
        minio_path: logsRemotePath,
        size_bytes: fs.statSync(logsZipPath).size,
        sha256: sha256File(logsZipPath),
        content_type: 'application/zip',
      });
    }

    // 7. Compute summary
    const kpiAgg: Record<string, { sum: number; count: number; min: number; max: number }> = {};
    for (const r of allKpiResults) {
      if (!kpiAgg[r.kpi_name]) {
        kpiAgg[r.kpi_name] = { sum: r.value, count: 1, min: r.value, max: r.value };
      } else {
        kpiAgg[r.kpi_name].sum += r.value;
        kpiAgg[r.kpi_name].count++;
        kpiAgg[r.kpi_name].min = Math.min(kpiAgg[r.kpi_name].min, r.value);
        kpiAgg[r.kpi_name].max = Math.max(kpiAgg[r.kpi_name].max, r.value);
      }
    }

    const kpiAverages: Record<string, number> = {};
    const violations: DriveSummary['threshold_violations'] = [];
    for (const [kpi, agg] of Object.entries(kpiAgg)) {
      const avg = parseFloat((agg.sum / agg.count).toFixed(2));
      kpiAverages[kpi] = avg;
      if (config.kpi_thresholds[kpi] !== undefined) {
        const threshold = config.kpi_thresholds[kpi];
        const isLowerBetter = ['LATENCY', 'JITTER', 'PACKET_LOSS'].includes(kpi);
        const violated = isLowerBetter ? avg > threshold : avg < threshold;
        if (violated) {
          violations.push({ kpi_name: kpi, threshold, actual_avg: avg, direction: isLowerBetter ? 'above' : 'below' });
        }
      }
    }

    const summary: DriveSummary = {
      total_samples: allKpiResults.length,
      duration_sec: 0,
      distance_km: 0,
      kpi_averages: kpiAverages,
      threshold_violations: violations,
      overall_pass: violations.length === 0,
    };

    const summaryPath = path.join(outputDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    const summaryRemotePath = `/${config.campaign_id}/${config.route_id}/summary.json`;
    await uploadFn(summaryPath, summaryRemotePath);
    artifacts.push({
      artifact_type: 'summary',
      filename: 'summary.json',
      minio_path: summaryRemotePath,
      size_bytes: fs.statSync(summaryPath).size,
      sha256: sha256File(summaryPath),
      content_type: 'application/json',
    });

    return {
      status: summary.overall_pass ? 'DONE' : 'FAILED',
      artifacts,
      summary,
      error_message: summary.overall_pass ? undefined : `${violations.length} violation(s) de seuil KPI`,
    };
  } catch (err: any) {
    return {
      status: 'FAILED',
      artifacts,
      summary: { total_samples: 0, duration_sec: 0, distance_km: 0, kpi_averages: {}, threshold_violations: [], overall_pass: false },
      error_message: err.message || 'Erreur inconnue durant l\'exécution Drive',
    };
  }
}
