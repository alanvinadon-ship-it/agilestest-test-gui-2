/**
 * autoIncidents.ts — Génération automatique d'incidents Drive (threshold breach) + déduplication
 * Mission DRIVE-CORRELATION-1
 */
import type { DriveKpi } from '../types';
import type {
  RouteSegment, EnrichedKpiSample, ArtifactTimeIndex,
  DriveIncident, DriveIncidentSeverity, AutoIncidentConfig,
} from './types';
import { DEFAULT_AUTO_INCIDENT_CONFIG, DEFAULT_KPI_THRESHOLDS } from './types';
import { findArtifactsForSegment } from './artifactIndex';

let incidentCounter = 0;
function uid(): string {
  incidentCounter++;
  return `dinc-${Date.now().toString(36)}-${incidentCounter.toString(36).padStart(4, '0')}`;
}

// ─── Severity Mapping ───────────────────────────────────────────────────────

function mapSeverity(
  breachLevel: 'WARN' | 'CRIT',
  breachPct: number,
  config: AutoIncidentConfig,
): DriveIncidentSeverity {
  if (breachLevel === 'CRIT') {
    return breachPct >= config.crit_threshold_pct ? 'P0' : 'P1';
  }
  return breachPct >= config.warn_threshold_pct ? 'P1' : 'P2';
}

// ─── Generate Drive Incidents ───────────────────────────────────────────────

/**
 * Générer des incidents Drive à partir des segments en breach.
 * Un incident est créé par KPI en violation par segment (ou groupe de segments contigus).
 */
export function generateDriveIncidents(
  segments: RouteSegment[],
  enrichedSamples: EnrichedKpiSample[],
  artifactIndex: ArtifactTimeIndex[],
  campaignId: string,
  routeId: string,
  jobId?: string,
  config: AutoIncidentConfig = DEFAULT_AUTO_INCIDENT_CONFIG,
): DriveIncident[] {
  if (!config.enabled) return [];

  const incidents: DriveIncident[] = [];
  const now = new Date().toISOString();

  // Collecter les KPI en breach par segment
  for (const seg of segments) {
    if (seg.breach_level === 'OK') continue;

    for (const [kpiName, stats] of Object.entries(seg.kpi_stats)) {
      if (stats.breach_level === 'OK') continue;

      // Trouver les samples en breach pour ce segment + KPI
      const segSamples = enrichedSamples.filter(
        s => s.segment_id === seg.segment_id && s.kpi_name === kpiName && s.breach_level !== 'OK'
      );

      if (segSamples.length === 0) continue;

      // Trouver les artefacts liés
      const relatedArtifacts = findArtifactsForSegment(artifactIndex, seg);

      // Calculer la bbox
      const lats = segSamples.map(s => s.lat);
      const lons = segSamples.map(s => s.lon);

      const severity = mapSeverity(stats.breach_level, stats.breach_pct, config);
      const t = DEFAULT_KPI_THRESHOLDS[kpiName];

      incidents.push({
        incident_id: uid(),
        campaign_id: campaignId,
        route_id: routeId,
        drive_job_id: jobId,
        type: 'DRIVE_KPI_THRESHOLD_BREACH',
        kpi_name: kpiName as DriveKpi,
        threshold: stats.threshold,
        observed_min: stats.min,
        observed_max: stats.max,
        observed_avg: stats.avg,
        geo_bbox: {
          min_lat: Math.min(...lats),
          min_lon: Math.min(...lons),
          max_lat: Math.max(...lats),
          max_lon: Math.max(...lons),
        },
        geo_point: seg.center,
        time_window: seg.time_window,
        severity,
        evidence_refs: {
          artifact_ids: relatedArtifacts.map(a => a.artifact_id),
          sample_ids: segSamples.map(s => s.sample_id),
          segment_ids: [seg.segment_id],
        },
        segment_count: 1,
        breach_pct: stats.breach_pct,
        status: 'OPEN',
        created_at: now,
        updated_at: now,
      });
    }
  }

  return incidents;
}

// ─── Deduplication ──────────────────────────────────────────────────────────

/**
 * Dédupliquer les incidents : ne pas recréer si un incident similaire existe
 * (même KPI + même segment + fenêtre temporelle qui se chevauche).
 */
export function deduplicateIncidents(
  newIncidents: DriveIncident[],
  existingIncidents: DriveIncident[],
  config: AutoIncidentConfig = DEFAULT_AUTO_INCIDENT_CONFIG,
): DriveIncident[] {
  const dedupWindowMs = config.dedup_window_sec * 1000;

  return newIncidents.filter(newInc => {
    const isDuplicate = existingIncidents.some(existing => {
      // Même KPI
      if (existing.kpi_name !== newInc.kpi_name) return false;
      // Même route
      if (existing.route_id !== newInc.route_id) return false;
      // Segments qui se chevauchent
      const segOverlap = existing.evidence_refs.segment_ids.some(
        sid => newInc.evidence_refs.segment_ids.includes(sid)
      );
      if (!segOverlap) return false;
      // Fenêtre temporelle qui se chevauche (avec marge)
      const existStart = new Date(existing.time_window.start).getTime() - dedupWindowMs;
      const existEnd = new Date(existing.time_window.end).getTime() + dedupWindowMs;
      const newStart = new Date(newInc.time_window.start).getTime();
      const newEnd = new Date(newInc.time_window.end).getTime();
      return newStart <= existEnd && newEnd >= existStart;
    });
    return !isDuplicate;
  });
}

// ─── Merge Contiguous Segments ──────────────────────────────────────────────

/**
 * Fusionner les incidents sur des segments contigus pour le même KPI.
 * Réduit le bruit en regroupant les violations adjacentes.
 */
export function mergeContiguousIncidents(incidents: DriveIncident[]): DriveIncident[] {
  if (incidents.length <= 1) return incidents;

  // Grouper par KPI + route
  const groups: Map<string, DriveIncident[]> = new Map();
  for (const inc of incidents) {
    const key = `${inc.route_id}:${inc.kpi_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(inc);
  }

  const merged: DriveIncident[] = [];

  for (const [, group] of groups) {
    if (group.length <= 1) {
      merged.push(...group);
      continue;
    }

    // Trier par time_window.start
    group.sort((a, b) => new Date(a.time_window.start).getTime() - new Date(b.time_window.start).getTime());

    let current = { ...group[0] };
    for (let i = 1; i < group.length; i++) {
      const next = group[i];
      // Vérifier si contigu (segments adjacents)
      const currentSegIds = current.evidence_refs.segment_ids;
      const nextSegIds = next.evidence_refs.segment_ids;
      const lastCurrentIdx = parseInt(currentSegIds[currentSegIds.length - 1].split('-').pop() || '0');
      const firstNextIdx = parseInt(nextSegIds[0].split('-').pop() || '0');

      if (firstNextIdx - lastCurrentIdx <= 1) {
        // Fusionner
        current = {
          ...current,
          observed_min: Math.min(current.observed_min, next.observed_min),
          observed_max: Math.max(current.observed_max, next.observed_max),
          observed_avg: (current.observed_avg * current.segment_count + next.observed_avg * next.segment_count) / (current.segment_count + next.segment_count),
          geo_bbox: {
            min_lat: Math.min(current.geo_bbox.min_lat, next.geo_bbox.min_lat),
            min_lon: Math.min(current.geo_bbox.min_lon, next.geo_bbox.min_lon),
            max_lat: Math.max(current.geo_bbox.max_lat, next.geo_bbox.max_lat),
            max_lon: Math.max(current.geo_bbox.max_lon, next.geo_bbox.max_lon),
          },
          time_window: {
            start: current.time_window.start,
            end: next.time_window.end,
          },
          severity: current.severity === 'P0' || next.severity === 'P0' ? 'P0' : current.severity === 'P1' || next.severity === 'P1' ? 'P1' : 'P2',
          evidence_refs: {
            artifact_ids: [...new Set([...current.evidence_refs.artifact_ids, ...next.evidence_refs.artifact_ids])],
            sample_ids: [...current.evidence_refs.sample_ids, ...next.evidence_refs.sample_ids],
            segment_ids: [...current.evidence_refs.segment_ids, ...next.evidence_refs.segment_ids],
          },
          segment_count: current.segment_count + next.segment_count,
          breach_pct: Math.round((current.breach_pct * current.segment_count + next.breach_pct * next.segment_count) / (current.segment_count + next.segment_count)),
          updated_at: new Date().toISOString(),
        };
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
  }

  return merged;
}
