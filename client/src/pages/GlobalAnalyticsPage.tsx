import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Loader2, BarChart3, TrendingUp, Clock, FolderKanban,
  AlertTriangle, Radio, Briefcase, ShieldAlert, Download,
  Calendar, RotateCcw, Check
} from "lucide-react";
import { Chart, registerables } from "chart.js";
import { toast } from 'sonner';

Chart.register(...registerables);

// ─── URL query param helpers ────────────────────────────────────────────────
function getSearchParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function setSearchParams(params: Record<string, string | undefined>) {
  const sp = getSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") sp.delete(k);
    else sp.set(k, v);
  }
  const qs = sp.toString();
  const newUrl = window.location.pathname + (qs ? `?${qs}` : "");
  window.history.replaceState(null, "", newUrl);
}

function readParamDate(key: string): string {
  const v = getSearchParams().get(key);
  if (!v) return "";
  // Validate ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return "";
}

function readParamPeriod(): "week" | "month" {
  const v = getSearchParams().get("period");
  if (v === "month") return "month";
  return "week";
}

// ─── Presets ────────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = formatDate(now);
  switch (preset) {
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: formatDate(d), to };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { from: formatDate(d), to };
    }
    case "90d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return { from: formatDate(d), to };
    }
    case "ytd": {
      return { from: `${now.getFullYear()}-01-01`, to };
    }
    default:
      return { from: "", to: "" };
  }
}

const PRESETS = [
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
  { key: "90d", label: "90 jours" },
  { key: "ytd", label: "Depuis janv." },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDuration(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function GlobalAnalyticsPage() {
  const [period, setPeriod] = useState<"week" | "month">(readParamPeriod);
  const [fromDate, setFromDate] = useState<string>(readParamDate("from"));
  const [toDate, setToDate] = useState<string>(readParamDate("to"));
  const [activePreset, setActivePreset] = useState<string>("");
  const [pdfExporting, setPdfExporting] = useState(false);

  // Sync URL params on state change
  useEffect(() => {
    setSearchParams({ period, from: fromDate || undefined, to: toDate || undefined });
  }, [period, fromDate, toDate]);

  // Stabilize query input
  const queryInput = useMemo(() => ({
    period,
    from: fromDate || undefined,
    to: toDate || undefined,
  }), [period, fromDate, toDate]);

  const { data, isLoading } = trpc.analytics.globalDashboard.useQuery(
    queryInput,
    { refetchInterval: 60_000 }
  );

  // ─── Preset handlers ─────────────────────────────────────────────────────
  const applyPreset = useCallback((preset: string) => {
    const { from, to } = getPresetRange(preset);
    setFromDate(from);
    setToDate(to);
    setActivePreset(preset);
  }, []);

  const resetDates = useCallback(() => {
    setFromDate("");
    setToDate("");
    setActivePreset("");
  }, []);

  // ─── PDF Export (client-side: capture charts + generate printable HTML) ────
  const handleExportPdf = useCallback(async () => {
    if (pdfExporting || !data) return;
    setPdfExporting(true);
    try {
      // Capture chart images from canvas
      const chartImages: Record<string, string> = {};
      const canvases = [
        { ref: runsBarRef, key: "runs", title: "Exécutions par période" },
        { ref: successLineRef, key: "successRate", title: "Tendance du taux de succès" },
        { ref: incidentsBarRef, key: "incidents", title: "Incidents par sévérité" },
        { ref: probesDoughnutRef, key: "probes", title: "Santé des sondes" },
        { ref: projectBarRef, key: "perProject", title: "Exécutions par projet" },
      ];
      for (const { ref, key } of canvases) {
        if (ref.current) {
          chartImages[key] = ref.current.toDataURL("image/png");
        }
      }

      const kpis = data.kpis;
      const now = new Date().toLocaleString("fr-FR");
      const rangeLabel = fromDate && toDate ? `${fromDate} → ${toDate}` : "Toutes les données";

      const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Dashboard Analytique — AgilesTest</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; background: #fff; color: #1e293b; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .kpi .label { font-size: 11px; color: #64748b; text-transform: uppercase; }
  .kpi .value { font-size: 22px; font-weight: 700; font-family: monospace; margin-top: 4px; }
  .chart-section { margin-bottom: 20px; page-break-inside: avoid; }
  .chart-section h3 { font-size: 14px; margin-bottom: 8px; color: #334155; }
  .chart-section img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; }
  th, td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  th { background: #f8fafc; font-weight: 600; color: #475569; }
  .text-right { text-align: right; }
  .text-green { color: #16a34a; } .text-red { color: #dc2626; } .text-yellow { color: #ca8a04; }
  @media print { body { padding: 12px; } .chart-section { page-break-inside: avoid; } }
</style></head>
<body>
<h1>Dashboard Analytique — AgilesTest</h1>
<div class="meta">Période : ${period === "week" ? "Semaine" : "Mois"} | Plage : ${rangeLabel} | Généré le ${now}</div>

<div class="kpi-grid">
  <div class="kpi"><div class="label">Exécutions</div><div class="value">${kpis?.totalRuns ?? 0}</div></div>
  <div class="kpi"><div class="label">Taux succès</div><div class="value ${(kpis?.successRate ?? 0) >= 80 ? 'text-green' : (kpis?.successRate ?? 0) >= 50 ? 'text-yellow' : 'text-red'}">${kpis?.successRate ?? 0}%</div></div>
  <div class="kpi"><div class="label">Réussis</div><div class="value text-green">${kpis?.passedRuns ?? 0}</div></div>
  <div class="kpi"><div class="label">Échoués</div><div class="value text-red">${kpis?.failedRuns ?? 0}</div></div>
  <div class="kpi"><div class="label">Durée moy.</div><div class="value">${formatDuration(kpis?.avgDurationMs ?? null)}</div></div>
  <div class="kpi"><div class="label">Projets</div><div class="value">${kpis?.projectCount ?? 0}</div></div>
  <div class="kpi"><div class="label">Incidents</div><div class="value">${kpis?.openIncidents ?? 0}</div></div>
  <div class="kpi"><div class="label">Sondes RED</div><div class="value ${(kpis?.redProbes ?? 0) > 0 ? 'text-red' : 'text-green'}">${kpis?.redProbes ?? 0}</div></div>
  <div class="kpi"><div class="label">Jobs file</div><div class="value">${kpis?.jobsBacklog ?? 0}</div></div>
</div>

${Object.entries(chartImages).map(([key, src]) => {
  const title = canvases.find(c => c.key === key)?.title || key;
  return `<div class="chart-section"><h3>${title}</h3><img src="${src}" /></div>`;
}).join("\n")}

${data.topFailed && data.topFailed.length > 0 ? `
<h3>Top scénarios échoués</h3>
<table><thead><tr><th>#</th><th>Scénario</th><th>Projet</th><th class="text-right">Échecs</th></tr></thead>
<tbody>${data.topFailed.map((r: any, i: number) => `<tr><td>${i+1}</td><td>${r.scenarioName}</td><td>${r.projectName}</td><td class="text-right text-red">${r.failCount}</td></tr>`).join("")}</tbody></table>` : ""}

${data.perProject && data.perProject.length > 0 ? `
<h3>Détail par projet</h3>
<table><thead><tr><th>Projet</th><th class="text-right">Total</th><th class="text-right">Réussis</th><th class="text-right">Échoués</th><th class="text-right">Taux</th><th class="text-right">Durée moy.</th></tr></thead>
<tbody>${data.perProject.map((r: any) => `<tr><td>${r.projectName}</td><td class="text-right">${r.totalRuns}</td><td class="text-right text-green">${r.passed}</td><td class="text-right text-red">${r.failed}</td><td class="text-right">${r.successRate}%</td><td class="text-right">${formatDuration(r.avgDurationMs)}</td></tr>`).join("")}</tbody></table>` : ""}

<div class="meta" style="margin-top:32px;">Rapport généré automatiquement par AgilesTest Cloud.</div>
</body></html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-analytique-${period}-${fromDate || 'all'}-${toDate || 'all'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Rapport exporté — ouvrez le fichier HTML et utilisez Ctrl+P pour imprimer en PDF");
    } catch (err: any) {
      toast.error(err.message || "Échec de la génération");
    } finally {
      setPdfExporting(false);
    }
  }, [pdfExporting, period, fromDate, toDate, data]);

  // Chart refs
  const runsBarRef = useRef<HTMLCanvasElement>(null);
  const runsBarChartRef = useRef<Chart | null>(null);
  const successLineRef = useRef<HTMLCanvasElement>(null);
  const successLineChartRef = useRef<Chart | null>(null);
  const incidentsBarRef = useRef<HTMLCanvasElement>(null);
  const incidentsBarChartRef = useRef<Chart | null>(null);
  const probesDoughnutRef = useRef<HTMLCanvasElement>(null);
  const probesDoughnutChartRef = useRef<Chart | null>(null);
  const projectBarRef = useRef<HTMLCanvasElement>(null);
  const projectBarChartRef = useRef<Chart | null>(null);

  // ─── Stacked Bar: Runs (PASSED/FAILED/ABORTED) ──────────────────────────
  useEffect(() => {
    if (!data?.runs || !runsBarRef.current) return;
    if (runsBarChartRef.current) runsBarChartRef.current.destroy();
    runsBarChartRef.current = new Chart(runsBarRef.current, {
      type: "bar",
      data: {
        labels: data.runs.labels,
        datasets: [
          { label: "Réussis", data: data.runs.passed, backgroundColor: "#22c55e" },
          { label: "Échoués", data: data.runs.failed, backgroundColor: "#ef4444" },
          { label: "Annulés", data: data.runs.aborted, backgroundColor: "#f59e0b" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          x: { stacked: true, ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
          y: { stacked: true, ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
        },
      },
    });
    return () => { runsBarChartRef.current?.destroy(); };
  }, [data?.runs]);

  // ─── Line: Success Rate ──────────────────────────────────────────────────
  useEffect(() => {
    if (!data?.runs || !successLineRef.current) return;
    if (successLineChartRef.current) successLineChartRef.current.destroy();
    successLineChartRef.current = new Chart(successLineRef.current, {
      type: "line",
      data: {
        labels: data.runs.labels,
        datasets: [
          {
            label: "Taux de succès (%)", data: data.runs.successRate,
            borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.1)",
            fill: true, tension: 0.3, yAxisID: "y",
          },
          {
            label: "Total exécutions", data: data.runs.total,
            borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.1)",
            fill: false, tension: 0.3, yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          x: { ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
          y: { type: "linear", position: "left", min: 0, max: 100, ticks: { color: "#22c55e", callback: (v) => `${v}%` }, grid: { color: "rgba(100,116,139,0.15)" } },
          y1: { type: "linear", position: "right", min: 0, ticks: { color: "#6366f1" }, grid: { drawOnChartArea: false } },
        },
      },
    });
    return () => { successLineChartRef.current?.destroy(); };
  }, [data?.runs]);

  // ─── Stacked Bar: Incidents by severity ──────────────────────────────────
  useEffect(() => {
    if (!data?.incidents || !incidentsBarRef.current) return;
    if (incidentsBarChartRef.current) incidentsBarChartRef.current.destroy();
    incidentsBarChartRef.current = new Chart(incidentsBarRef.current, {
      type: "bar",
      data: {
        labels: data.incidents.labels,
        datasets: [
          { label: "Critique", data: data.incidents.critical, backgroundColor: "#dc2626" },
          { label: "Majeur", data: data.incidents.high, backgroundColor: "#f97316" },
          { label: "Mineur", data: data.incidents.med, backgroundColor: "#eab308" },
          { label: "Info", data: data.incidents.low, backgroundColor: "#3b82f6" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          x: { stacked: true, ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
          y: { stacked: true, ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
        },
      },
    });
    return () => { incidentsBarChartRef.current?.destroy(); };
  }, [data?.incidents]);

  // ─── Doughnut: Probes health ─────────────────────────────────────────────
  useEffect(() => {
    if (!data?.probes || !probesDoughnutRef.current) return;
    if (probesDoughnutChartRef.current) probesDoughnutChartRef.current.destroy();
    const { green, orange, red } = data.probes;
    const totalProbes = green + orange + red;
    probesDoughnutChartRef.current = new Chart(probesDoughnutRef.current, {
      type: "doughnut",
      data: {
        labels: ["En ligne", "Dégradé", "Hors ligne"],
        datasets: [{
          data: totalProbes > 0 ? [green, orange, red] : [1],
          backgroundColor: totalProbes > 0 ? ["#22c55e", "#f59e0b", "#ef4444"] : ["#334155"],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "65%",
        plugins: { legend: { position: "bottom", labels: { color: "#94a3b8", padding: 12 } } },
      },
    });
    return () => { probesDoughnutChartRef.current?.destroy(); };
  }, [data?.probes]);

  // ─── Bar: Per-project ────────────────────────────────────────────────────
  useEffect(() => {
    if (!data?.perProject?.length || !projectBarRef.current) return;
    if (projectBarChartRef.current) projectBarChartRef.current.destroy();
    const labels = data.perProject.map((p) => p.projectName);
    projectBarChartRef.current = new Chart(projectBarRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Réussis", data: data.perProject.map((p) => p.passed), backgroundColor: "#22c55e" },
          { label: "Échoués", data: data.perProject.map((p) => p.failed), backgroundColor: "#ef4444" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          x: { stacked: true, ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
          y: { stacked: true, ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
        },
      },
    });
    return () => { projectBarChartRef.current?.destroy(); };
  }, [data?.perProject]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Analytique Globale
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Vue cross-projets — auto-refresh 60s
              {fromDate && toDate && (
                <span className="ml-2 text-primary">
                  ({fromDate} → {toDate})
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Export PDF */}
            <button
              onClick={handleExportPdf}
              disabled={pdfExporting || !data}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {pdfExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {pdfExporting ? "Génération..." : "Export PDF"}
            </button>
            {/* Period selector */}
            {(["week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                {p === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>
        </div>

        {/* Date range filter bar */}
        <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Du</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setActivePreset(""); }}
              className="bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Au</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setActivePreset(""); }}
              className="bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
            />
          </div>
          <div className="h-5 w-px bg-border mx-1" />
          {/* Presets */}
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                activePreset === p.key
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="h-5 w-px bg-border mx-1" />
          <button
            onClick={resetDates}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Réinitialiser les dates"
          >
            <RotateCcw className="w-3 h-3" />
            Réinitialiser
          </button>
          {fromDate && toDate && fromDate > toDate && (
            <span className="text-xs text-red-400 ml-2">⚠ La date de début doit être ≤ date de fin</span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          <KpiCard icon={<BarChart3 className="w-4 h-4" />} label="Exécutions" value={String(kpis.totalRuns)} />
          <KpiCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Taux succès"
            value={`${kpis.successRate}%`}
            color={kpis.successRate >= 80 ? "text-green-400" : kpis.successRate >= 50 ? "text-yellow-400" : "text-red-400"}
          />
          <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Réussis" value={String(kpis.passedRuns)} color="text-green-400" />
          <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Échoués" value={String(kpis.failedRuns)} color="text-red-400" />
          <KpiCard icon={<Clock className="w-4 h-4" />} label="Durée moy." value={formatDuration(kpis.avgDurationMs)} />
          <KpiCard icon={<FolderKanban className="w-4 h-4" />} label="Projets" value={String(kpis.projectCount)} />
          <KpiCard icon={<ShieldAlert className="w-4 h-4" />} label="Incidents" value={String(kpis.openIncidents)} color="text-orange-400" />
          <KpiCard icon={<Radio className="w-4 h-4" />} label="Sondes RED" value={String(kpis.redProbes)} color={kpis.redProbes > 0 ? "text-red-400" : "text-green-400"} />
          <KpiCard icon={<Briefcase className="w-4 h-4" />} label="Jobs file" value={String(kpis.jobsBacklog)} color={kpis.jobsBacklog > 5 ? "text-yellow-400" : "text-foreground"} />
        </div>
      )}

      {/* Charts row 1: Runs stacked bar + Success rate line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Exécutions par période
          </h3>
          <div style={{ height: 280 }}>
            <canvas ref={runsBarRef} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Tendance du taux de succès
          </h3>
          <div style={{ height: 280 }}>
            <canvas ref={successLineRef} />
          </div>
        </div>
      </div>

      {/* Charts row 2: Incidents stacked bar + Probes doughnut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 lg:col-span-2">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            Incidents par sévérité
          </h3>
          <div style={{ height: 280 }}>
            <canvas ref={incidentsBarRef} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4 text-green-400" />
            Santé des sondes
          </h3>
          <div style={{ height: 240 }}>
            <canvas ref={probesDoughnutRef} />
          </div>
          {data?.probes && (
            <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {data.probes.green} en ligne
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                {data.probes.orange} dégradé
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {data.probes.red} hors ligne
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Charts row 3: Per-project bar */}
      {data?.perProject && data.perProject.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-primary" />
            Exécutions par projet
          </h3>
          <div style={{ height: 280 }}>
            <canvas ref={projectBarRef} />
          </div>
        </div>
      )}

      {/* Top Failed Scenarios */}
      {data?.topFailed && data.topFailed.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Top scénarios échoués
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Scénario</th>
                  <th className="text-left py-2 px-3">Projet</th>
                  <th className="text-right py-2 px-3">Échecs</th>
                </tr>
              </thead>
              <tbody>
                {data.topFailed.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-3 text-foreground font-medium">{row.scenarioName}</td>
                    <td className="py-2 px-3 text-muted-foreground">{row.projectName}</td>
                    <td className="py-2 px-3 text-right">
                      <span className="text-red-400 font-mono font-bold">{row.failCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-project table */}
      {data?.perProject && data.perProject.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-primary" />
            Détail par projet
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-3">Projet</th>
                  <th className="text-right py-2 px-3">Total</th>
                  <th className="text-right py-2 px-3">Réussis</th>
                  <th className="text-right py-2 px-3">Échoués</th>
                  <th className="text-right py-2 px-3">Taux</th>
                  <th className="text-right py-2 px-3">Durée moy.</th>
                </tr>
              </thead>
              <tbody>
                {data.perProject.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 text-foreground font-medium">{row.projectName}</td>
                    <td className="py-2 px-3 text-right font-mono">{row.totalRuns}</td>
                    <td className="py-2 px-3 text-right font-mono text-green-400">{row.passed}</td>
                    <td className="py-2 px-3 text-right font-mono text-red-400">{row.failed}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-mono font-bold ${
                        row.successRate >= 80 ? "text-green-400" : row.successRate >= 50 ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {row.successRate}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                      {formatDuration(row.avgDurationMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!data?.runs?.labels?.length && !data?.perProject?.length && !isLoading && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-foreground font-medium mb-1">Aucune donnée</h3>
          <p className="text-sm text-muted-foreground">
            Lancez des exécutions pour voir les statistiques apparaître ici.
          </p>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono ${color || "text-foreground"}`}>{value}</div>
    </div>
  );
}
