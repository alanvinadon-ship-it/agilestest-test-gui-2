import { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '@/auth/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Play,
  Square,
  Trash2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  Loader2,
  ChevronRight,
  Navigation,
  Smartphone,
  Search,
  X,
  Brain,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { trpc as trpcClient } from '@/lib/trpc';

// ─── Types ──────────────────────────────────────────────────────────────────

type RunStatus = 'DRAFT' | 'RUNNING' | 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'CANCELED';

const STATUS_BADGE: Record<RunStatus, { color: string; icon: typeof Clock; label: string }> = {
  DRAFT: { color: 'bg-gray-500/20 text-gray-300', icon: Clock, label: 'Brouillon' },
  RUNNING: { color: 'bg-amber-500/20 text-amber-300', icon: Play, label: 'En cours' },
  UPLOADING: { color: 'bg-blue-500/20 text-blue-300', icon: Upload, label: 'Upload' },
  COMPLETED: { color: 'bg-emerald-500/20 text-emerald-300', icon: CheckCircle2, label: 'Terminé' },
  FAILED: { color: 'bg-red-500/20 text-red-300', icon: XCircle, label: 'Échoué' },
  CANCELED: { color: 'bg-gray-500/20 text-gray-400', icon: Square, label: 'Annulé' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function DriveRunsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const projectId = currentProject?.id ?? '';

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchInput]);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.driveRuns.list.useQuery(
    {
      orgId: projectId,
      status: statusFilter === 'ALL' ? undefined : statusFilter as RunStatus,
      search: searchQuery || undefined,
      limit: 50,
    },
    { enabled: !!projectId }
  );

  const createMutation = trpc.driveRuns.create.useMutation({
    onSuccess: () => {
      toast.success('Run créé');
      utils.driveRuns.list.invalidate();
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const startMutation = trpc.driveRuns.start.useMutation({
    onSuccess: () => {
      toast.success('Run démarré');
      utils.driveRuns.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const stopMutation = trpc.driveRuns.stop.useMutation({
    onSuccess: () => {
      toast.success('Run arrêté');
      utils.driveRuns.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.driveRuns.delete.useMutation({
    onSuccess: () => {
      toast.success('Run supprimé');
      utils.driveRuns.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const runs = data?.items ?? [];

  // ─── Campaigns list for create dialog ───────────────────────────────────
  const { data: campaignsData } = trpc.driveCampaigns.list.useQuery(
    { projectId, pageSize: 100 },
    { enabled: !!projectId }
  );
  const campaigns = campaignsData?.data ?? [];

  // ─── Create form state ──────────────────────────────────────────────────
  const [createName, setCreateName] = useState('');
  const [createCampaignUid, setCreateCampaignUid] = useState('');

  function handleCreate() {
    createMutation.mutate({
      orgId: projectId,
      projectUid: projectId,
      name: createName.trim() || undefined,
      campaignUid: createCampaignUid || undefined,
    });
    setCreateName('');
  }

  function formatDate(d: Date | string | null | undefined) {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function formatDuration(start: Date | string | null | undefined, end: Date | string | null | undefined) {
    if (!start) return '—';
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const sec = Math.round((e - s) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Navigation className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Drive Runs — Tests Terrain
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Sessions de test mobile sur le terrain avec GPS, traces et événements.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-1" /> Nouveau Run
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 pr-8"
            placeholder="Rechercher par nom ou ID…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => { setSearchInput(''); setSearchQuery(''); }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            <SelectItem value="DRAFT">Brouillon</SelectItem>
            <SelectItem value="RUNNING">En cours</SelectItem>
            <SelectItem value="UPLOADING">Upload</SelectItem>
            <SelectItem value="COMPLETED">Terminé</SelectItem>
            <SelectItem value="FAILED">Échoué</SelectItem>
            <SelectItem value="CANCELED">Annulé</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {data?.total ?? runs.length} run{(data?.total ?? runs.length) !== 1 ? 's' : ''}
          {searchQuery && <> pour « {searchQuery} »</>}
        </span>
      </div>

      {/* Runs list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Navigation className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun run trouvé.</p>
          <p className="text-xs mt-1">Créez un nouveau run pour démarrer une session de test terrain.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run: any) => {
            const st = STATUS_BADGE[run.status as RunStatus] ?? STATUS_BADGE.DRAFT;
            const Icon = st.icon;
            return (
              <div
                key={run.uid}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
              >
                {/* Mobile: stacked layout */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Badge className={`${st.color} text-xs px-2 py-0.5 flex items-center gap-1`}>
                      <Icon className="w-3 h-3" />
                      {st.label}
                    </Badge>
                    <Link href={`/drive/runs/${run.uid}`}>
                      <span className="text-sm font-medium text-foreground hover:text-primary cursor-pointer truncate">
                        {run.name || `Run ${run.uid.slice(0, 8)}…`}
                      </span>
                    </Link>
                    {run.campaignUid && (
                      <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Campagne {run.campaignUid.slice(0, 8)}
                      </span>
                    )}
                    {run.deviceUid && (
                      <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                        <Smartphone className="w-3 h-3" />
                        {run.deviceUid.slice(0, 8)}
                      </span>
                    )}
                    <AiBadge runUid={run.uid} orgId={projectId} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(run.createdAt)}
                    </span>
                    {run.startedAt && (
                      <span className="text-xs text-muted-foreground">
                        ⏱ {formatDuration(run.startedAt, run.endedAt)}
                      </span>
                    )}
                    {/* Actions */}
                    {run.status === 'DRAFT' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startMutation.mutate({ runUid: run.uid })}
                        disabled={startMutation.isPending}
                      >
                        <Play className="w-3 h-3 mr-1" /> Démarrer
                      </Button>
                    )}
                    {run.status === 'RUNNING' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => stopMutation.mutate({ runUid: run.uid, finalStatus: 'COMPLETED' })}
                        disabled={stopMutation.isPending}
                      >
                        <Square className="w-3 h-3 mr-1" /> Arrêter
                      </Button>
                    )}
                    <Link href={`/drive/runs/${run.uid}`}>
                      <Button size="sm" variant="ghost">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm('Supprimer ce run et toutes ses données ?')) {
                          deleteMutation.mutate({ runUid: run.uid });
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau Drive Run</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Nom du run</label>
              <Input
                className="mt-1"
                placeholder="Ex : Drive Abidjan Nord, Test couverture 4G…"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={255}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">Donnez un nom descriptif pour identifier facilement ce run.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Campagne (optionnel)</label>
              <Select value={createCampaignUid} onValueChange={setCreateCampaignUid}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Aucune campagne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {campaigns.map((c: any) => (
                    <SelectItem key={c.uid} value={c.uid}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── AI Badge (shows latest analysis status for a run) ─────────────────────

function AiBadge({ runUid, orgId }: { runUid: string; orgId: string }) {
  const { data: analysis } = trpcClient.driveAi.latest.useQuery(
    { runUid, orgId },
    { enabled: !!runUid && !!orgId, staleTime: 60_000 }
  );

  if (!analysis) return null;

  if (analysis.status === 'QUEUED' || analysis.status === 'RUNNING') {
    return (
      <Badge className="bg-blue-500/20 text-blue-300 text-xs hidden sm:flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        IA
      </Badge>
    );
  }

  if (analysis.status === 'COMPLETED') {
    const score = analysis.qualityScore ?? 0;
    const color = score >= 80 ? 'bg-emerald-500/20 text-emerald-300' : score >= 50 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300';
    return (
      <Badge className={`${color} text-xs hidden sm:flex items-center gap-1`}>
        <Brain className="w-3 h-3" />
        {score}/100
      </Badge>
    );
  }

  if (analysis.status === 'FAILED') {
    return (
      <Badge className="bg-red-500/20 text-red-300 text-xs hidden sm:flex items-center gap-1">
        <Brain className="w-3 h-3" />
        Erreur
      </Badge>
    );
  }

  return null;
}
