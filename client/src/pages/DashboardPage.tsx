import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "../state/projectStore";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Radio,
  TrendingUp,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type Period = "week" | "month";

export default function DashboardPage() {
  const { currentProject } = useProject();
  const [period, setPeriod] = useState<Period>("week");

  const queryInput = useMemo(
    () => ({
      period,
      projectId: currentProject?.id,
    }),
    [period, currentProject?.id]
  );

  const { data, isLoading, refetch, isFetching } =
    trpc.analytics.dashboard.useQuery(queryInput, {
      refetchInterval: 60_000, // auto-refresh every 60s
      staleTime: 30_000,
    });

  const kpis = data?.kpis;
  const execSeries = data?.execSeries;
  const incidentSeries = data?.incidentSeries;
  const probesSeries = data?.probesSeries;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Tableau de bord
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d'ensemble analytique
            {currentProject ? ` — ${currentProject.name}` : " — Tous les projets"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex bg-muted rounded-md p-0.5">
            <button
              onClick={() => setPeriod("week")}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                period === "week"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                period === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mois
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Activity className="w-5 h-5" />}
          label="Exécutions"
          value={kpis?.totalRuns ?? 0}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
          loading={isLoading}
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Taux de succès"
          value={`${kpis?.successRate ?? 0}%`}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
          loading={isLoading}
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Incidents"
          value={kpis?.openIncidents ?? 0}
          color="text-amber-500"
          bgColor="bg-amber-500/10"
          loading={isLoading}
        />
        <KpiCard
          icon={<Radio className="w-5 h-5" />}
          label="Sondes RED"
          value={kpis?.redProbes ?? 0}
          color="text-red-500"
          bgColor="bg-red-500/10"
          loading={isLoading}
        />
      </div>

      {/* Charts Row 1: Executions + Success Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Execution Status Stacked Bar */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Exécutions par {period === "week" ? "semaine" : "mois"}
          </h3>
          {isLoading ? (
            <ChartSkeleton />
          ) : execSeries && execSeries.labels.length > 0 ? (
            <div style={{ height: 260 }}>
              <Bar
                data={{
                  labels: execSeries.labels,
                  datasets: [
                    {
                      label: "Réussis",
                      data: execSeries.passed,
                      backgroundColor: "rgba(16, 185, 129, 0.8)",
                      borderRadius: 3,
                    },
                    {
                      label: "Échoués",
                      data: execSeries.failed,
                      backgroundColor: "rgba(239, 68, 68, 0.8)",
                      borderRadius: 3,
                    },
                    {
                      label: "Annulés/Erreur",
                      data: execSeries.aborted,
                      backgroundColor: "rgba(156, 163, 175, 0.6)",
                      borderRadius: 3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", padding: 12, font: { size: 11 } } },
                  },
                  scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } },
                  },
                }}
              />
            </div>
          ) : (
            <EmptyChart message="Aucune exécution sur cette période" />
          )}
        </div>

        {/* Success Rate Line */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Taux de succès (%)
          </h3>
          {isLoading ? (
            <ChartSkeleton />
          ) : execSeries && execSeries.labels.length > 0 ? (
            <div style={{ height: 260 }}>
              <Line
                data={{
                  labels: execSeries.labels,
                  datasets: [
                    {
                      label: "Taux de succès",
                      data: execSeries.successRate,
                      borderColor: "rgba(16, 185, 129, 1)",
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                      fill: true,
                      tension: 0.3,
                      pointRadius: 4,
                      pointHoverRadius: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}%` } },
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%`, font: { size: 10 } } },
                  },
                }}
              />
            </div>
          ) : (
            <EmptyChart message="Aucune donnée de taux de succès" />
          )}
        </div>
      </div>

      {/* Charts Row 2: Incidents + Probes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Incidents Stacked Bar */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Incidents par {period === "week" ? "semaine" : "mois"}
          </h3>
          {isLoading ? (
            <ChartSkeleton />
          ) : incidentSeries && incidentSeries.labels.length > 0 ? (
            <div style={{ height: 260 }}>
              <Bar
                data={{
                  labels: incidentSeries.labels,
                  datasets: [
                    {
                      label: "Critique",
                      data: incidentSeries.critical,
                      backgroundColor: "rgba(220, 38, 38, 0.8)",
                      borderRadius: 3,
                    },
                    {
                      label: "Majeur",
                      data: incidentSeries.high,
                      backgroundColor: "rgba(245, 158, 11, 0.8)",
                      borderRadius: 3,
                    },
                    {
                      label: "Mineur",
                      data: incidentSeries.med,
                      backgroundColor: "rgba(59, 130, 246, 0.8)",
                      borderRadius: 3,
                    },
                    {
                      label: "Info",
                      data: incidentSeries.low,
                      backgroundColor: "rgba(156, 163, 175, 0.6)",
                      borderRadius: 3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", padding: 12, font: { size: 11 } } },
                  },
                  scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } },
                  },
                }}
              />
            </div>
          ) : (
            <EmptyChart message="Aucun incident sur cette période" />
          )}
        </div>

        {/* Probes Doughnut */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            État des sondes (temps réel)
          </h3>
          {isLoading ? (
            <ChartSkeleton />
          ) : probesSeries ? (
            <div className="flex items-center justify-center" style={{ height: 260 }}>
              <div style={{ width: 220, height: 220 }}>
                <Doughnut
                  data={{
                    labels: ["GREEN", "ORANGE", "RED"],
                    datasets: [
                      {
                        data: [
                          probesSeries.green[0] || 0,
                          probesSeries.orange[0] || 0,
                          probesSeries.red[0] || 0,
                        ],
                        backgroundColor: [
                          "rgba(16, 185, 129, 0.8)",
                          "rgba(245, 158, 11, 0.8)",
                          "rgba(239, 68, 68, 0.8)",
                        ],
                        borderWidth: 2,
                        borderColor: "transparent",
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "60%",
                    plugins: {
                      legend: {
                        position: "bottom",
                        labels: { usePointStyle: true, pointStyle: "circle", padding: 12, font: { size: 11 } },
                      },
                    },
                  }}
                />
              </div>
            </div>
          ) : (
            <EmptyChart message="Aucune sonde configurée" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  color,
  bgColor,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
  loading: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <div className="h-7 w-16 bg-muted animate-pulse rounded mt-0.5" />
          ) : (
            <p className="text-xl font-bold text-foreground">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center" style={{ height: 260 }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center" style={{ height: 260 }}>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
