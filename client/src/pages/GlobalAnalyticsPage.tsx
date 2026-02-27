import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, BarChart3, TrendingUp, Clock, FolderKanban, AlertTriangle } from "lucide-react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

export default function GlobalAnalyticsPage() {
  const [period, setPeriod] = useState<"week" | "month">("week");

  const { data, isLoading } = trpc.analytics.globalDashboard.useQuery({ period });

  // Chart refs
  const trendRef = useRef<HTMLCanvasElement>(null);
  const trendChartRef = useRef<Chart | null>(null);
  const projectRef = useRef<HTMLCanvasElement>(null);
  const projectChartRef = useRef<Chart | null>(null);

  // Trend chart
  useEffect(() => {
    if (!data?.trend || !trendRef.current) return;
    if (trendChartRef.current) trendChartRef.current.destroy();
    trendChartRef.current = new Chart(trendRef.current, {
      type: "line",
      data: {
        labels: data.trend.labels,
        datasets: [
          {
            label: "Taux de succès (%)",
            data: data.trend.successRate,
            borderColor: "#22c55e",
            backgroundColor: "rgba(34,197,94,0.1)",
            fill: true,
            tension: 0.3,
            yAxisID: "y",
          },
          {
            label: "Total exécutions",
            data: data.trend.total,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99,102,241,0.1)",
            fill: false,
            tension: 0.3,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          x: { ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
          y: {
            type: "linear",
            position: "left",
            min: 0,
            max: 100,
            ticks: { color: "#22c55e", callback: (v) => `${v}%` },
            grid: { color: "rgba(100,116,139,0.15)" },
          },
          y1: {
            type: "linear",
            position: "right",
            min: 0,
            ticks: { color: "#6366f1" },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
    return () => { trendChartRef.current?.destroy(); };
  }, [data?.trend]);

  // Per-project bar chart
  useEffect(() => {
    if (!data?.perProject?.length || !projectRef.current) return;
    if (projectChartRef.current) projectChartRef.current.destroy();
    const labels = data.perProject.map((p) => p.projectName);
    projectChartRef.current = new Chart(projectRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Réussis",
            data: data.perProject.map((p) => p.passed),
            backgroundColor: "#22c55e",
          },
          {
            label: "Échoués",
            data: data.perProject.map((p) => p.failed),
            backgroundColor: "#ef4444",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          x: { stacked: true, ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
          y: { stacked: true, ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
        },
      },
    });
    return () => { projectChartRef.current?.destroy(); };
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Analytique Globale
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue cross-projets de toutes les exécutions
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={<BarChart3 className="w-4 h-4" />} label="Exécutions" value={String(kpis.totalRuns)} />
          <KpiCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Taux de succès"
            value={`${kpis.successRate}%`}
            color={kpis.successRate >= 80 ? "text-green-400" : kpis.successRate >= 50 ? "text-yellow-400" : "text-red-400"}
          />
          <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Réussis" value={String(kpis.passedRuns)} color="text-green-400" />
          <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Échoués" value={String(kpis.failedRuns)} color="text-red-400" />
          <KpiCard icon={<Clock className="w-4 h-4" />} label="Durée moy." value={formatDuration(kpis.avgDurationMs)} />
          <KpiCard icon={<FolderKanban className="w-4 h-4" />} label="Projets" value={String(kpis.projectCount)} />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Tendance du taux de succès</h3>
          <div style={{ height: 280 }}>
            <canvas ref={trendRef} />
          </div>
        </div>

        {/* Per-project */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Exécutions par projet</h3>
          <div style={{ height: 280 }}>
            <canvas ref={projectRef} />
          </div>
        </div>
      </div>

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
