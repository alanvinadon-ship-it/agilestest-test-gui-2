import { useTestContext, type TestStatus } from "@/contexts/TestContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  ChevronDown,
  ChevronRight,
  Network,
  Shield,
  HardDrive,
  Download,
  AlertTriangle,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

const SPAN_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663315306103/cqSqpcgwQMzGenJd.png";

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "passed": return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    case "failed": return <XCircle className="w-5 h-5 text-red-400" />;
    case "running": return <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />;
    case "skipped": return <SkipForward className="w-5 h-5 text-muted-foreground" />;
    default: return <Clock className="w-5 h-5 text-muted-foreground/50" />;
  }
}

export default function SpanPage() {
  const { campaigns, activeCampaign, setActiveCampaign, updateStepStatus, startCampaign } = useTestContext();
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const currentCampaign = activeCampaign?.type === "span" ? activeCampaign : campaigns.find(c => c.type === "span");

  useEffect(() => {
    if (currentCampaign) {
      const updated = campaigns.find(c => c.id === currentCampaign.id);
      if (updated && updated !== activeCampaign) setActiveCampaign(updated);
    }
  }, [campaigns, currentCampaign, activeCampaign, setActiveCampaign]);

  const handleStart = useCallback(() => {
    startCampaign("span");
    toast.success("Campagne SPAN démarrée");
  }, [startCampaign]);

  const handleStepAction = useCallback((stepId: string, status: TestStatus) => {
    if (!currentCampaign) return;
    updateStepStatus(currentCampaign.id, stepId, status);
    const stepIdx = currentCampaign.steps.findIndex(s => s.id === stepId);
    if (stepIdx < currentCampaign.steps.length - 1) {
      setExpandedStep(currentCampaign.steps[stepIdx + 1].id);
    }
    toast(status === "passed" ? "Étape validée" : status === "failed" ? "Étape échouée" : "Étape ignorée");
  }, [currentCampaign, updateStepStatus]);

  const passedCount = currentCampaign?.steps.filter(s => s.status === "passed").length ?? 0;
  const failedCount = currentCampaign?.steps.filter(s => s.status === "failed").length ?? 0;
  const totalSteps = currentCampaign?.steps.length ?? 0;

  // Categorize steps
  const captureSteps = currentCampaign?.steps.filter(s => ["span-01", "span-02", "span-03", "span-04", "span-05"].includes(s.id)) ?? [];
  const artifactSteps = currentCampaign?.steps.filter(s => ["span-06", "span-07", "span-08", "span-09"].includes(s.id)) ?? [];
  const securitySteps = currentCampaign?.steps.filter(s => ["span-10", "span-11", "span-12"].includes(s.id)) ?? [];

  const renderStepGroup = (title: string, icon: React.ReactNode, steps: typeof captureSteps) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs font-mono text-muted-foreground">
          {steps.filter(s => s.status === "passed").length}/{steps.length}
        </span>
      </div>
      {steps.map((step, idx) => {
        const globalIdx = currentCampaign!.steps.findIndex(s => s.id === step.id);
        const prevDone = globalIdx === 0 || currentCampaign!.steps[globalIdx - 1].status !== "idle";
        const isActive = step.status === "idle" && prevDone;
        return (
          <div
            key={step.id}
            className={cn(
              "border rounded-md transition-all duration-200",
              isActive ? "border-cyan-500/50 bg-cyan-500/5" : "border-border bg-card",
              step.status === "passed" && "border-emerald-500/30 bg-emerald-500/5",
              step.status === "failed" && "border-red-500/30 bg-red-500/5"
            )}
          >
            <button
              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              className="w-full flex items-center gap-3 p-3 text-left"
            >
              <span className="font-mono text-xs text-muted-foreground w-6 shrink-0">
                {String(globalIdx + 1).padStart(2, "0")}
              </span>
              <StepStatusIcon status={step.status} />
              <div className="flex-1">
                <p className={cn("text-sm font-medium", step.status === "passed" ? "text-emerald-300" : step.status === "failed" ? "text-red-300" : "text-foreground")}>
                  {step.title}
                </p>
              </div>
              {expandedStep === step.id || isActive ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>
            {(expandedStep === step.id || isActive) && (
              <div className="px-3 pb-3 space-y-3">
                <Separator />
                <p className="text-sm text-muted-foreground">{step.description}</p>
                {(step.status === "idle" || step.status === "running") && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleStepAction(step.id, "passed")} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OK
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleStepAction(step.id, "failed")} className="gap-1">
                      <XCircle className="w-3.5 h-3.5" /> KO
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleStepAction(step.id, "skipped")} className="gap-1">
                      <SkipForward className="w-3.5 h-3.5" /> Skip
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Capture SPAN / TAP</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Validation de la chaîne de capture réseau — 12 étapes
          </p>
        </div>
        {!currentCampaign || currentCampaign.status !== "running" ? (
          <Button onClick={handleStart} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
            <Play className="w-4 h-4" />
            {currentCampaign ? "Relancer" : "Démarrer le test SPAN"}
          </Button>
        ) : (
          <Badge variant="outline" className="gap-1 text-cyan-400 border-cyan-400/50">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            En cours
          </Badge>
        )}
      </div>

      {currentCampaign ? (
        <>
          {/* Progress */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3 h-3" /> {passedCount}</span>
                  <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" /> {failedCount}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3" /> {totalSteps - passedCount - failedCount - (currentCampaign.steps.filter(s => s.status === "skipped").length)}</span>
                </div>
                <span className="font-mono text-sm text-foreground">{currentCampaign.progress}%</span>
              </div>
              <Progress value={currentCampaign.progress} className="h-3" />
            </CardContent>
          </Card>

          {/* Step groups */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>{renderStepGroup("Capture PCAP", <Network className="w-4 h-4 text-cyan-400" />, captureSteps)}</div>
            <div>{renderStepGroup("Artefacts & MinIO", <HardDrive className="w-4 h-4 text-blue-400" />, artifactSteps)}</div>
            <div>{renderStepGroup("Sécurité BPF", <Shield className="w-4 h-4 text-orange-400" />, securitySteps)}</div>
          </div>

          {/* Completion */}
          {currentCampaign.status !== "running" && (
            <Card className={cn("border", failedCount === 0 ? "border-emerald-500/50 bg-emerald-500/5" : "border-red-500/50 bg-red-500/5")}>
              <CardContent className="p-6 text-center">
                {failedCount === 0 ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="font-heading text-lg text-emerald-300">Chaîne de capture validée</p>
                    <p className="text-sm text-muted-foreground mt-1">Tous les tests SPAN/TAP sont passés avec succès.</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <p className="font-heading text-lg text-red-300">{failedCount} test(s) échoué(s)</p>
                    <p className="text-sm text-muted-foreground mt-1">Vérifiez les étapes en échec et corrigez les problèmes identifiés.</p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Empty state */
        <Card className="bg-card border-border overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
              <Network className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-heading text-lg text-foreground mb-2">Test de Capture SPAN</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Validez la chaîne complète de capture réseau : interface SPAN, agent probe, BPF, compression, upload MinIO, et sécurité.
              </p>
              <Button onClick={handleStart} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
                <Play className="w-4 h-4" /> Démarrer le test SPAN
              </Button>
            </CardContent>
            <div className="hidden lg:block">
              <img src={SPAN_IMG} alt="SPAN capture" className="w-full h-full object-cover opacity-40" />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
