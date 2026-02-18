import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePermission, PermissionKey } from '../security';
import { useProbes, useCreateProbe, useDeleteProbe, useRegenerateProbeToken } from '../hooks/useProbeQueries';
import type { Probe, ProbeType, ProbeCapability, ProbeStatus, CreateProbeRequest } from '../types';
import {
  Radio, Plus, Loader2, Trash2, X, AlertCircle, Search,
  Wifi, WifiOff, AlertTriangle, RefreshCw, Copy, Check, Key
} from 'lucide-react';

const probeStatusConfig: Record<ProbeStatus, { icon: typeof Wifi; label: string; cls: string }> = {
  ONLINE: { icon: Wifi, label: 'En ligne', cls: 'text-green-400' },
  OFFLINE: { icon: WifiOff, label: 'Hors ligne', cls: 'text-gray-400' },
  DEGRADED: { icon: AlertTriangle, label: 'Dégradé', cls: 'text-yellow-400' },
};

const probeTypeLabels: Record<ProbeType, string> = {
  LINUX_EDGE: 'Linux Edge',
  K8S_CLUSTER: 'K8s Cluster',
  NETWORK_TAP: 'Network TAP',
};

function CreateProbeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [probeId, setProbeId] = useState('');
  const [site, setSite] = useState('');
  const [zone, setZone] = useState('');
  const [type, setType] = useState<ProbeType>('LINUX_EDGE');
  const [capabilities, setCapabilities] = useState<ProbeCapability[]>(['PCAP']);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useCreateProbe();

  const toggleCap = (cap: ProbeCapability) => {
    setCapabilities(prev => prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!probeId.trim() || !site.trim() || !zone.trim()) {
      setError('Tous les champs sont requis.');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        probe_id: probeId.trim(),
        site: site.trim(),
        zone: zone.trim(),
        type,
        capabilities,
      });
      setCreatedToken((result as unknown as { auth_token: string }).auth_token || null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Erreur lors de la création.');
    }
  };

  const handleCopy = () => {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setProbeId(''); setSite(''); setZone(''); setType('LINUX_EDGE');
    setCapabilities(['PCAP']); setCreatedToken(null); setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-heading font-semibold text-foreground">
            {createdToken ? 'Sonde créée' : 'Nouvelle sonde'}
          </h2>
          <button type="button" onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdToken ? (
          <div className="px-6 py-5 space-y-4">
            <div className="bg-green-500/5 border border-green-500/20 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-green-400" />
                <p className="text-sm font-medium text-green-400">Token d'authentification</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Copiez ce token maintenant. Il ne sera plus affiché.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background rounded px-3 py-2 text-xs font-mono text-foreground break-all">
                  {createdToken}
                </code>
                <button onClick={handleCopy}
                  className="shrink-0 text-muted-foreground hover:text-foreground p-2">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button onClick={handleClose}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Identifiant de la sonde *</label>
              <input type="text" value={probeId} onChange={(e) => setProbeId(e.target.value)}
                placeholder="probe-abj-dc1-01"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Site *</label>
                <input type="text" value={site} onChange={(e) => setSite(e.target.value)}
                  placeholder="Abidjan"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Zone *</label>
                <input type="text" value={zone} onChange={(e) => setZone(e.target.value)}
                  placeholder="DC-1"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Type de sonde</label>
              <select value={type} onChange={(e) => setType(e.target.value as ProbeType)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
                <option value="LINUX_EDGE">Linux Edge</option>
                <option value="K8S_CLUSTER">Kubernetes Cluster</option>
                <option value="NETWORK_TAP">Network TAP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Capacités</label>
              <div className="flex gap-3">
                {(['PCAP', 'LOGS'] as ProbeCapability[]).map(cap => (
                  <label key={cap} className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={capabilities.includes(cap)}
                      onChange={() => toggleCap(cap)}
                      className="rounded border-input" />
                    <span className="text-sm text-foreground">{cap}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={handleClose}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Créer
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ProbesPage() {
  const { canWrite } = useAuth();
  const { can } = usePermission();
  const canManageProbes = can(PermissionKey.EXECUTIONS_RUN);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useProbes({
    ...(statusFilter ? { status: statusFilter } : {}),
  });
  const deleteMutation = useDeleteProbe();
  const regenerateMutation = useRegenerateProbeToken();

  const probes = (data?.data || []) as Probe[];
  const filtered = search
    ? probes.filter(p => p.probe_id.toLowerCase().includes(search.toLowerCase()) || p.site.toLowerCase().includes(search.toLowerCase()))
    : probes;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Sondes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les sondes de collecte déployées sur vos sites.
          </p>
        </div>
        {canManageProbes && (
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouvelle sonde
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une sonde..."
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
          <option value="">Tous les statuts</option>
          <option value="ONLINE">En ligne</option>
          <option value="OFFLINE">Hors ligne</option>
          <option value="DEGRADED">Dégradé</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Radio className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucune sonde</h3>
          <p className="text-sm text-muted-foreground mb-4">Enregistrez une sonde pour commencer la collecte.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((probe) => {
            const status = probeStatusConfig[probe.status];
            const StatusIcon = status.icon;
            return (
              <div key={probe.probe_id} className="flex items-center justify-between bg-card border border-border rounded-lg px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-foreground font-mono">{probe.probe_id}</h3>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.cls}`}>
                        <StatusIcon className="w-3 h-3" /> {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {probe.site} / {probe.zone} — {probeTypeLabels[probe.type]} — {probe.capabilities.join(', ')}
                    </p>
                    {probe.last_seen_at && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        Vu : {new Date(probe.last_seen_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    )}
                  </div>
                </div>
                {canManageProbes && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => regenerateMutation.mutate(probe.probe_id)}
                      className="text-muted-foreground hover:text-primary p-1.5 transition-colors" title="Régénérer le token">
                      <RefreshCw className={`w-4 h-4 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => deleteMutation.mutate(probe.probe_id)}
                      className="text-muted-foreground hover:text-destructive p-1.5 transition-colors" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateProbeModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
