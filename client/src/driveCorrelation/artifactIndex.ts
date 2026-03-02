/**
 * artifactIndex.ts — Index temporel des artefacts et linking avec segments
 * Mission DRIVE-CORRELATION-1
 */
import type { DriveArtifactEntry, DriveJob, Artifact } from '../types';
import type { ArtifactTimeIndex, ArtifactSource, RouteSegment } from './types';

// ─── Build Artifact Time Index ──────────────────────────────────────────────

/**
 * Construire un index temporel à partir des artefacts d'un DriveJob.
 * Estime start_ts/end_ts si non disponibles.
 */
export function buildArtifactTimeIndex(
  job: DriveJob,
  campaignId: string,
  routeId: string,
  captureSessions?: Array<{ session_id: string; artifacts: Array<{ artifact_id: string; filename: string; size_bytes: number; minio_path: string }>; start_time: string; end_time?: string; probe_id: string }>,
): ArtifactTimeIndex[] {
  const index: ArtifactTimeIndex[] = [];

  // 1) Artefacts du manifest du job (source RUNNER)
  if (job.artifacts_manifest) {
    for (const entry of job.artifacts_manifest) {
      const isPcap = entry.artifact_type === 'pcap';
      const isLog = entry.artifact_type === 'device_logs';
      if (!isPcap && !isLog) continue;

      index.push({
        artifact_id: `art-${job.drive_job_id}-${entry.filename}`,
        source: 'RUNNER',
        start_ts: job.started_at || job.created_at,
        end_ts: job.finished_at || new Date().toISOString(),
        tags: {
          project_id: undefined,
          campaign_id: campaignId,
          route_id: routeId,
          device_id: job.device_id,
          drive_job_id: job.drive_job_id,
        },
        filename: entry.filename,
        size_bytes: entry.size_bytes,
        type: isPcap ? 'PCAP' : 'DEVICE_LOGS',
        minio_path: entry.minio_path,
        download_url: `/api/v1/artifacts/download?path=${encodeURIComponent(entry.minio_path)}`,
      });
    }
  }

  // 2) Artefacts des sessions de capture probe (source PROBE)
  if (captureSessions) {
    for (const session of captureSessions) {
      for (const art of session.artifacts) {
        index.push({
          artifact_id: art.artifact_id,
          source: 'PROBE',
          start_ts: session.start_time,
          end_ts: session.end_time || new Date().toISOString(),
          tags: {
            campaign_id: campaignId,
            route_id: routeId,
            session_id: session.session_id,
            drive_job_id: job.drive_job_id,
          },
          filename: art.filename,
          size_bytes: art.size_bytes,
          type: 'PCAP',
          minio_path: art.minio_path,
          download_url: `/api/v1/artifacts/download?path=${encodeURIComponent(art.minio_path)}`,
        });
      }
    }
  }

  return index;
}

/**
 * Construire un index à partir des artefacts Artifact[] existants.
 */
export function buildArtifactTimeIndexFromArtifacts(
  artifacts: Artifact[],
  campaignId: string,
  routeId: string,
  jobId: string,
): ArtifactTimeIndex[] {
  return artifacts
    .filter(a => a.type === 'PCAP' || a.type === 'DEVICE_LOGS' || a.type === 'LOG')
    .map(a => ({
      artifact_id: a.id,
      source: 'RUNNER' as ArtifactSource,
      start_ts: a.created_at,
      end_ts: a.created_at, // estimation
      tags: {
        campaign_id: campaignId,
        route_id: routeId,
        drive_job_id: jobId,
      },
      filename: a.filename,
      size_bytes: a.size_bytes,
      type: a.type,
      minio_path: a.storage_path || undefined,
      download_url: a.download_url || undefined,
    }));
}

// ─── Find Artifacts in Time Window ──────────────────────────────────────────

/**
 * Trouver les artefacts dont la fenêtre temporelle chevauche une fenêtre donnée.
 * @param delta_ms Marge temporelle en ms (par défaut 30s)
 */
export function findArtifactsInWindow(
  artifactIndex: ArtifactTimeIndex[],
  windowStart: string,
  windowEnd: string,
  delta_ms: number = 30000,
  filterTags?: Partial<ArtifactTimeIndex['tags']>,
): ArtifactTimeIndex[] {
  const wStart = new Date(windowStart).getTime() - delta_ms;
  const wEnd = new Date(windowEnd).getTime() + delta_ms;

  return artifactIndex.filter(art => {
    const artStart = new Date(art.start_ts).getTime();
    const artEnd = new Date(art.end_ts).getTime();

    // Chevauchement temporel
    const overlaps = artStart <= wEnd && artEnd >= wStart;
    if (!overlaps) return false;

    // Filtre par tags
    if (filterTags) {
      if (filterTags.campaign_id && art.tags.campaign_id !== filterTags.campaign_id) return false;
      if (filterTags.route_id && art.tags.route_id !== filterTags.route_id) return false;
      if (filterTags.drive_job_id && art.tags.drive_job_id !== filterTags.drive_job_id) return false;
      if (filterTags.device_id && art.tags.device_id !== filterTags.device_id) return false;
      if (filterTags.session_id && art.tags.session_id !== filterTags.session_id) return false;
    }

    return true;
  });
}

/**
 * Trouver les artefacts liés à un segment de route.
 */
export function findArtifactsForSegment(
  artifactIndex: ArtifactTimeIndex[],
  segment: RouteSegment,
  delta_ms: number = 30000,
): ArtifactTimeIndex[] {
  if (!segment.time_window.start || !segment.time_window.end) return [];
  return findArtifactsInWindow(
    artifactIndex,
    segment.time_window.start,
    segment.time_window.end,
    delta_ms,
    { campaign_id: segment.campaign_id, route_id: segment.route_id },
  );
}
