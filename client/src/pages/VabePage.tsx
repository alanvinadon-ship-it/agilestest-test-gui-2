import { useTestContext, type VabeScenario, type TestStatus } from "@/contexts/TestContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Play,
  Square,
  Gauge,
  Activity,
  Cpu,
  MemoryStick,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  Zap,
} from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const VABE_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663315306103/EdCeetWnsZfgSyaj.png";

function ScenarioCard({
  scenario,
  onStart,
  onUpdateConfig,
}: {
  scenario: VabeScenario;
  onStart: () => void;
  onUpdateConfig: (key: string, value: number) => void;
}) {
  const typeColors: Record<string, string> = {
    "read-heavy": "text-blue-400",
    "create-upload": "text-orange-400",
    "reporting": "text-emerald-400",
    "combined": "text-purple-400",
  };

  const typeLabels: Record<string, string> = {
    "read-heavy": "Lecture intensive",
    "create-upload": "Création & Upload",
    "reporting": "Reporting",
    "combined": "Combiné (80/15/5)",
  };

  return (
    <Card className={cn(
      "bg-card border-border transition-all",
      scenario.status === "running" && "glow-border border-primary/50",
      scenario.status === "passed" && "border-emerald-500/30",
      scenario.status === "failed" && "border-red-500/30"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-sm flex items-center gap-2">
            <Gauge className={cn("w-4 h-4", typeColors[scenario.type])} />
            {scenario.name}
          </CardTitle>
          <Badge variant={scenario.status === "running" ? "default" : scenario.status === "passed" ? "default" : scenario.status === "failed" ? "destructive" : "secondary"}
            className={scenario.status === "passed" ? "bg-emerald-600" : ""}>
            {scenario.status === "idle" ? "Prêt" : scenario.status === "running" ? "En cours" : scenario.status === "passed" ? "Réussi" : "Échoué"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{typeLabels[scenario.type]}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground font-mono">VUs</Label>
            <Input
              type="number"
              value={scenario.config.vus}
              onChange={(e) => onUpdateConfig("vus", parseInt(e.target.value) || 0)}
              disabled={scenario.status === "running"}
              className="h-8 text-sm bg-secondary/50 border-border"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground font-mono">RPS</Label>
            <Input
              type="number"
              value={scenario.config.rps}
              onChange={(e) => onUpdateConfig("rps", parseInt(e.target.value) || 0)}
              disabled={scenario.status === "running"}
              className="h-8 text-sm bg-secondary/50 border-border"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground font-mono">Durée (s)</Label>
            <Input
              type="number"
              value={scenario.config.duration}
              onChange={(e) => onUpdateConfig("duration", parseInt(e.target.value) || 0)}
              disabled={scenario.status === "running"}
              className="h-8 text-sm bg-secondary/50 border-border"
            />
          </div>
        </div>

        {/* Results */}
        {scenario.results && (
          <>
            <Separator />
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary/30 rounded-md p-2 text-center">
                <Activity className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">p95 Latence</p>
                <p className={cn("text-sm font-mono font-semibold", scenario.results.p95Latency > 500 ? "text-red-400" : "text-emerald-400")}>
                  {scenario.results.p95Latency}ms
                </p>
              </div>
              <div className="bg-secondary/30 rounded-md p-2 text-center">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Taux Erreur</p>
                <p className={cn("text-sm font-mono font-semibold", scenario.results.errorRate > 1 ? "text-red-400" : "text-emerald-400")}>
                  {scenario.results.errorRate}%
                </p>
              </div>
              <div className="bg-secondary/30 rounded-md p-2 text-center">
                <Zap className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Avg RPS</p>
                <p className="text-sm font-mono font-semibold text-foreground">{scenario.results.avgRps}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary/30 rounded-md p-2 text-center">
                <BarChart3 className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Total Req</p>
                <p className="text-sm font-mono font-semibold text-foreground">{scenario.results.totalRequests.toLocaleString()}</p>
              </div>
              <div className="bg-secondary/30 rounded-md p-2 text-center">
                <Cpu className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">CPU Peak</p>
                <p className={cn("text-sm font-mono font-semibold", scenario.results.cpuPeak > 80 ? "text-red-400" : "text-emerald-400")}>
                  {scenario.results.cpuPeak}%
                </p>
              </div>
              <div className="bg-secondary/30 rounded-md p-2 text-center">
                <MemoryStick className="w-3.5 h-3.5 text-pink-400 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">RAM Peak</p>
                <p className={cn("text-sm font-mono font-semibold", scenario.results.memPeak > 80 ? "text-red-400" : "text-emerald-400")}>
                  {scenario.results.memPeak}%
                </p>
              </div>
            </div>
          </>
        )}

        {/* Action */}
        <Button
          onClick={onStart}
          disabled={scenario.status === "running"}
          className={cn("w-full gap-2", scenario.status === "running" && "opacity-50")}
          variant={scenario.status === "running" ? "outline" : "default"}
        >
          {scenario.status === "running" ? (
            <><Square className="w-4 h-4" /> Exécution en cours...</>
          ) : (
            <><Play className="w-4 h-4" /> Lancer le scénario</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function VabePage() {
  const { vabeScenarios, setVabeScenarios } = useTestContext();

  const simulateRun = useCallback((scenarioId: string) => {
    setVabeScenarios(prev => prev.map(s =>
      s.id === scenarioId ? { ...s, status: "running" as TestStatus } : s
    ));
    toast.info("Scénario k6 lancé (simulation)");

    // Simulate completion after a delay
    setTimeout(() => {
      setVabeScenarios(prev => prev.map(s => {
        if (s.id !== scenarioId) return s;
        const passed = Math.random() > 0.2;
        return {
          ...s,
          status: (passed ? "passed" : "failed") as TestStatus,
          results: {
            p95Latency: Math.round(150 + Math.random() * 400),
            errorRate: parseFloat((Math.random() * 3).toFixed(2)),
            avgRps: Math.round(s.config.rps * (0.7 + Math.random() * 0.3)),
            totalRequests: Math.round(s.config.rps * s.config.duration * (0.8 + Math.random() * 0.2)),
            cpuPeak: Math.round(40 + Math.random() * 50),
            memPeak: Math.round(30 + Math.random() * 50),
          },
        };
      }));
      toast.success("Scénario k6 terminé");
    }, 3000 + Math.random() * 2000);
  }, [setVabeScenarios]);

  const handleUpdateConfig = useCallback((scenarioId: string, key: string, value: number) => {
    setVabeScenarios(prev => prev.map(s =>
      s.id === scenarioId ? { ...s, config: { ...s.config, [key]: value } } : s
    ));
  }, [setVabeScenarios]);

  const allDone = vabeScenarios.every(s => s.status === "passed" || s.status === "failed");
  const allPassed = vabeScenarios.every(s => s.status === "passed");
  const anyFailed = vabeScenarios.some(s => s.status === "failed");

  // GO/NO-GO thresholds
  const goNoGo = allDone ? {
    isGo: vabeScenarios.every(s => s.results && s.results.p95Latency <= 500 && s.results.errorRate <= 1),
    details: vabeScenarios.map(s => ({
      name: s.name,
      latencyOk: (s.results?.p95Latency ?? 0) <= 500,
      errorOk: (s.results?.errorRate ?? 0) <= 1,
      cpuOk: (s.results?.cpuPeak ?? 0) <= 80,
    })),
  } : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">VABE — Tests de Charge</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Validation d'Aptitude à la Bonne Exploitabilité — 4 scénarios k6
          </p>
        </div>
      </div>

      {/* Thresholds info */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-xs font-mono">
            <span className="text-muted-foreground">Seuils GO :</span>
            <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-blue-400" /> p95 ≤ 500ms</span>
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-orange-400" /> Erreur ≤ 1%</span>
            <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-cyan-400" /> CPU ≤ 80%</span>
            <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3 text-pink-400" /> RAM ≤ 80%</span>
          </div>
        </CardContent>
      </Card>

      {/* Scenarios grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vabeScenarios.map(scenario => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            onStart={() => simulateRun(scenario.id)}
            onUpdateConfig={(key, value) => handleUpdateConfig(scenario.id, key, value)}
          />
        ))}
      </div>

      {/* GO/NO-GO */}
      {goNoGo && (
        <Card className={cn("border", goNoGo.isGo ? "border-emerald-500/50 bg-emerald-500/5" : "border-red-500/50 bg-red-500/5")}>
          <CardHeader>
            <CardTitle className={cn("font-heading text-lg flex items-center gap-2", goNoGo.isGo ? "text-emerald-400" : "text-red-400")}>
              {goNoGo.isGo ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              VABE — {goNoGo.isGo ? "GO" : "NO-GO"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground font-mono border-b border-border">
                    <th className="text-left py-2 pr-4">Scénario</th>
                    <th className="text-center py-2 px-2">p95 ≤ 500ms</th>
                    <th className="text-center py-2 px-2">Erreur ≤ 1%</th>
                    <th className="text-center py-2 px-2">CPU ≤ 80%</th>
                  </tr>
                </thead>
                <tbody>
                  {goNoGo.details.map(d => (
                    <tr key={d.name} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-foreground">{d.name}</td>
                      <td className="text-center py-2 px-2">{d.latencyOk ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}</td>
                      <td className="text-center py-2 px-2">{d.errorOk ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}</td>
                      <td className="text-center py-2 px-2">{d.cpuOk ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
