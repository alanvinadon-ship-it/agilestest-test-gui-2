/**
 * tcpdumpCapture.ts — Mode A : Capture réseau via tcpdump côté Runner
 *
 * Démarre/arrête tcpdump en parallèle de l'exécution Playwright.
 * Les fichiers PCAP sont collectés et uploadés vers MinIO/S3 avec le manifest.
 *
 * Prérequis Docker : tcpdump installé dans l'image runner (apt-get install -y tcpdump)
 * Capabilities : NET_ADMIN, NET_RAW
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────

export interface TcpdumpConfig {
  iface: string;
  bpf_filter: string;
  snaplen: number;
  rotate_mb: number;
  max_files: number;
  enabled: boolean;
}

export interface TcpdumpSession {
  pid: number | null;
  pcapDir: string;
  startedAt: string;
  stoppedAt: string | null;
  status: 'RUNNING' | 'STOPPED' | 'FAILED';
  errorMessage: string | null;
  pcapFiles: string[];
}

// ─── Defaults ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: TcpdumpConfig = {
  iface: 'eth0',
  bpf_filter: '',
  snaplen: 65535,
  rotate_mb: 100,
  max_files: 5,
  enabled: true,
};

// ─── Module State ────────────────────────────────────────────────────────

let tcpdumpProcess: ChildProcess | null = null;
let currentSession: TcpdumpSession | null = null;

// ─── Functions ───────────────────────────────────────────────────────────

/**
 * Valide la configuration tcpdump avant démarrage
 */
export function validateTcpdumpConfig(config: TcpdumpConfig): string[] {
  const errors: string[] = [];

  if (!config.enabled) {
    errors.push('tcpdump capture is disabled in configuration');
  }
  if (!config.iface || config.iface.trim() === '') {
    errors.push('Network interface (iface) is required');
  }
  if (config.snaplen < 64) {
    errors.push('snaplen must be >= 64 bytes');
  }
  if (config.rotate_mb < 1) {
    errors.push('rotate_mb must be >= 1 MB');
  }
  if (config.max_files < 1) {
    errors.push('max_files must be >= 1');
  }

  return errors;
}

/**
 * Démarre tcpdump en arrière-plan
 *
 * @param config Configuration tcpdump
 * @param outputDir Répertoire de sortie pour les fichiers PCAP
 * @param jobId Identifiant du job (pour nommage des fichiers)
 * @returns Session de capture
 */
export function startTcpdump(
  config: TcpdumpConfig,
  outputDir: string,
  jobId: string
): TcpdumpSession {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate
  const errors = validateTcpdumpConfig(mergedConfig);
  if (errors.length > 0) {
    return {
      pid: null,
      pcapDir: outputDir,
      startedAt: new Date().toISOString(),
      stoppedAt: new Date().toISOString(),
      status: 'FAILED',
      errorMessage: `Validation failed: ${errors.join('; ')}`,
      pcapFiles: [],
    };
  }

  // Ensure output directory exists
  const pcapDir = path.join(outputDir, 'pcap');
  fs.mkdirSync(pcapDir, { recursive: true });

  // Build tcpdump command arguments
  const pcapFilePattern = path.join(pcapDir, `capture-${jobId}-%Y%m%d-%H%M%S.pcap`);
  const args: string[] = [
    '-i', mergedConfig.iface,
    '-s', String(mergedConfig.snaplen),
    '-w', pcapFilePattern,
    '-C', String(mergedConfig.rotate_mb),  // Rotate after N MB
    '-W', String(mergedConfig.max_files),  // Max N files
    '-Z', 'root',                           // Don't drop privileges
    '--time-stamp-precision=micro',
  ];

  // Add BPF filter if specified
  if (mergedConfig.bpf_filter && mergedConfig.bpf_filter.trim() !== '') {
    args.push(mergedConfig.bpf_filter);
  }

  console.log(`[TCPDUMP] Starting: tcpdump ${args.join(' ')}`);

  try {
    const proc = spawn('tcpdump', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    tcpdumpProcess = proc;

    const session: TcpdumpSession = {
      pid: proc.pid || null,
      pcapDir,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      status: 'RUNNING',
      errorMessage: null,
      pcapFiles: [],
    };

    currentSession = session;

    // Capture stderr for diagnostics
    let stderrBuffer = '';
    proc.stderr?.on('data', (data: Buffer) => {
      stderrBuffer += data.toString();
      // Log first line (usually "tcpdump: listening on eth0...")
      if (stderrBuffer.includes('\n') && !session.errorMessage) {
        const firstLine = stderrBuffer.split('\n')[0];
        console.log(`[TCPDUMP] ${firstLine}`);
      }
    });

    proc.on('error', (err: Error) => {
      console.error(`[TCPDUMP] Process error: ${err.message}`);
      session.status = 'FAILED';
      session.errorMessage = err.message;
      session.stoppedAt = new Date().toISOString();
    });

    proc.on('exit', (code: number | null) => {
      if (session.status === 'RUNNING') {
        session.status = code === 0 ? 'STOPPED' : 'FAILED';
        if (code !== 0 && code !== null) {
          session.errorMessage = `tcpdump exited with code ${code}: ${stderrBuffer.slice(-200)}`;
        }
        session.stoppedAt = new Date().toISOString();
      }
      // Collect PCAP files
      session.pcapFiles = collectPcapFiles(pcapDir);
      console.log(`[TCPDUMP] Exited (code=${code}), ${session.pcapFiles.length} PCAP file(s)`);
    });

    return session;

  } catch (err: any) {
    console.error(`[TCPDUMP] Failed to start: ${err.message}`);
    return {
      pid: null,
      pcapDir,
      startedAt: new Date().toISOString(),
      stoppedAt: new Date().toISOString(),
      status: 'FAILED',
      errorMessage: `Failed to start tcpdump: ${err.message}`,
      pcapFiles: [],
    };
  }
}

/**
 * Arrête tcpdump proprement (SIGTERM → SIGKILL après timeout)
 */
export async function stopTcpdump(timeoutMs: number = 5000): Promise<TcpdumpSession | null> {
  if (!tcpdumpProcess || !currentSession) {
    console.log('[TCPDUMP] No active capture to stop');
    return currentSession;
  }

  console.log(`[TCPDUMP] Stopping capture (PID=${currentSession.pid})...`);

  return new Promise((resolve) => {
    const proc = tcpdumpProcess!;
    const session = currentSession!;

    // Set timeout for force kill
    const killTimer = setTimeout(() => {
      console.log('[TCPDUMP] Force killing (SIGKILL)...');
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.on('exit', () => {
      clearTimeout(killTimer);
      session.stoppedAt = new Date().toISOString();
      session.status = 'STOPPED';
      session.pcapFiles = collectPcapFiles(session.pcapDir);
      tcpdumpProcess = null;
      resolve(session);
    });

    // Send SIGTERM for graceful shutdown
    proc.kill('SIGTERM');
  });
}

/**
 * Collecte les fichiers PCAP dans un répertoire
 */
export function collectPcapFiles(pcapDir: string): string[] {
  if (!fs.existsSync(pcapDir)) return [];

  return fs.readdirSync(pcapDir)
    .filter(f => f.endsWith('.pcap'))
    .map(f => path.join(pcapDir, f))
    .filter(f => {
      const stat = fs.statSync(f);
      return stat.size > 0; // Skip empty files
    });
}

/**
 * Calcule le checksum SHA-256 d'un fichier
 */
export function computePcapChecksum(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Retourne les artefacts PCAP prêts pour upload S3
 */
export function getPcapArtifacts(session: TcpdumpSession): Array<{
  type: string;
  filename: string;
  localPath: string;
  sizeBytes: number;
  mimeType: string;
}> {
  return session.pcapFiles.map(filePath => ({
    type: 'PCAP',
    filename: path.basename(filePath),
    localPath: filePath,
    sizeBytes: fs.statSync(filePath).size,
    mimeType: 'application/vnd.tcpdump.pcap',
  }));
}

/**
 * Retourne l'état courant de la session
 */
export function getCurrentSession(): TcpdumpSession | null {
  return currentSession;
}

/**
 * Réinitialise l'état (entre deux jobs)
 */
export function resetSession(): void {
  tcpdumpProcess = null;
  currentSession = null;
}
