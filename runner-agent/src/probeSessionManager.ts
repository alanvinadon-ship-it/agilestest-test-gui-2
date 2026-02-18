/**
 * probeSessionManager.ts — Mode B : Gestion des sessions de capture via Probe SPAN/TAP
 *
 * Le runner orchestre la capture en envoyant des commandes à l'agent probe distant.
 * Le probe exécute tcpdump localement et upload les PCAP vers MinIO.
 *
 * Flow :
 *   1) POST /api/v1/probes/{probe_id}/sessions — Créer une session
 *   2) POST /api/v1/probes/{probe_id}/sessions/{session_id}/start — Démarrer la capture
 *   3) (exécution du test en parallèle)
 *   4) POST /api/v1/probes/{probe_id}/sessions/{session_id}/stop — Arrêter la capture
 *   5) GET /api/v1/probes/{probe_id}/sessions/{session_id} — Récupérer le manifest PCAP
 */

import axios, { AxiosInstance } from 'axios';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ProbeSpanTapConfig {
  probe_id: string;
  iface: string;
  vlan_filter?: number;
  bpf_filter: string;
  rotate_mb: number;
  enabled: boolean;
}

export interface ProbeSessionArtifact {
  filename: string;
  minio_path: string;
  size_bytes: number;
  sha256: string;
}

export interface ProbeSession {
  session_id: string;
  probe_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  iface: string;
  bpf_filter: string;
  vlan_filter?: number;
  started_at?: string;
  stopped_at?: string;
  artifacts: ProbeSessionArtifact[];
  error_message?: string;
}

export interface ProbeStatus {
  probe_id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  last_heartbeat: string;
  capabilities: string[];
}

// ─── Probe Session Manager ──────────────────────────────────────────────

export class ProbeSessionManager {
  private api: AxiosInstance;
  private activeSession: ProbeSession | null = null;

  constructor(orchestrationUrl: string, runnerId: string) {
    this.api = axios.create({
      baseURL: orchestrationUrl,
      timeout: 30000,
      headers: {
        'X-Runner-ID': runnerId,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Vérifie que la probe est en ligne et prête
   */
  async checkProbeStatus(probeId: string): Promise<ProbeStatus> {
    console.log(`[PROBE] Checking status of probe ${probeId}...`);
    try {
      const res = await this.api.get(`/api/v1/probes/${probeId}/status`);
      const status = res.data?.data as ProbeStatus;
      console.log(`[PROBE] ${probeId} → ${status.status} (last heartbeat: ${status.last_heartbeat})`);
      return status;
    } catch (err: any) {
      console.error(`[PROBE] Failed to check probe ${probeId}: ${err.message}`);
      throw new Error(`Probe ${probeId} unreachable: ${err.message}`);
    }
  }

  /**
   * Valide la configuration probe avant démarrage
   */
  validateConfig(config: ProbeSpanTapConfig): string[] {
    const errors: string[] = [];

    if (!config.enabled) {
      errors.push('Probe SPAN/TAP capture is disabled');
    }
    if (!config.probe_id || config.probe_id.trim() === '') {
      errors.push('probe_id is required');
    }
    if (!config.iface || config.iface.trim() === '') {
      errors.push('Network interface (iface) is required');
    }
    if (config.rotate_mb < 1) {
      errors.push('rotate_mb must be >= 1 MB');
    }

    return errors;
  }

  /**
   * Crée et démarre une session de capture sur la probe distante
   */
  async startCaptureSession(
    config: ProbeSpanTapConfig,
    executionId: string,
    projectId: string,
    campaignId?: string,
    driveJobId?: string
  ): Promise<ProbeSession> {
    // Validate config
    const errors = this.validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`Probe config validation failed: ${errors.join('; ')}`);
    }

    console.log(`[PROBE] Creating capture session on probe ${config.probe_id}...`);

    try {
      // 1. Create session
      const createRes = await this.api.post(`/api/v1/probes/${config.probe_id}/sessions`, {
        execution_id: executionId,
        project_id: projectId,
        campaign_id: campaignId,
        drive_job_id: driveJobId,
        iface: config.iface,
        bpf_filter: config.bpf_filter,
        vlan_filter: config.vlan_filter,
        rotate_mb: config.rotate_mb,
      });

      const session = createRes.data?.data as ProbeSession;
      console.log(`[PROBE] Session created: ${session.session_id}`);

      // 2. Start capture
      const startRes = await this.api.post(
        `/api/v1/probes/${config.probe_id}/sessions/${session.session_id}/start`
      );

      this.activeSession = startRes.data?.data as ProbeSession;
      console.log(`[PROBE] Capture started on ${config.iface} (session=${session.session_id})`);

      return this.activeSession;

    } catch (err: any) {
      console.error(`[PROBE] Failed to start capture: ${err.message}`);
      throw new Error(`Probe capture start failed: ${err.message}`);
    }
  }

  /**
   * Arrête la session de capture active
   */
  async stopCaptureSession(): Promise<ProbeSession | null> {
    if (!this.activeSession) {
      console.log('[PROBE] No active capture session to stop');
      return null;
    }

    const { session_id, probe_id } = this.activeSession;
    console.log(`[PROBE] Stopping capture session ${session_id}...`);

    try {
      const res = await this.api.post(
        `/api/v1/probes/${probe_id}/sessions/${session_id}/stop`
      );

      this.activeSession = res.data?.data as ProbeSession;
      console.log(`[PROBE] Capture stopped. ${this.activeSession.artifacts.length} PCAP artifact(s)`);

      return this.activeSession;

    } catch (err: any) {
      console.error(`[PROBE] Failed to stop capture: ${err.message}`);
      // Try to get session status anyway
      try {
        const statusRes = await this.api.get(
          `/api/v1/probes/${probe_id}/sessions/${session_id}`
        );
        this.activeSession = statusRes.data?.data as ProbeSession;
      } catch { /* ignore */ }

      return this.activeSession;
    }
  }

  /**
   * Récupère le statut d'une session
   */
  async getSessionStatus(probeId: string, sessionId: string): Promise<ProbeSession> {
    const res = await this.api.get(
      `/api/v1/probes/${probeId}/sessions/${sessionId}`
    );
    return res.data?.data as ProbeSession;
  }

  /**
   * Annule une session de capture (en cas d'erreur)
   */
  async cancelSession(): Promise<void> {
    if (!this.activeSession) return;

    const { session_id, probe_id } = this.activeSession;
    console.log(`[PROBE] Cancelling session ${session_id}...`);

    try {
      await this.api.post(
        `/api/v1/probes/${probe_id}/sessions/${session_id}/cancel`
      );
    } catch (err: any) {
      console.warn(`[PROBE] Cancel failed (may already be stopped): ${err.message}`);
    }

    this.activeSession = null;
  }

  /**
   * Retourne les artefacts PCAP de la session active
   * (déjà uploadés par la probe vers MinIO)
   */
  getArtifacts(): ProbeSessionArtifact[] {
    return this.activeSession?.artifacts || [];
  }

  /**
   * Convertit les artefacts probe en format manifest S3
   */
  getArtifactManifest(): Array<{
    type: string;
    filename: string;
    s3_key: string;
    s3_uri: string;
    size_bytes: number;
    mime_type: string;
    checksum: string | null;
    download_url: string;
  }> {
    const bucket = process.env.MINIO_BUCKET || 'agilestest-artifacts';
    const endpoint = `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`;

    return this.getArtifacts().map(art => ({
      type: 'PCAP',
      filename: art.filename,
      s3_key: art.minio_path,
      s3_uri: `s3://${bucket}/${art.minio_path}`,
      size_bytes: art.size_bytes,
      mime_type: 'application/vnd.tcpdump.pcap',
      checksum: art.sha256,
      download_url: `${endpoint}/${bucket}/${art.minio_path}`,
    }));
  }

  /**
   * Réinitialise l'état (entre deux jobs)
   */
  reset(): void {
    this.activeSession = null;
  }
}
