import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "../state/projectStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  GitCompareArrows,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  Bug,
  Equal,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  PASSED: { icon: CheckCircle2, color: "text-emerald-400", label: "Réussi" },
  FAILED: { icon: XCircle, color: "text-red-400", label: "Échoué" },
  ERROR: { icon: AlertTriangle, color: "text-orange-400", label: "Erreur" },
  RUNNING: { icon: Clock, color: "text-blue-400", label: "En cours" },
  PENDING: { icon: Clock, color: "text-muted-foreground", label: "En attente" },
  CANCELLED: { icon: XCircle, color: "text-muted-foreground", label: "Annulé" },
};

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
}

export default function CompareExecutionsPage() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id ?? "";

  const [idA, setIdA] = useState<number | null>(null);
  const [idB, setIdB] = useState<number | null>(null);
  const [showSelector, setShowSelector] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true, details: true, artifacts: false, incidents: false,
  });

  // Load executions list for selection
  const { data: execList } = trpc.executions.list.useQuery(
    { projectId, pageSize: 100 },
    { enabled: !!projectId }
  );

  // Load comparison when both IDs are set
  const { data: comparison, isLoading, error } = trpc.executions.compare.useQuery(
    { executionIdA: idA!, executionIdB: idB! },
    { enabled: idA !== null && idB !== null }
  );

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCompare = () => {
    if (idA === null || idB === null) {
      toast.error("Sélectionnez deux exécutions à comparer");
      return;
    }
    if (idA === idB) {
      toast.error("Sélectionnez deux exécutions différentes");
      return;
    }
    setShowSelector(false);
  };

  const execOptions = useMemo(() => {
    return (execList?.data ?? []).map(e => ({
      id: e.id,
      label: `#${e.id} — ${e.status} — ${e.targetEnv ?? "—"} — ${formatDate(e.createdAt)}`,
    }));
  }, [execList]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/executions">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <GitCompareArrows className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-heading font-bold text-foreground">Comparer des exécutions</h1>
      </div>

      {/* Selector */}
      {showSelector && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Sélectionnez deux exécutions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Exécution A</label>
              <select
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
                value={idA ?? ""}
                onChange={e => setIdA(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Choisir —</option>
                {execOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Exécution B</label>
              <select
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
                value={idB ?? ""}
                onChange={e => setIdB(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Choisir —</option>
                {execOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={handleCompare} disabled={idA === null || idB === null}>
            <GitCompareArrows className="w-4 h-4 mr-2" />
            Comparer
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && !showSelector && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          {error.message}
        </div>
      )}

      {/* Comparison Results */}
      {comparison && !showSelector && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setShowSelector(true)}>
              <ArrowUpDown className="w-3 h-3 mr-1" />
              Changer la sélection
            </Button>
          </div>

          {/* Summary Section */}
          <SectionHeader
            title="Résumé de la comparaison"
            expanded={expandedSections.summary}
            onToggle={() => toggleSection("summary")}
          />
          {expandedSections.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="Statuts"
                match={comparison.summary.statusMatch}
                valueA={comparison.a.status}
                valueB={comparison.b.status}
              />
              <SummaryCard
                label="Durée"
                match={comparison.summary.durationDiffMs === 0}
                valueA={formatDuration(comparison.a.durationMs)}
                valueB={formatDuration(comparison.b.durationMs)}
                diff={comparison.summary.durationDiffMs !== 0 ? `${comparison.summary.durationDiffMs > 0 ? "+" : ""}${formatDuration(comparison.summary.durationDiffMs)}` : undefined}
              />
              <SummaryCard
                label="Artefacts"
                match={comparison.summary.artifactCountDiff === 0}
                valueA={String(comparison.a.artifacts.length)}
                valueB={String(comparison.b.artifacts.length)}
              />
              <SummaryCard
                label="Incidents"
                match={comparison.summary.incidentCountDiff === 0}
                valueA={String(comparison.a.incidents.length)}
                valueB={String(comparison.b.incidents.length)}
              />
            </div>
          )}

          {/* Details Section */}
          <SectionHeader
            title="Détails des exécutions"
            expanded={expandedSections.details}
            onToggle={() => toggleSection("details")}
          />
          {expandedSections.details && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ExecutionCard exec={comparison.a} label="A" />
              <ExecutionCard exec={comparison.b} label="B" />
            </div>
          )}

          {/* Artifacts Section */}
          <SectionHeader
            title={`Artefacts (${comparison.a.artifacts.length} vs ${comparison.b.artifacts.length})`}
            expanded={expandedSections.artifacts}
            onToggle={() => toggleSection("artifacts")}
          />
          {expandedSections.artifacts && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ArtifactList artifacts={comparison.a.artifacts} label="A" />
              <ArtifactList artifacts={comparison.b.artifacts} label="B" />
            </div>
          )}

          {/* Incidents Section */}
          <SectionHeader
            title={`Incidents (${comparison.a.incidents.length} vs ${comparison.b.incidents.length})`}
            expanded={expandedSections.incidents}
            onToggle={() => toggleSection("incidents")}
          />
          {expandedSections.incidents && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <IncidentList incidents={comparison.a.incidents} label="A" />
              <IncidentList incidents={comparison.b.incidents} label="B" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full text-left py-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
    >
      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      {title}
    </button>
  );
}

function SummaryCard({ label, match, valueA, valueB, diff }: {
  label: string; match: boolean; valueA: string; valueB: string; diff?: string;
}) {
  return (
    <div className={`bg-card border rounded-lg p-3 ${match ? "border-emerald-500/30" : "border-orange-500/30"}`}>
      <div className="flex items-center gap-1.5 mb-2">
        {match ? <Equal className="w-3 h-3 text-emerald-400" /> : <ArrowUpDown className="w-3 h-3 text-orange-400" />}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground font-mono">A: {valueA}</span>
        <span className="text-foreground font-mono">B: {valueB}</span>
      </div>
      {diff && <div className="text-xs text-orange-400 mt-1 font-mono">{diff}</div>}
    </div>
  );
}

function ExecutionCard({ exec, label }: { exec: any; label: string }) {
  const cfg = statusConfig[exec.status] ?? statusConfig.PENDING;
  const Icon = cfg.icon;
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-primary">Exécution {label} — #{exec.id}</span>
        <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
          <Icon className="w-3 h-3" /> {cfg.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">Scénario:</span> <span className="text-foreground">{exec.scenario?.name ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Profil:</span> <span className="text-foreground">{exec.profile?.name ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Env:</span> <span className="text-foreground">{exec.targetEnv ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Durée:</span> <span className="text-foreground">{formatDuration(exec.durationMs)}</span></div>
        <div><span className="text-muted-foreground">Démarré:</span> <span className="text-foreground">{formatDate(exec.startedAt)}</span></div>
        <div><span className="text-muted-foreground">Terminé:</span> <span className="text-foreground">{formatDate(exec.finishedAt)}</span></div>
        <div><span className="text-muted-foreground">Runner:</span> <span className="text-foreground font-mono">{exec.runnerType ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Script v:</span> <span className="text-foreground">{exec.scriptVersion ?? "—"}</span></div>
      </div>
    </div>
  );
}

function ArtifactList({ artifacts, label }: { artifacts: any[]; label: string }) {
  if (!artifacts.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 text-center text-xs text-muted-foreground">
        <FileText className="w-5 h-5 mx-auto mb-1 opacity-50" />
        Aucun artefact ({label})
      </div>
    );
  }
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <div className="text-xs font-semibold text-foreground mb-2">Exécution {label} ({artifacts.length})</div>
      {artifacts.map(a => (
        <div key={a.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
          <div className="flex items-center gap-2">
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span className="text-foreground font-mono truncate max-w-[200px]">{a.filename}</span>
          </div>
          <span className="text-muted-foreground">{a.type}</span>
        </div>
      ))}
    </div>
  );
}

function IncidentList({ incidents, label }: { incidents: any[]; label: string }) {
  if (!incidents.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 text-center text-xs text-muted-foreground">
        <Bug className="w-5 h-5 mx-auto mb-1 opacity-50" />
        Aucun incident ({label})
      </div>
    );
  }
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <div className="text-xs font-semibold text-foreground mb-2">Exécution {label} ({incidents.length})</div>
      {incidents.map((inc: any) => (
        <div key={inc.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
          <div className="flex items-center gap-2">
            <Bug className="w-3 h-3 text-red-400" />
            <span className="text-foreground truncate max-w-[200px]">{inc.title ?? inc.type ?? `Incident #${inc.id}`}</span>
          </div>
          <span className={`text-xs ${inc.severity === "HIGH" || inc.severity === "CRITICAL" ? "text-red-400" : "text-orange-400"}`}>
            {inc.severity ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
