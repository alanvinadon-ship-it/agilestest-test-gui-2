/**
 * segmentation.ts — Segmentation de route, agrégation KPI par segment, classification breach
 * Mission DRIVE-CORRELATION-1
 */
import type { KpiSample, DriveKpi } from '../types';
import type {
  RouteSegment, SegmentKpiStats, EnrichedKpiSample,
  BreachLevel, SegmentationConfig, WindowSize,
} from './types';
import { DEFAULT_KPI_THRESHOLDS, DEFAULT_SEGMENTATION_CONFIG } from './types';

// ─── Geo Helpers ────────────────────────────────────────────────────────────

const R_EARTH = 6371000; // rayon terre en mètres

/** Distance Haversine entre deux points [lon, lat] en mètres */
export function haversineDistance(a: number[], b: number[]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const aVal = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

/** Trouver le segment le plus proche d'un point [lat, lon] */
function findNearestSegmentIndex(segments: RouteSegment[], lat: number, lon: number): number {
  let minDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < segments.length; i++) {
    const c = segments[i].center;
    const d = haversineDistance([lon, lat], [c.lon, c.lat]);
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Générer une window_key à partir d'un timestamp et d'une taille de fenêtre */
export function computeWindowKey(timestamp: string, windowSize: WindowSize): string {
  const ts = new Date(timestamp).getTime();
  const sizeMs = windowSize === '5s' ? 5000 : windowSize === '10s' ? 10000 : 30000;
  const bucket = Math.floor(ts / sizeMs) * sizeMs;
  return new Date(bucket).toISOString();
}

/** Générer un ID de segment déterministe */
function segmentId(routeId: string, index: number): string {
  return `seg-${routeId.slice(0, 8)}-${String(index).padStart(4, '0')}`;
}

// ─── Segmentation ───────────────────────────────────────────────────────────

/**
 * Découper une route (LineString coordinates) en segments de taille fixe.
 * Chaque segment contient ses coordonnées, son centre, sa longueur.
 */
export function segmentRoute(
  routeId: string,
  campaignId: string,
  coordinates: number[][],
  config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
): RouteSegment[] {
  if (!coordinates || coordinates.length < 2) return [];

  const segments: RouteSegment[] = [];
  let currentCoords: number[][] = [coordinates[0]];
  let currentLength = 0;
  let segIndex = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const dist = haversineDistance(coordinates[i - 1], coordinates[i]);
    currentLength += dist;
    currentCoords.push(coordinates[i]);

    if (currentLength >= config.segment_length_m || i === coordinates.length - 1) {
      // Calculer le centre
      const lats = currentCoords.map(c => c[1]);
      const lons = currentCoords.map(c => c[0]);
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const centerLon = lons.reduce((a, b) => a + b, 0) / lons.length;

      segments.push({
        segment_id: segmentId(routeId, segIndex),
        route_id: routeId,
        campaign_id: campaignId,
        index: segIndex,
        coordinates: [...currentCoords],
        center: { lat: centerLat, lon: centerLon },
        length_m: Math.round(currentLength),
        time_window: { start: '', end: '' }, // sera rempli par enrichSamples
        kpi_stats: {},
        breach_level: 'OK',
        sample_count: 0,
      });

      segIndex++;
      // Le dernier point du segment actuel est le premier du suivant
      currentCoords = [coordinates[i]];
      currentLength = 0;
    }
  }

  return segments;
}

// ─── Breach Classification ──────────────────────────────────────────────────

/** Classifier le niveau de breach d'une valeur KPI */
export function classifyBreach(
  kpiName: string,
  value: number,
  thresholds?: Record<string, { warn: number; crit: number; direction: 'higher_better' | 'lower_better' }>,
): BreachLevel {
  const t = (thresholds || DEFAULT_KPI_THRESHOLDS)[kpiName];
  if (!t) return 'OK';

  if (t.direction === 'higher_better') {
    if (value < t.crit) return 'CRIT';
    if (value < t.warn) return 'WARN';
    return 'OK';
  } else {
    if (value > t.crit) return 'CRIT';
    if (value > t.warn) return 'WARN';
    return 'OK';
  }
}

// ─── Enrichment ─────────────────────────────────────────────────────────────

/**
 * Enrichir les samples KPI avec segment_id, breach_level, window_key.
 * Retourne les samples enrichis et met à jour les segments in-place.
 */
export function enrichSamplesWithSegments(
  samples: KpiSample[],
  segments: RouteSegment[],
  config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
  thresholds?: Record<string, { warn: number; crit: number; direction: 'higher_better' | 'lower_better' }>,
): EnrichedKpiSample[] {
  if (segments.length === 0 || samples.length === 0) return [];

  const enriched: EnrichedKpiSample[] = [];
  // Bucket samples par segment
  const segmentSamples: Map<string, KpiSample[]> = new Map();

  for (const sample of samples) {
    const segIdx = findNearestSegmentIndex(segments, sample.lat, sample.lon);
    const seg = segments[segIdx];
    const breach = classifyBreach(sample.kpi_name, sample.value, thresholds);
    const windowKey = computeWindowKey(sample.timestamp, config.window_size);
    const t = (thresholds || DEFAULT_KPI_THRESHOLDS)[sample.kpi_name];

    enriched.push({
      sample_id: sample.sample_id,
      segment_id: seg.segment_id,
      breach_level: breach,
      window_key: windowKey,
      kpi_name: sample.kpi_name,
      value: sample.value,
      threshold: t?.warn ?? 0,
      lat: sample.lat,
      lon: sample.lon,
      timestamp: sample.timestamp,
    });

    if (!segmentSamples.has(seg.segment_id)) {
      segmentSamples.set(seg.segment_id, []);
    }
    segmentSamples.get(seg.segment_id)!.push(sample);
  }

  // Mettre à jour les segments avec les stats
  for (const seg of segments) {
    const segSamples = segmentSamples.get(seg.segment_id) || [];
    seg.sample_count = segSamples.length;

    if (segSamples.length > 0) {
      // Time window
      const timestamps = segSamples.map(s => new Date(s.timestamp).getTime());
      seg.time_window = {
        start: new Date(Math.min(...timestamps)).toISOString(),
        end: new Date(Math.max(...timestamps)).toISOString(),
      };
    }
  }

  return enriched;
}

/**
 * Agréger les KPI par segment et calculer les stats + breach_level.
 */
export function aggregateSegmentKpi(
  segments: RouteSegment[],
  enrichedSamples: EnrichedKpiSample[],
  thresholds?: Record<string, { warn: number; crit: number; direction: 'higher_better' | 'lower_better' }>,
): void {
  // Group samples by segment
  const bySegment: Map<string, EnrichedKpiSample[]> = new Map();
  for (const s of enrichedSamples) {
    if (!bySegment.has(s.segment_id)) bySegment.set(s.segment_id, []);
    bySegment.get(s.segment_id)!.push(s);
  }

  for (const seg of segments) {
    const segSamples = bySegment.get(seg.segment_id) || [];
    const kpiStats: Record<string, SegmentKpiStats> = {};

    // Group by KPI
    const byKpi: Map<string, EnrichedKpiSample[]> = new Map();
    for (const s of segSamples) {
      if (!byKpi.has(s.kpi_name)) byKpi.set(s.kpi_name, []);
      byKpi.get(s.kpi_name)!.push(s);
    }

    let worstBreach: BreachLevel = 'OK';

    for (const [kpiName, kpiSamples] of byKpi) {
      const values = kpiSamples.map(s => s.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const breachCount = kpiSamples.filter(s => s.breach_level !== 'OK').length;
      const breachPct = Math.round((breachCount / kpiSamples.length) * 100);
      const t = (thresholds || DEFAULT_KPI_THRESHOLDS)[kpiName];
      const kpiBreach = classifyBreach(kpiName, avg, thresholds);

      kpiStats[kpiName] = {
        kpi_name: kpiName as DriveKpi,
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2)),
        avg: parseFloat(avg.toFixed(2)),
        count: kpiSamples.length,
        unit: kpiSamples[0]?.kpi_name ? getKpiUnit(kpiName) : '',
        breach_pct: breachPct,
        breach_level: kpiBreach,
        threshold: t?.warn ?? 0,
      };

      // Worst breach
      if (kpiBreach === 'CRIT') worstBreach = 'CRIT';
      else if (kpiBreach === 'WARN' && worstBreach !== 'CRIT') worstBreach = 'WARN';
    }

    seg.kpi_stats = kpiStats;
    seg.breach_level = worstBreach;
  }
}

function getKpiUnit(kpiName: string): string {
  const units: Record<string, string> = {
    RSRP: 'dBm', RSRQ: 'dB', SINR: 'dB',
    THROUGHPUT_DL: 'Mbps', THROUGHPUT_UL: 'Mbps',
    LATENCY: 'ms', JITTER: 'ms', PACKET_LOSS: '%',
    ATTACH_SUCCESS: '%', DROP_CALL: '%', HANDOVER_SUCCESS: '%',
    VOLTE_MOS: 'MOS', VOLTE_SETUP_TIME: 'ms',
    DNS_RESOLUTION_TIME: 'ms', HTTP_RESPONSE_TIME: 'ms',
  };
  return units[kpiName] || '';
}
