/**
 * kpiParsers.ts — Parsers côté frontend pour l'import de résultats Drive Test.
 * Supporte : CSV, JSON, GPX, GeoJSON, iperf3 JSON.
 * Chaque parser retourne un tableau de KpiSampleInput prêt à être inséré via localStore.
 */

import type { DriveKpi } from '../types';

export interface KpiSampleInput {
  drive_job_id: string;
  campaign_id: string;
  route_id: string;
  timestamp: string;
  lat: number;
  lon: number;
  kpi_name: DriveKpi;
  value: number;
  unit: string;
  cell_id?: string;
  technology?: string;
}

export type ImportFormat = 'CSV' | 'JSON' | 'GPX' | 'GEOJSON' | 'IPERF3';

// ─── KPI Name Normalization ─────────────────────────────────────────────────

const KPI_ALIASES: Record<string, DriveKpi> = {
  rsrp: 'RSRP', rsrq: 'RSRQ', sinr: 'SINR',
  throughput_dl: 'THROUGHPUT_DL', throughput_ul: 'THROUGHPUT_UL',
  dl_throughput: 'THROUGHPUT_DL', ul_throughput: 'THROUGHPUT_UL',
  download: 'THROUGHPUT_DL', upload: 'THROUGHPUT_UL',
  latency: 'LATENCY', rtt: 'LATENCY', ping: 'LATENCY',
  jitter: 'JITTER', packet_loss: 'PACKET_LOSS', loss: 'PACKET_LOSS',
  attach_success: 'ATTACH_SUCCESS', drop_call: 'DROP_CALL',
  handover_success: 'HANDOVER_SUCCESS',
  volte_mos: 'VOLTE_MOS', volte_setup_time: 'VOLTE_SETUP_TIME',
  dns_resolution_time: 'DNS_RESOLUTION_TIME', http_response_time: 'HTTP_RESPONSE_TIME',
};

const VALID_KPIS = new Set<string>([
  'RSRP', 'RSRQ', 'SINR', 'THROUGHPUT_DL', 'THROUGHPUT_UL',
  'LATENCY', 'JITTER', 'PACKET_LOSS', 'ATTACH_SUCCESS', 'DROP_CALL',
  'HANDOVER_SUCCESS', 'VOLTE_MOS', 'VOLTE_SETUP_TIME',
  'DNS_RESOLUTION_TIME', 'HTTP_RESPONSE_TIME',
]);

function normalizeKpiName(name: string): DriveKpi | null {
  const upper = name.toUpperCase().trim();
  if (VALID_KPIS.has(upper)) return upper as DriveKpi;
  const lower = name.toLowerCase().trim();
  return KPI_ALIASES[lower] || null;
}

const KPI_UNITS: Record<string, string> = {
  RSRP: 'dBm', RSRQ: 'dB', SINR: 'dB',
  THROUGHPUT_DL: 'Mbps', THROUGHPUT_UL: 'Mbps',
  LATENCY: 'ms', JITTER: 'ms', PACKET_LOSS: '%',
  ATTACH_SUCCESS: '%', DROP_CALL: '%', HANDOVER_SUCCESS: '%',
  VOLTE_MOS: 'MOS', VOLTE_SETUP_TIME: 'ms',
  DNS_RESOLUTION_TIME: 'ms', HTTP_RESPONSE_TIME: 'ms',
};

// ─── Threshold Coloring ─────────────────────────────────────────────────────

export type ThresholdLevel = 'good' | 'warning' | 'critical';

/** Détermine le niveau de couleur d'un KPI par rapport à son seuil */
export function getThresholdLevel(kpiName: string, value: number, threshold: number): ThresholdLevel {
  const isLowerBetter = ['LATENCY', 'JITTER', 'PACKET_LOSS', 'DROP_CALL', 'DNS_RESOLUTION_TIME', 'HTTP_RESPONSE_TIME', 'VOLTE_SETUP_TIME'].includes(kpiName);

  if (isLowerBetter) {
    if (value <= threshold) return 'good';
    if (value <= threshold * 1.5) return 'warning';
    return 'critical';
  } else {
    if (value >= threshold) return 'good';
    if (value >= threshold * 0.7) return 'warning';
    return 'critical';
  }
}

export const THRESHOLD_COLORS: Record<ThresholdLevel, string> = {
  good: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
};

export const THRESHOLD_BG_COLORS: Record<ThresholdLevel, string> = {
  good: 'rgba(34, 197, 94, 0.1)',
  warning: 'rgba(245, 158, 11, 0.1)',
  critical: 'rgba(239, 68, 68, 0.1)',
};

// ─── CSV Parser ─────────────────────────────────────────────────────────────

export function parseCsv(
  content: string,
  meta: { drive_job_id: string; campaign_id: string; route_id: string }
): { samples: KpiSampleInput[]; errors: string[] } {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return { samples: [], errors: ['Fichier CSV vide ou sans données'] };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const tsIdx = findIndex(headers, ['timestamp', 'time', 'date', 'ts']);
  const latIdx = findIndex(headers, ['lat', 'latitude']);
  const lonIdx = findIndex(headers, ['lon', 'lng', 'longitude']);
  const kpiIdx = findIndex(headers, ['kpi_name', 'kpi', 'metric', 'indicator']);
  const valIdx = findIndex(headers, ['value', 'val', 'measure']);
  const unitIdx = findIndex(headers, ['unit', 'units']);
  const cellIdx = findIndex(headers, ['cell_id', 'cellid', 'cell']);

  if (valIdx === -1) return { samples: [], errors: ['Colonne "value" introuvable dans le CSV'] };

  const samples: KpiSampleInput[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(',').map(c => c.trim());
    const rawKpi = kpiIdx !== -1 ? cols[kpiIdx] : '';
    const kpiName = normalizeKpiName(rawKpi);
    if (!kpiName) {
      errors.push(`Ligne ${i + 1}: KPI "${rawKpi}" non reconnu`);
      continue;
    }
    const value = parseFloat(cols[valIdx]);
    if (isNaN(value)) {
      errors.push(`Ligne ${i + 1}: valeur "${cols[valIdx]}" invalide`);
      continue;
    }

    samples.push({
      ...meta,
      timestamp: tsIdx !== -1 ? (cols[tsIdx] || new Date().toISOString()) : new Date().toISOString(),
      lat: latIdx !== -1 ? (parseFloat(cols[latIdx]) || 0) : 0,
      lon: lonIdx !== -1 ? (parseFloat(cols[lonIdx]) || 0) : 0,
      kpi_name: kpiName,
      value,
      unit: unitIdx !== -1 ? (cols[unitIdx] || KPI_UNITS[kpiName] || '') : (KPI_UNITS[kpiName] || ''),
      cell_id: cellIdx !== -1 ? cols[cellIdx] : undefined,
    });
  }

  return { samples, errors };
}

// ─── JSON Parser ────────────────────────────────────────────────────────────

export function parseJson(
  content: string,
  meta: { drive_job_id: string; campaign_id: string; route_id: string }
): { samples: KpiSampleInput[]; errors: string[] } {
  const errors: string[] = [];
  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    return { samples: [], errors: ['JSON invalide'] };
  }

  const items = Array.isArray(data) ? data : (data.samples || data.data || data.results || []);
  if (!Array.isArray(items)) return { samples: [], errors: ['Structure JSON non reconnue (attendu: tableau ou {samples: []})'] };

  const samples: KpiSampleInput[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const kpiName = normalizeKpiName(item.kpi_name || item.kpi || item.metric || '');
    if (!kpiName) {
      errors.push(`Entrée ${i}: KPI "${item.kpi_name || item.kpi}" non reconnu`);
      continue;
    }
    const value = parseFloat(item.value ?? item.val ?? item.measure);
    if (isNaN(value)) {
      errors.push(`Entrée ${i}: valeur invalide`);
      continue;
    }
    samples.push({
      ...meta,
      timestamp: item.timestamp || item.time || item.ts || new Date().toISOString(),
      lat: parseFloat(item.lat || item.latitude) || 0,
      lon: parseFloat(item.lon || item.lng || item.longitude) || 0,
      kpi_name: kpiName,
      value,
      unit: item.unit || KPI_UNITS[kpiName] || '',
      cell_id: item.cell_id || item.cellId || undefined,
      technology: item.technology || item.tech || undefined,
    });
  }

  return { samples, errors };
}

// ─── GPX Parser ─────────────────────────────────────────────────────────────

export function parseGpx(
  content: string,
  meta: { drive_job_id: string; campaign_id: string; route_id: string },
  defaultKpi: DriveKpi = 'RSRP'
): { samples: KpiSampleInput[]; errors: string[] } {
  const errors: string[] = [];
  const samples: KpiSampleInput[] = [];

  // Parse GPX trackpoints
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  let match;
  while ((match = trkptRegex.exec(content)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const inner = match[3];

    const timeMatch = inner.match(/<time>([^<]+)<\/time>/);
    const timestamp = timeMatch ? timeMatch[1] : new Date().toISOString();

    // Check for extensions with KPI data
    const extMatch = inner.match(/<extensions>([\s\S]*?)<\/extensions>/);
    if (extMatch) {
      const ext = extMatch[1];
      // Try to extract KPI values from extensions
      const kpiMatches = ext.matchAll(/<(\w+)>([^<]+)<\/\1>/g);
      for (const km of kpiMatches) {
        const kpiName = normalizeKpiName(km[1]);
        const value = parseFloat(km[2]);
        if (kpiName && !isNaN(value)) {
          samples.push({ ...meta, timestamp, lat, lon, kpi_name: kpiName, value, unit: KPI_UNITS[kpiName] || '' });
        }
      }
    } else {
      // No extensions, just record position with default KPI
      samples.push({ ...meta, timestamp, lat, lon, kpi_name: defaultKpi, value: 0, unit: KPI_UNITS[defaultKpi] || '' });
    }
  }

  if (samples.length === 0) errors.push('Aucun trackpoint trouvé dans le fichier GPX');
  return { samples, errors };
}

// ─── GeoJSON Parser ─────────────────────────────────────────────────────────

export function parseGeoJson(
  content: string,
  meta: { drive_job_id: string; campaign_id: string; route_id: string }
): { samples: KpiSampleInput[]; errors: string[] } {
  const errors: string[] = [];
  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    return { samples: [], errors: ['GeoJSON invalide'] };
  }

  const features = data.type === 'FeatureCollection' ? data.features : (data.type === 'Feature' ? [data] : []);
  if (!Array.isArray(features)) return { samples: [], errors: ['Structure GeoJSON non reconnue'] };

  const samples: KpiSampleInput[] = [];
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    if (!f.geometry || !f.properties) continue;

    const coords = f.geometry.type === 'Point' ? f.geometry.coordinates : null;
    if (!coords) continue;

    const lon = coords[0];
    const lat = coords[1];
    const props = f.properties;

    const kpiName = normalizeKpiName(props.kpi_name || props.kpi || props.metric || '');
    if (!kpiName) {
      errors.push(`Feature ${i}: KPI non reconnu`);
      continue;
    }
    const value = parseFloat(props.value ?? props.val);
    if (isNaN(value)) {
      errors.push(`Feature ${i}: valeur invalide`);
      continue;
    }

    samples.push({
      ...meta,
      timestamp: props.timestamp || props.time || new Date().toISOString(),
      lat, lon,
      kpi_name: kpiName,
      value,
      unit: props.unit || KPI_UNITS[kpiName] || '',
      cell_id: props.cell_id || undefined,
      technology: props.technology || undefined,
    });
  }

  return { samples, errors };
}

// ─── iperf3 JSON Parser ─────────────────────────────────────────────────────

export function parseIperf3(
  content: string,
  meta: { drive_job_id: string; campaign_id: string; route_id: string }
): { samples: KpiSampleInput[]; errors: string[] } {
  const errors: string[] = [];
  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    return { samples: [], errors: ['JSON iperf3 invalide'] };
  }

  const samples: KpiSampleInput[] = [];
  const intervals = data.intervals || [];

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const sum = interval.sum || interval.streams?.[0];
    if (!sum) continue;

    const ts = new Date(Date.now() - (intervals.length - i) * 1000).toISOString();

    if (sum.bits_per_second !== undefined) {
      const mbps = sum.bits_per_second / 1e6;
      const kpi: DriveKpi = sum.sender ? 'THROUGHPUT_UL' : 'THROUGHPUT_DL';
      samples.push({ ...meta, timestamp: ts, lat: 0, lon: 0, kpi_name: kpi, value: parseFloat(mbps.toFixed(2)), unit: 'Mbps' });
    }
    if (sum.jitter_ms !== undefined) {
      samples.push({ ...meta, timestamp: ts, lat: 0, lon: 0, kpi_name: 'JITTER', value: parseFloat(sum.jitter_ms.toFixed(2)), unit: 'ms' });
    }
    if (sum.lost_percent !== undefined) {
      samples.push({ ...meta, timestamp: ts, lat: 0, lon: 0, kpi_name: 'PACKET_LOSS', value: parseFloat(sum.lost_percent.toFixed(2)), unit: '%' });
    }
  }

  // End summary
  if (data.end?.sum_received?.bits_per_second) {
    const mbps = data.end.sum_received.bits_per_second / 1e6;
    samples.push({ ...meta, timestamp: new Date().toISOString(), lat: 0, lon: 0, kpi_name: 'THROUGHPUT_DL', value: parseFloat(mbps.toFixed(2)), unit: 'Mbps' });
  }

  if (samples.length === 0) errors.push('Aucun intervalle trouvé dans le fichier iperf3');
  return { samples, errors };
}

// ─── Auto-detect and parse ──────────────────────────────────────────────────

export function detectFormat(filename: string, content: string): ImportFormat {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (ext === 'csv') return 'CSV';
  if (ext === 'gpx') return 'GPX';
  if (ext === 'geojson') return 'GEOJSON';
  if (ext === 'json') {
    try {
      const data = JSON.parse(content);
      if (data.intervals) return 'IPERF3';
      if (data.type === 'FeatureCollection' || data.type === 'Feature') return 'GEOJSON';
      return 'JSON';
    } catch {
      return 'JSON';
    }
  }
  return 'CSV'; // fallback
}

export function parseFile(
  content: string,
  format: ImportFormat,
  meta: { drive_job_id: string; campaign_id: string; route_id: string }
): { samples: KpiSampleInput[]; errors: string[] } {
  switch (format) {
    case 'CSV': return parseCsv(content, meta);
    case 'JSON': return parseJson(content, meta);
    case 'GPX': return parseGpx(content, meta);
    case 'GEOJSON': return parseGeoJson(content, meta);
    case 'IPERF3': return parseIperf3(content, meta);
    default: return { samples: [], errors: [`Format "${format}" non supporté`] };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findIndex(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx !== -1) return idx;
  }
  return -1;
}
