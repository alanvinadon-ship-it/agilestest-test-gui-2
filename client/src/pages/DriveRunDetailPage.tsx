import { useState, useRef, useCallback } from 'react';
import { useRoute, Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Play,
  Square,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  Loader2,
  Navigation,
  FileText,
  Activity,
  Plus,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DriveGpsMap } from '@/components/DriveGpsMap';
import { toast } from 'sonner';
import { RefreshCw, FileCheck, Brain } from 'lucide-react';
import { DriveAiTab } from '@/components/DriveAiTab';

// ─── Types ──────────────────────────────────────────────────────────────────

type RunStatus = 'DRAFT' | 'RUNNING' | 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
type Tab = 'gps' | 'events' | 'uploads' | 'summary' | 'ai';

const STATUS_BADGE: Record<RunStatus, { color: string; icon: typeof Clock; label: string }> = {
  DRAFT: { color: 'bg-gray-500/20 text-gray-300', icon: Clock, label: 'Brouillon' },
  RUNNING: { color: 'bg-amber-500/20 text-amber-300', icon: Play, label: 'En cours' },
  UPLOADING: { color: 'bg-blue-500/20 text-blue-300', icon: Upload, label: 'Upload' },
  COMPLETED: { color: 'bg-emerald-500/20 text-emerald-300', icon: CheckCircle2, label: 'Terminé' },
  FAILED: { color: 'bg-red-500/20 text-red-300', icon: XCircle, label: 'Échoué' },
  CANCELED: { color: 'bg-gray-500/20 text-gray-400', icon: Square, label: 'Annulé' },
};

const EVENT_TYPES = ['NOTE', 'ANOMALY', 'HANDOVER', 'CALL_START', 'CALL_END', 'DATA_SESSION', 'COVERAGE_HOLE', 'INTERFERENCE', 'OTHER'] as const;

// ─── Component ──────────────────────────────────────────────────────────────

export default function DriveRunDetailPage() {
  const [, params] = useRoute('/drive/runs/:uid');
  const runUid = params?.uid ?? '';
  const [activeTab, setActiveTab] = useState<Tab>('gps');

  const utils = trpc.useUtils();

  // ─── Queries ────────────────────────────────────────────────────────────
  const { data: run, isLoading } = trpc.driveRuns.get.useQuery(
    { runUid },
    { enabled: !!runUid }
  );

  const { data: gpsData } = trpc.driveTelemetry.getTrack.useQuery(
    { runUid, orgId: '' },
    { enabled: !!runUid && activeTab === 'gps' }
  );

  const { data: eventsData } = trpc.driveRunEvents.list.useQuery(
    { orgId: '', runUid, limit: 200 },
    { enabled: !!runUid && activeTab === 'events' }
  );

  const { data: uploadsData } = trpc.driveUploads.listFiles.useQuery(
    { runUid },
    { enabled: !!runUid && activeTab === 'uploads' }
  );

  // ─── Mutations ──────────────────────────────────────────────────────────
  const startMutation = trpc.driveRuns.start.useMutation({
    onSuccess: () => { toast.success('Run démarré'); utils.driveRuns.get.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const stopMutation = trpc.driveRuns.stop.useMutation({
    onSuccess: () => { toast.success('Run arrêté'); utils.driveRuns.get.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addEventMutation = trpc.driveRunEvents.create.useMutation({
    onSuccess: () => { toast.success('Événement ajouté'); utils.driveRunEvents.list.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadFileMutation = trpc.driveUploads.uploadFile.useMutation({
    onSuccess: () => { toast.success('Fichier uploadé'); utils.driveUploads.listFiles.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Event form state ───────────────────────────────────────────────────
  const [eventType, setEventType] = useState<string>('NOTE');
  const [eventNote, setEventNote] = useState('');

  function handleAddEvent() {
    if (!eventNote.trim()) return;
    addEventMutation.mutate({
      orgId: '',
      runUid,
      ts: new Date().toISOString(),
      type: eventType as any,
      message: eventNote.trim(),
    });
    setEventNote('');
  }

  // ─── File upload ────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 50 Mo)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadFileMutation.mutate({
        runUid,
        orgId: '',
        projectUid: '',
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [runUid, uploadFileMutation]);

  // ─── Helpers ────────────────────────────────────────────────────────────
  function formatDate(d: Date | string | null | undefined) {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <p>Run introuvable.</p>
        <Link href="/drive/runs">
          <Button variant="link" className="mt-2">← Retour aux runs</Button>
        </Link>
      </div>
    );
  }

  const st = STATUS_BADGE[run.status as RunStatus] ?? STATUS_BADGE.DRAFT;
  const StatusIcon = st.icon;
  const gpsSamples = Array.isArray(gpsData) ? gpsData : (gpsData as any)?.items ?? [];
  const events = eventsData?.items ?? [];
  const uploads = Array.isArray(uploadsData) ? uploadsData : [];

  const tabs: { key: Tab; label: string; icon: typeof MapPin; count?: number }[] = [
    { key: 'gps', label: 'Trace GPS', icon: MapPin, count: gpsSamples.length },
    { key: 'events', label: 'Événements', icon: Activity, count: events.length },
    { key: 'uploads', label: 'Fichiers', icon: Upload, count: uploads.length },
    { key: 'summary', label: 'Résumé', icon: FileText },
    { key: 'ai', label: 'IA Diagnostic', icon: Brain },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/drive/runs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Navigation className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl font-heading font-bold text-foreground">
                {run.name || `Run ${run.uid.slice(0, 12)}…`}
              </h1>
              {run.name && (
                <span className="text-xs font-mono text-muted-foreground">{run.uid.slice(0, 8)}</span>
              )}
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Créé le {formatDate(run.createdAt)}
                {run.startedAt && <> · Démarré {formatDate(run.startedAt)}</>}
                {run.startedAt && <> · {formatDuration(run.startedAt, run.endedAt)}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${st.color} text-xs px-2 py-0.5 flex items-center gap-1`}>
              <StatusIcon className="w-3 h-3" />
              {st.label}
            </Badge>
            {run.status === 'DRAFT' && (
              <Button size="sm" onClick={() => startMutation.mutate({ runUid })} disabled={startMutation.isPending}>
                <Play className="w-4 h-4 mr-1" /> Démarrer
              </Button>
            )}
            {run.status === 'RUNNING' && (
              <Button size="sm" variant="outline" onClick={() => stopMutation.mutate({ runUid, finalStatus: 'COMPLETED' })} disabled={stopMutation.isPending}>
                <Square className="w-4 h-4 mr-1" /> Arrêter
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {/* ─── GPS Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'gps' && (
          <GpsTabContent samples={gpsSamples} formatDate={formatDate} />
        )}

        {/* ─── Events Tab ──────────────────────────────────────────────── */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            {/* Add event form */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Ajouter un événement</h3>
              <div className="flex gap-2">
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={eventNote}
                  onChange={(e) => setEventNote(e.target.value)}
                  placeholder="Note ou description…"
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEvent()}
                />
                <Button onClick={handleAddEvent} disabled={addEventMutation.isPending || !eventNote.trim()}>
                  {addEventMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Events list */}
            {events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun événement enregistré.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((evt: any) => (
                  <div key={evt.id} className="bg-card border border-border rounded-lg p-3 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="text-xs shrink-0 mt-0.5">{evt.eventType}</Badge>
                      <div>
                        <p className="text-sm text-foreground">{evt.note || '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(evt.eventAt)}
                          {evt.lat != null && evt.lng != null && (
                            <> · <MapPin className="w-3 h-3 inline" /> {evt.lat.toFixed(5)}, {evt.lng.toFixed(5)}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {evt.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Uploads Tab ─────────────────────────────────────────────── */}
        {activeTab === 'uploads' && (
          <div className="space-y-4">
            {/* Upload button */}
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pcap,.pcapng,.log,.txt,.csv,.json,.xml,.zip,.gz,.tar,.sip,.har,.kml,.gpx"
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploadFileMutation.isPending}>
                {uploadFileMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Uploader un fichier
              </Button>
              <span className="text-xs text-muted-foreground">
                Traces, logs, PCAP, KML, GPX, CSV… (max 50 Mo)
              </span>
            </div>

            {/* Files list */}
            {uploads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Upload className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun fichier uploadé.</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Fichier</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Taille</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Date</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">GPS Parse</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map((f: any) => (
                      <tr key={f.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{f.fileName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{f.mimeType}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {f.fileSizeBytes ? `${(f.fileSizeBytes / 1024).toFixed(1)} Ko` : '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{formatDate(f.createdAt)}</td>
                        <td className="px-3 py-2">
                          <FileParseStatus artifactUid={f.uid} filename={f.filename ?? f.fileName ?? ''} runUid={runUid ?? ''} orgId={run.orgId} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {f.s3Url && (
                            <a href={f.s3Url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost">
                                <Download className="w-3 h-3" />
                              </Button>
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Summary Tab ─────────────────────────────────────────────── */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">Résumé du Run</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{run.status}</p>
                  <p className="text-xs text-muted-foreground">Statut</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {run.startedAt ? formatDuration(run.startedAt, run.endedAt) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Durée</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{gpsSamples.length}</p>
                  <p className="text-xs text-muted-foreground">Points GPS</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{events.length}</p>
                  <p className="text-xs text-muted-foreground">Événements</p>
                </div>
              </div>
            </div>

            {/* Run metadata */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-medium text-foreground mb-3">Métadonnées</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">UID</span>
                <span className="font-mono text-foreground">{run.uid}</span>
                <span className="text-muted-foreground">Campagne</span>
                <span className="text-foreground">{run.campaignUid || '—'}</span>
                <span className="text-muted-foreground">Appareil</span>
                <span className="text-foreground">{run.deviceUid || '—'}</span>
                <span className="text-muted-foreground">Sonde</span>
                <span className="text-foreground">{run.probeUid || '—'}</span>
                <span className="text-muted-foreground">Créé le</span>
                <span className="text-foreground">{formatDate(run.createdAt)}</span>
                <span className="text-muted-foreground">Démarré le</span>
                <span className="text-foreground">{formatDate(run.startedAt)}</span>
                <span className="text-muted-foreground">Terminé le</span>
                <span className="text-foreground">{formatDate(run.endedAt)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── AI Diagnostic Tab ─────────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <DriveAiTab runUid={runUid} orgId={run.orgId ?? ''} />
        )}
      </div>
    </div>
  );
}

// ─── GPS Tab Content (map + collapsible table) ──────────────────────────────

// ─── File Parse Status Component ──────────────────────────────────────────

const GPS_EXTENSIONS = ['gpx', 'kml', 'csv', 'tsv'];

function FileParseStatus({ artifactUid, filename, runUid, orgId }: {
  artifactUid: string;
  filename: string;
  runUid: string;
  orgId: string;
}) {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const isGpsFile = GPS_EXTENSIONS.includes(ext);

  const { data: parseStatus, refetch } = trpc.driveUploads.parseStatus.useQuery(
    { artifactUid },
    { enabled: isGpsFile && !!artifactUid, refetchInterval: (query) => {
      const status = query.state.data?.status;
      return (status === 'PENDING' || status === 'RUNNING') ? 3000 : false;
    }}
  );

  const triggerParseMutation = trpc.driveUploads.triggerParse.useMutation({
    onSuccess: () => { toast.success('Parsing GPS lancé'); refetch(); },
    onError: (err) => toast.error(`Erreur: ${err.message}`),
  });

  if (!isGpsFile) return <span className="text-xs text-muted-foreground">—</span>;

  const status = parseStatus?.status ?? 'NONE';
  const latestJob = parseStatus?.jobs?.[parseStatus.jobs.length - 1];
  const result = latestJob?.result as any;

  const handleTrigger = () => {
    triggerParseMutation.mutate({ artifactUid, runUid, orgId, filename });
  };

  if (status === 'NONE') {
    return (
      <Button size="sm" variant="outline" onClick={handleTrigger} disabled={triggerParseMutation.isPending} className="text-xs h-7">
        {triggerParseMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileCheck className="w-3 h-3 mr-1" />}
        Parser GPS
      </Button>
    );
  }

  if (status === 'PENDING' || status === 'RUNNING') {
    return (
      <Badge className="bg-blue-500/20 text-blue-300 text-xs">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        {status === 'PENDING' ? 'En attente' : 'Parsing...'}
      </Badge>
    );
  }

  if (status === 'DONE') {
    const count = result?.samplesInserted ?? 0;
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {count} pts
        </Badge>
        <Button size="sm" variant="ghost" onClick={handleTrigger} disabled={triggerParseMutation.isPending} className="h-6 w-6 p-0" title="Re-parser">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-red-500/20 text-red-300 text-xs">
          <XCircle className="w-3 h-3 mr-1" />
          Erreur
        </Badge>
        <Button size="sm" variant="ghost" onClick={handleTrigger} disabled={triggerParseMutation.isPending} className="h-6 w-6 p-0" title="Réessayer">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return null;
}

// ─── GPS Tab Content (map + collapsible table) ──────────────────────────────

function GpsTabContent({ samples, formatDate }: { samples: any[]; formatDate: (d: any) => string }) {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="space-y-4">
      {/* Map + stats */}
      <DriveGpsMap samples={samples} />

      {/* Collapsible raw data table */}
      {samples.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowTable(!showTable)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Données brutes ({samples.length} points)</span>
            {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showTable && (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border-t border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Latitude</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Longitude</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Altitude</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Vitesse</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Précision</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Horodatage</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s: any, i: number) => (
                    <tr key={s.id ?? i} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5 font-mono">{s.lat?.toFixed(6)}</td>
                      <td className="px-3 py-1.5 font-mono">{s.lon?.toFixed(6)}</td>
                      <td className="px-3 py-1.5">{s.altitudeM != null ? `${s.altitudeM.toFixed(0)}m` : '—'}</td>
                      <td className="px-3 py-1.5">{s.speedMps != null ? `${(s.speedMps * 3.6).toFixed(1)} km/h` : '—'}</td>
                      <td className="px-3 py-1.5">{s.accuracyM != null ? `±${s.accuracyM.toFixed(0)}m` : '—'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{formatDate(s.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
