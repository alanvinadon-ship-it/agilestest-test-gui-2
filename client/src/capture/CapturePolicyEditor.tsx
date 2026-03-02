import React from 'react';
import { Shield, Radio, Wifi, AlertTriangle, Info, Server, Network } from 'lucide-react';
import type {
  CapturePolicy,
  CaptureMode,
  RunnerTcpdumpConfig,
  ProbeSpanTapConfig,
} from './types';
import {
  DEFAULT_CAPTURE_POLICY,
  DEFAULT_RUNNER_TCPDUMP,
  DEFAULT_PROBE_SPAN_TAP,
  captureModeLabel,
} from './types';

interface CapturePolicyEditorProps {
  /** Policy actuelle (null = pas encore configurée) */
  value: CapturePolicy | null;
  /** Callback quand la policy change */
  onChange: (policy: CapturePolicy) => void;
  /** Si true, affiche un bouton "Supprimer override" */
  showRemoveOverride?: boolean;
  /** Callback pour supprimer l'override */
  onRemoveOverride?: () => void;
  /** Label du scope (ex: "Projet", "Campagne", "Scénario") */
  scopeLabel?: string;
  /** Si true, les champs sont en lecture seule */
  readOnly?: boolean;
  /** Liste des probes disponibles pour le mode B */
  availableProbes?: Array<{ probe_id: string; name: string; status?: string }>;
  /** Compact mode (moins de padding) */
  compact?: boolean;
}

export function CapturePolicyEditor({
  value,
  onChange,
  showRemoveOverride = false,
  onRemoveOverride,
  scopeLabel = 'Capture',
  readOnly = false,
  availableProbes = [],
  compact = false,
}: CapturePolicyEditorProps) {
  const policy = value || { ...DEFAULT_CAPTURE_POLICY };
  const mode = policy.default_mode;

  const setMode = (m: CaptureMode) => {
    onChange({ ...policy, default_mode: m });
  };

  const setTcpdump = (patch: Partial<RunnerTcpdumpConfig>) => {
    onChange({ ...policy, runner_tcpdump: { ...policy.runner_tcpdump, ...patch } });
  };

  const setProbe = (patch: Partial<ProbeSpanTapConfig>) => {
    onChange({ ...policy, probe_span_tap: { ...policy.probe_span_tap, ...patch } });
  };

  const setRetention = (days: number) => {
    onChange({ ...policy, retention_days: days });
  };

  const py = compact ? 'py-3' : 'py-4';
  const px = compact ? 'px-3' : 'px-4';

  return (
    <div className={`border border-border rounded-lg ${py} ${px} space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-sm">{scopeLabel} — Politique de capture</span>
        </div>
        {showRemoveOverride && onRemoveOverride && (
          <button
            onClick={onRemoveOverride}
            disabled={readOnly}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            Supprimer l'override
          </button>
        )}
      </div>

      {/* Mode selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mode de capture</label>
        <div className="grid grid-cols-3 gap-2">
          {(['NONE', 'RUNNER_TCPDUMP', 'PROBE_SPAN_TAP'] as CaptureMode[]).map((m) => (
            <button
              key={m}
              onClick={() => !readOnly && setMode(m)}
              disabled={readOnly}
              className={`flex items-center gap-2 p-3 rounded-md border text-sm transition-all ${
                mode === m
                  ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                  : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
              } ${readOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {m === 'NONE' && <Radio className="w-4 h-4" />}
              {m === 'RUNNER_TCPDUMP' && <Server className="w-4 h-4" />}
              {m === 'PROBE_SPAN_TAP' && <Network className="w-4 h-4" />}
              <span className="text-xs font-medium">
                {m === 'NONE' ? 'Aucune' : m === 'RUNNER_TCPDUMP' ? 'A — Runner' : 'B — Probe'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Mode A — Runner tcpdump */}
      {mode === 'RUNNER_TCPDUMP' && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Server className="w-3.5 h-3.5" />
            <span className="font-medium">Configuration Runner tcpdump</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Interface réseau *</label>
              <input
                type="text"
                value={policy.runner_tcpdump.iface}
                onChange={(e) => setTcpdump({ iface: e.target.value })}
                disabled={readOnly}
                placeholder="eth0"
                className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">BPF Filter</label>
              <input
                type="text"
                value={policy.runner_tcpdump.bpf_filter}
                onChange={(e) => setTcpdump({ bpf_filter: e.target.value })}
                disabled={readOnly}
                placeholder="port 5060 or port 5061"
                className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Snaplen (octets)</label>
              <input
                type="number"
                value={policy.runner_tcpdump.snaplen}
                onChange={(e) => setTcpdump({ snaplen: parseInt(e.target.value) || 65535 })}
                disabled={readOnly}
                min={64}
                max={65535}
                className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Rotation (Mo)</label>
              <input
                type="number"
                value={policy.runner_tcpdump.rotate_mb}
                onChange={(e) => setTcpdump({ rotate_mb: parseInt(e.target.value) || 100 })}
                disabled={readOnly}
                min={1}
                className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max fichiers</label>
              <input
                type="number"
                value={policy.runner_tcpdump.max_files}
                onChange={(e) => setTcpdump({ max_files: parseInt(e.target.value) || 5 })}
                disabled={readOnly}
                min={1}
                max={100}
                className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                checked={policy.runner_tcpdump.enabled}
                onChange={(e) => setTcpdump({ enabled: e.target.checked })}
                disabled={readOnly}
                className="rounded border-border"
              />
              <label className="text-xs text-muted-foreground">Activé</label>
            </div>
          </div>
          {!policy.runner_tcpdump.iface && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              Interface réseau requise — le run sera bloqué
            </div>
          )}
        </div>
      )}

      {/* Mode B — Probe SPAN/TAP */}
      {mode === 'PROBE_SPAN_TAP' && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Network className="w-3.5 h-3.5" />
            <span className="font-medium">Configuration Probe SPAN/TAP</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Probe *</label>
              {availableProbes.length > 0 ? (
                <select
                  value={policy.probe_span_tap.probe_id}
                  onChange={(e) => setProbe({ probe_id: e.target.value })}
                  disabled={readOnly}
                  className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Sélectionner une probe</option>
                  {availableProbes.map((p) => (
                    <option key={p.probe_id} value={p.probe_id}>
                      {p.name} {p.status ? `(${p.status})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={policy.probe_span_tap.probe_id}
                  onChange={(e) => setProbe({ probe_id: e.target.value })}
                  disabled={readOnly}
                  placeholder="probe-001"
                  className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
                />
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Interface miroir *</label>
              <input
                type="text"
                value={policy.probe_span_tap.iface}
                onChange={(e) => setProbe({ iface: e.target.value })}
                disabled={readOnly}
                placeholder="mirror0"
                className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">VLAN Filter (optionnel)</label>
              <input
                type="number"
                value={policy.probe_span_tap.vlan_filter ?? ''}
                onChange={(e) => setProbe({ vlan_filter: e.target.value ? parseInt(e.target.value) : undefined })}
                disabled={readOnly}
                placeholder="100"
                className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">BPF Filter</label>
              <input
                type="text"
                value={policy.probe_span_tap.bpf_filter}
                onChange={(e) => setProbe({ bpf_filter: e.target.value })}
                disabled={readOnly}
                placeholder="host 10.0.0.1"
                className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Rotation (Mo)</label>
              <input
                type="number"
                value={policy.probe_span_tap.rotate_mb}
                onChange={(e) => setProbe({ rotate_mb: parseInt(e.target.value) || 100 })}
                disabled={readOnly}
                min={1}
                className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                checked={policy.probe_span_tap.enabled}
                onChange={(e) => setProbe({ enabled: e.target.checked })}
                disabled={readOnly}
                className="rounded border-border"
              />
              <label className="text-xs text-muted-foreground">Activé</label>
            </div>
          </div>
          {!policy.probe_span_tap.probe_id && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              probe_id requis — le run sera bloqué
            </div>
          )}
          {!policy.probe_span_tap.iface && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              Interface miroir requise — le run sera bloqué
            </div>
          )}
        </div>
      )}

      {/* Retention */}
      {mode !== 'NONE' && (
        <div className="border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Rétention (jours)</label>
            <input
              type="number"
              value={policy.retention_days}
              onChange={(e) => setRetention(parseInt(e.target.value) || 30)}
              disabled={readOnly}
              min={1}
              max={365}
              className="w-20 px-2 py-1 text-sm bg-background border border-border rounded-md focus:border-orange-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      )}

      {/* Info */}
      {mode === 'NONE' && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5" />
          Aucune capture réseau ne sera effectuée lors des exécutions.
        </div>
      )}
    </div>
  );
}

/** Affichage compact read-only du mode effectif */
export function CaptureModeBadge({
  mode,
  source,
}: {
  mode: CaptureMode;
  source?: string;
}) {
  const colors: Record<CaptureMode, string> = {
    NONE: 'bg-muted text-muted-foreground',
    RUNNER_TCPDUMP: 'bg-blue-500/15 text-blue-400',
    PROBE_SPAN_TAP: 'bg-purple-500/15 text-purple-400',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors[mode]}`}>
      {mode === 'RUNNER_TCPDUMP' && <Server className="w-3 h-3" />}
      {mode === 'PROBE_SPAN_TAP' && <Network className="w-3 h-3" />}
      {captureModeLabel(mode)}
      {source && <span className="text-[10px] opacity-60">({source})</span>}
    </span>
  );
}
