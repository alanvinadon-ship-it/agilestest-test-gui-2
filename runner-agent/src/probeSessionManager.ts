/**
 * probeSessionManager.ts — Mode B : Gestion des sessions de capture via Probe SPAN/TAP
 * 
 * PROBE-HARDEN-1 : Version durcie pour usage industriel Orange
 * - Auth token (X-PROBE-TOKEN) obligatoire
 * - Start/stop idempotents
 * - No-packets detection (timeout configurable)
 * - Rotation pcap (rotate_mb, max_files)
 * - Reason codes standard
 * - Quotas (durée max, taille max, sessions concurrentes)
 * - Retry avec backoff exponentiel
 *
 * Flow :
 *   1) GET  /probe/health — Vérifier la santé de la probe
 *   2) POST /probe/sessions/start — Démarrer une session (idempotent)
 *   3) GET  /probe/sessions/:id/status — Polling statut + packets
 *   4) POST /probe/sessions/stop — Arrêter la session (idempotent)
 *   5) GET  /probe/sessions/:id — Récupérer le manifest PCAP
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// ─── Reason Codes ───────────────────────────────────────────────────────

export type ProbeReasonCode =
  | 'PROBE_OFFLINE'
  | 'IFACE_NOT_FOUND'
  | 'NO_PACKETS'
  | 'CAPTURE_FAILED'
  | 'UPLOAD_FAILED'
  | 'AUTH_FAILED'
  | 'TIMEOUT'
  | 'QUOTA_EXCEEDED'
  | 'CONFIG_INVALID';

export class ProbeError extends Error {
  constructor(
    message: string,
    public readonly reasonCode: ProbeReasonCode,
    public readonly probeId?: string,
    public readonly sessionId?: string,
  ) {
    super(message);
    this.name = 'ProbeError';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface ProbeSpanTapConfig {
  probe_id: string;
  iface: string;
  vlan_filter?: number;
  bpf_filter: string;
  rotate_mb: number;
  max_files?: number;
  enabled: boolean;
}

export interface CaptureQuotas {
  max_concurrent_sessions: number;
  max_session_duration_sec: number;
  max_total_size_mb: number;
  max_files_per_session: number;
  no_packets_timeout_sec: number;
}

export const DEFAULT_QUOTAS: CaptureQuotas = {
  max_concurrent_sessions: 3,
  max_session_duration_sec: 3600,
  max_total_size_mb: 5000,
  max_files_per_session: 20,
  no_packets_timeout_sec: 30,
};

export interface ProbeSessionArtifact {
  filename: string;
  minio_path: string;
  size_bytes: number;
  sha256: string;
}

export interface ProbeSession {
  session_id: string;
  probe_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
  reason_code?: ProbeReasonCode;
  iface: string;
  bpf_filter: string;
  vlan_filter?: number;
  started_at?: string;
  stopped_at?: string;
  artifacts: ProbeSessionArtifact[];
  error_message?: string;
  packets_captured?: number;
  bytes_captured?: number;
  duration_sec?: number;
}

export interface ProbeHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  interfaces: Array<{ name: string; up: boolean; promisc: boolean }>;
  disk_free_mb: number;
  cpu_percent: number;
  last_error: string | null;
  active_sessions: number;
  total_captures: number;
}

export interface ProbeStatus {
  probe_id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  last_heartbeat: string;
  capabilities: string[];
}

// ─── Probe Session Manager (Hardened) ──────────────────────────────────

export class ProbeSessionManager {
  private api: AxiosInstance;
  private activeSession: ProbeSession | null = null;
  private quotas: CaptureQuotas;
  private noPacketsTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    orchestrationUrl: string,
    runnerId: string,
    private probeToken?: string,
    quotas?: Partial<CaptureQuotas>,
  ) {
    this.quotas = { ...DEFAULT_QUOTAS, ...quotas };

    this.api = axios.create({
      baseURL: orchestrationUrl,
      timeout: 30000,
      headers: {
        'X-Runner-ID': runnerId,
        'Content-Type': 'application/json',
        ...(probeToken ? { 'X-PROBE-TOKEN': probeToken } : {}),
      },
    });

    // Intercepteur : mapper les erreurs HTTP en ProbeError avec reason codes
    this.api.interceptors.response.use(
      res => res,
      (err: AxiosError) => {
        if (err.response?.status === 401 || err.response?.status === 403) {
          throw new ProbeError(
            `Auth failed: ${err.message}`,
            'AUTH_FAILED',
            undefined,
            undefined,
          );
        }
        throw err;
      },
    );
  }

  /**
   * Met à jour le token d'authentification
   */
  setAuthToken(token: string): void {
    this.probeToken = token;
    this.api.defaults.headers['X-PROBE-TOKEN'] = token;
  }

  /**
   * Vérifie la santé de la probe (/probe/health)
   */
  async checkHealth(probeId: string): Promise<ProbeHealthResponse> {
    console.log(`[PROBE] Health check on probe ${probeId}...`);
    try {
      const res = await this.retryWithBackoff(
        () => this.api.get(`/api/v1/probes/${probeId}/health`),
        2,
      );
      const health = res.data?.data as ProbeHealthResponse;
      console.log(`[PROBE] ${probeId} health=${health.status} v${health.version} cpu=${health.cpu_percent}% disk=${health.disk_free_mb}MB`);
      return health;
    } catch (err: any) {
      if (err instanceof ProbeError) throw err;
      console.error(`[PROBE] Health check failed for ${probeId}: ${err.message}`);
      throw new ProbeError(
        `Probe ${probeId} unreachable: ${err.message}`,
        'PROBE_OFFLINE',
        probeId,
      );
    }
  }

  /**
   * Vérifie que la probe est en ligne et prête
   */
  async checkProbeStatus(probeId: string): Promise<ProbeStatus> {
    console.log(`[PROBE] Checking status of probe ${probeId}...`);
    try {
      const res = await this.retryWithBackoff(
        () => this.api.get(`/api/v1/probes/${probeId}/status`),
        2,
      );
      const status = res.data?.data as ProbeStatus;
      console.log(`[PROBE] ${probeId} → ${status.status} (last heartbeat: ${status.last_heartbeat})`);
      return status;
    } catch (err: any) {
      if (err instanceof ProbeError) throw err;
      console.error(`[PROBE] Failed to check probe ${probeId}: ${err.message}`);
      throw new ProbeError(
        `Probe ${probeId} unreachable: ${err.message}`,
        'PROBE_OFFLINE',
        probeId,
      );
    }
  }

  /**
   * Valide la configuration probe avant démarrage
   */
  validateConfig(config: ProbeSpanTapConfig): ProbeReasonCode[] {
    const errors: ProbeReasonCode[] = [];

    if (!config.enabled) {
      errors.push('CONFIG_INVALID');
    }
    if (!config.probe_id || config.probe_id.trim() === '') {
      errors.push('CONFIG_INVALID');
    }
    if (!config.iface || config.iface.trim() === '') {
      errors.push('IFACE_NOT_FOUND');
    }
    if (config.rotate_mb < 1) {
      errors.push('CONFIG_INVALID');
    }

    return errors;
  }

  /**
   * Valide les quotas avant démarrage
   */
  async validateQuotas(probeId: string): Promise<void> {
    try {
      const health = await this.checkHealth(probeId);
      if (health.active_sessions >= this.quotas.max_concurrent_sessions) {
        throw new ProbeError(
          `Quota exceeded: ${health.active_sessions}/${this.quotas.max_concurrent_sessions} concurrent sessions`,
          'QUOTA_EXCEEDED',
          probeId,
        );
      }
      if (health.disk_free_mb < 500) {
        console.warn(`[PROBE] Low disk space on ${probeId}: ${health.disk_free_mb}MB free`);
      }
    } catch (err) {
      if (err instanceof ProbeError) throw err;
      // Si le health check échoue, on continue (la probe peut ne pas supporter /health)
      console.warn(`[PROBE] Quota check skipped (health unavailable)`);
    }
  }

  /**
   * Crée et démarre une session de capture sur la probe distante (idempotent)
   */
  async startCaptureSession(
    config: ProbeSpanTapConfig,
    executionId: string,
    projectId: string,
    campaignId?: string,
    driveJobId?: string,
  ): Promise<ProbeSession> {
    // Idempotence : si une session est déjà active, la retourner
    if (this.activeSession && (this.activeSession.status === 'RUNNING' || this.activeSession.status === 'PENDING')) {
      console.log(`[PROBE] Session already active: ${this.activeSession.session_id} (idempotent)`);
      return this.activeSession;
    }

    // Validate config
    const configErrors = this.validateConfig(config);
    if (configErrors.length > 0) {
      throw new ProbeError(
        `Probe config validation failed: ${configErrors.join(', ')}`,
        configErrors[0],
        config.probe_id,
      );
    }

    // Validate quotas
    await this.validateQuotas(config.probe_id);

    console.log(`[PROBE] Creating capture session on probe ${config.probe_id}...`);

    try {
      // 1. Create session
      const createRes = await this.retryWithBackoff(
        () => this.api.post(`/api/v1/probes/${config.probe_id}/sessions`, {
          execution_id: executionId,
          project_id: projectId,
          campaign_id: campaignId,
          drive_job_id: driveJobId,
          iface: config.iface,
          bpf_filter: config.bpf_filter,
          vlan_filter: config.vlan_filter,
          rotate_mb: config.rotate_mb,
          max_files: config.max_files || this.quotas.max_files_per_session,
        }),
        3,
      );

      const session = createRes.data?.data as ProbeSession;
      console.log(`[PROBE] Session created: ${session.session_id}`);

      // 2. Start capture
      const startRes = await this.retryWithBackoff(
        () => this.api.post(
          `/api/v1/probes/${config.probe_id}/sessions/${session.session_id}/start`,
        ),
        2,
      );

      this.activeSession = startRes.data?.data as ProbeSession;
      console.log(`[PROBE] Capture started on ${config.iface} (session=${session.session_id})`);

      // 3. Start no-packets detection timer
      this.startNoPacketsDetection(config.probe_id, session.session_id);

      // 4. Start session timeout
      this.startSessionTimeout(config.probe_id, session.session_id);

      return this.activeSession;

    } catch (err: any) {
      if (err instanceof ProbeError) throw err;

      // Map specific errors to reason codes
      const msg = err.message || '';
      let reasonCode: ProbeReasonCode = 'CAPTURE_FAILED';
      if (msg.includes('interface') || msg.includes('iface')) {
        reasonCode = 'IFACE_NOT_FOUND';
      } else if (msg.includes('ECONNREFUSED') || msg.includes('unreachable')) {
        reasonCode = 'PROBE_OFFLINE';
      }

      console.error(`[PROBE] Failed to start capture: ${msg} (reason=${reasonCode})`);
      throw new ProbeError(
        `Probe capture start failed: ${msg}`,
        reasonCode,
        config.probe_id,
      );
    }
  }

  /**
   * Arrête la session de capture active (idempotent)
   */
  async stopCaptureSession(): Promise<ProbeSession | null> {
    this.clearTimers();

    if (!this.activeSession) {
      console.log('[PROBE] No active capture session to stop');
      return null;
    }

    // Idempotence : si déjà terminée, retourner directement
    if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(this.activeSession.status)) {
      console.log(`[PROBE] Session already in terminal state: ${this.activeSession.status} (idempotent)`);
      return this.activeSession;
    }

    const { session_id, probe_id } = this.activeSession;
    console.log(`[PROBE] Stopping capture session ${session_id}...`);

    try {
      const res = await this.retryWithBackoff(
        () => this.api.post(
          `/api/v1/probes/${probe_id}/sessions/${session_id}/stop`,
        ),
        3,
      );

      this.activeSession = res.data?.data as ProbeSession;
      console.log(`[PROBE] Capture stopped. ${this.activeSession.artifacts.length} PCAP artifact(s), ${this.activeSession.packets_captured || '?'} packets`);

      // Check for no-packets condition
      if (this.activeSession.packets_captured === 0) {
        console.warn(`[PROBE] WARNING: No packets captured in session ${session_id}`);
        this.activeSession.reason_code = 'NO_PACKETS';
      }

      return this.activeSession;

    } catch (err: any) {
      console.error(`[PROBE] Failed to stop capture: ${err.message}`);
      // Try to get session status anyway
      try {
        const statusRes = await this.api.get(
          `/api/v1/probes/${probe_id}/sessions/${session_id}`,
        );
        this.activeSession = statusRes.data?.data as ProbeSession;
      } catch { /* ignore */ }

      return this.activeSession;
    }
  }

  /**
   * Récupère le statut d'une session (avec packets count)
   */
  async getSessionStatus(probeId: string, sessionId: string): Promise<ProbeSession> {
    const res = await this.api.get(
      `/api/v1/probes/${probeId}/sessions/${sessionId}`,
    );
    return res.data?.data as ProbeSession;
  }

  /**
   * Polling du statut de session (pour détecter no-packets)
   */
  async pollSessionStatus(probeId: string, sessionId: string, intervalMs = 5000, maxPolls = 60): Promise<ProbeSession> {
    for (let i = 0; i < maxPolls; i++) {
      const session = await this.getSessionStatus(probeId, sessionId);

      if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(session.status)) {
        return session;
      }

      // Check no-packets after timeout
      if (session.status === 'RUNNING' && session.duration_sec && session.duration_sec > this.quotas.no_packets_timeout_sec) {
        if (session.packets_captured === 0) {
          console.warn(`[PROBE] No packets after ${session.duration_sec}s — marking as NO_PACKETS`);
          session.reason_code = 'NO_PACKETS';
        }
      }

      await this.sleep(intervalMs);
    }

    throw new ProbeError(
      `Session ${sessionId} polling timeout after ${maxPolls * intervalMs}ms`,
      'TIMEOUT',
      probeId,
      sessionId,
    );
  }

  /**
   * Annule une session de capture (en cas d'erreur)
   */
  async cancelSession(): Promise<void> {
    this.clearTimers();

    if (!this.activeSession) return;

    const { session_id, probe_id } = this.activeSession;
    console.log(`[PROBE] Cancelling session ${session_id}...`);

    try {
      await this.api.post(
        `/api/v1/probes/${probe_id}/sessions/${session_id}/cancel`,
      );
    } catch (err: any) {
      console.warn(`[PROBE] Cancel failed (may already be stopped): ${err.message}`);
    }

    this.activeSession = null;
  }

  /**
   * Retourne les artefacts PCAP de la session active
   */
  getArtifacts(): ProbeSessionArtifact[] {
    return this.activeSession?.artifacts || [];
  }

  /**
   * Retourne le reason code de la session active
   */
  getReasonCode(): ProbeReasonCode | undefined {
    return this.activeSession?.reason_code;
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
    this.clearTimers();
    this.activeSession = null;
  }

  // ─── Private helpers ─────────────────────────────────────────────────

  /**
   * Retry avec backoff exponentiel
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelayMs = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        if (err instanceof ProbeError && ['AUTH_FAILED', 'CONFIG_INVALID'].includes(err.reasonCode)) {
          throw err; // Ne pas retry les erreurs de config/auth
        }
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          console.log(`[PROBE] Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    throw lastError;
  }

  /**
   * Démarre la détection de no-packets
   */
  private startNoPacketsDetection(probeId: string, sessionId: string): void {
    this.noPacketsTimer = setTimeout(async () => {
      try {
        const session = await this.getSessionStatus(probeId, sessionId);
        if (session.status === 'RUNNING' && (session.packets_captured || 0) === 0) {
          console.warn(`[PROBE] NO_PACKETS detected after ${this.quotas.no_packets_timeout_sec}s on session ${sessionId}`);
          // Ne pas arrêter la session, juste logger — le caller décidera
        }
      } catch {
        // Ignore polling errors
      }
    }, this.quotas.no_packets_timeout_sec * 1000);
  }

  /**
   * Démarre le timeout de session
   */
  private startSessionTimeout(_probeId: string, sessionId: string): void {
    setTimeout(async () => {
      if (this.activeSession?.session_id === sessionId && this.activeSession.status === 'RUNNING') {
        console.warn(`[PROBE] Session ${sessionId} timeout after ${this.quotas.max_session_duration_sec}s`);
        await this.stopCaptureSession();
      }
    }, this.quotas.max_session_duration_sec * 1000);
  }

  /**
   * Nettoie les timers
   */
  private clearTimers(): void {
    if (this.noPacketsTimer) {
      clearTimeout(this.noPacketsTimer);
      this.noPacketsTimer = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
