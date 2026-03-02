import { useTestContext, type TestStep, type TestStatus } from "@/contexts/TestContext";
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
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

function StepStatusIcon({ status }: { status: TestStatus }) {
  switch (status) {
    case "passed": return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    case "failed": return <XCircle className="w-5 h-5 text-red-400" />;
    case "running": return <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />;
    case "skipped": return <SkipForward className="w-5 h-5 text-muted-foreground" />;
    default: return <Clock className="w-5 h-5 text-muted-foreground/50" />;
  }
}

function StepCard({
  step,
  index,
  isActive,
  onPass,
  onFail,
  onSkip,
  onExpand,
  expanded,
}: {
  step: TestStep;
  index: number;
  isActive: boolean;
  onPass: () => void;
  onFail: () => void;
  onSkip: () => void;
  onExpand: () => void;
  expanded: boolean;
}) {
  const [notes, setNotes] = useState("");

  return (
    <div
      className={cn(
        "border rounded-md transition-all duration-200",
        isActive ? "border-primary/50 glow-border bg-primary/5" : "border-border bg-card",
        step.status === "passed" && "border-emerald-500/30 bg-emerald-500/5",
        step.status === "failed" && "border-red-500/30 bg-red-500/5"
      )}
    >
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="font-mono text-xs text-muted-foreground w-6 shrink-0">
          {String(index + 1).padStart(2, "0")}
        </span>
        <StepStatusIcon status={step.status} />
        <div className="flex-1">
          <p className={cn("text-sm font-medium", step.status === "passed" ? "text-emerald-300" : step.status === "failed" ? "text-red-300" : "text-foreground")}>
            {step.title}
          </p>
          {!expanded && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{step.description}</p>
          )}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <Separator />
          <p className="text-sm text-muted-foreground">{step.description}</p>

          {step.status === "idle" || step.status === "running" ? (
            <>
              <div>
                <label className="text-xs text-muted-foreground font-mono mb-1 block">Notes / Observations</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-md p-2 text-sm text-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Observations, captures d'écran, erreurs rencontrées..."
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={onPass} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Réussi
                </Button>
                <Button size="sm" variant="destructive" onClick={onFail} className="gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Échoué
                </Button>
                <Button size="sm" variant="outline" onClick={onSkip} className="gap-1">
                  <SkipForward className="w-3.5 h-3.5" /> Ignorer
                </Button>
              </div>
            </>
          ) : (
            step.result && (
              <div className="bg-secondary/50 rounded-md p-3">
                <p className="text-xs font-mono text-muted-foreground">{step.result}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function VabfPage() {
  const { campaigns, activeCampaign, setActiveCampaign, updateStepStatus, startCampaign } = useTestContext();
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const currentCampaign = activeCampaign?.type === "vabf" ? activeCampaign : campaigns.find(c => c.type === "vabf");

  useEffect(() => {
    if (currentCampaign) {
      const updated = campaigns.find(c => c.id === currentCampaign.id);
      if (updated && updated !== activeCampaign) setActiveCampaign(updated);
    }
  }, [campaigns, currentCampaign, activeCampaign, setActiveCampaign]);

  const handleStart = useCallback(() => {
    startCampaign("vabf");
    toast.success("Campagne VABF démarrée");
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

  // GO/NO-GO criteria
  const goNoGo = currentCampaign && currentCampaign.status !== "running" ? {
    isGo: failedCount === 0,
    majorFails: currentCampaign.steps.filter(s => s.status === "failed" && ["vabf-07", "vabf-08", "vabf-10", "vabf-11", "vabf-12"].includes(s.id)),
    minorFails: currentCampaign.steps.filter(s => s.status === "failed" && !["vabf-07", "vabf-08", "vabf-10", "vabf-11", "vabf-12"].includes(s.id)),
  } : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">VABF / VSR — Acceptance</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Validation d'Aptitude au Bon Fonctionnement — 13 étapes de test
          </p>
        </div>
        {!currentCampaign || currentCampaign.status !== "running" ? (
          <Button onClick={handleStart} className="gap-2">
            <Play className="w-4 h-4" />
            {currentCampaign ? "Relancer" : "Démarrer la campagne"}
          </Button>
        ) : (
          <Badge variant="outline" className="gap-1 text-primary border-primary/50">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            En cours
          </Badge>
        )}
      </div>

      {currentCampaign ? (
        <>
          {/* Progress bar */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3 h-3" /> {passedCount} réussis</span>
                  <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" /> {failedCount} échoués</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3" /> {totalSteps - passedCount - failedCount - (currentCampaign.steps.filter(s => s.status === "skipped").length)} restants</span>
                </div>
                <span className="font-mono text-sm text-foreground">{currentCampaign.progress}%</span>
              </div>
              <Progress value={currentCampaign.progress} className="h-3" />
            </CardContent>
          </Card>

          {/* Steps */}
          <div className="space-y-2">
            {currentCampaign.steps.map((step, idx) => {
              const prevDone = idx === 0 || currentCampaign.steps[idx - 1].status !== "idle";
              const isActive = step.status === "idle" && prevDone;
              return (
                <StepCard
                  key={step.id}
                  step={step}
                  index={idx}
                  isActive={isActive}
                  expanded={expandedStep === step.id || isActive}
                  onExpand={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  onPass={() => handleStepAction(step.id, "passed")}
                  onFail={() => handleStepAction(step.id, "failed")}
                  onSkip={() => handleStepAction(step.id, "skipped")}
                />
              );
            })}
          </div>

          {/* GO/NO-GO */}
          {goNoGo && (
            <Card className={cn("border", goNoGo.isGo ? "border-emerald-500/50 bg-emerald-500/5" : "border-red-500/50 bg-red-500/5")}>
              <CardHeader>
                <CardTitle className={cn("font-heading text-lg flex items-center gap-2", goNoGo.isGo ? "text-emerald-400" : "text-red-400")}>
                  {goNoGo.isGo ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  Décision : {goNoGo.isGo ? "GO" : "NO-GO"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {goNoGo.majorFails.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-red-400 mb-1">Critères majeurs échoués :</p>
                    {goNoGo.majorFails.map(s => (
                      <p key={s.id} className="text-sm text-red-300">• {s.title}</p>
                    ))}
                  </div>
                )}
                {goNoGo.minorFails.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-orange-400 mb-1">Critères mineurs échoués :</p>
                    {goNoGo.minorFails.map(s => (
                      <p key={s.id} className="text-sm text-orange-300">• {s.title}</p>
                    ))}
                  </div>
                )}
                {goNoGo.isGo && <p className="text-sm text-emerald-300">Tous les critères sont validés. La plateforme est apte au bon fonctionnement.</p>}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Empty state */
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-heading text-lg text-foreground mb-2">Aucune campagne VABF en cours</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Lancez une campagne de validation d'aptitude au bon fonctionnement pour vérifier les 13 critères d'acceptance.
            </p>
            <Button onClick={handleStart} className="gap-2">
              <Play className="w-4 h-4" /> Démarrer la campagne VABF
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
