import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Brain, Sparkles, AlertTriangle, CheckCircle2,
  XCircle, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  Zap, Search, ArrowUpRight, Clock, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

// ── Types ──────────────────────────────────────────────────────────────────

interface DriveAiTabProps {
  runUid: string;
  orgId: string;
}

const SEGMENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DROP_CALL: { label: 'Appel coupé', color: 'bg-red-500/20 text-red-300' },
  LOW_THROUGHPUT: { label: 'Débit faible', color: 'bg-orange-500/20 text-orange-300' },
  HO_FAIL: { label: 'Échec handover', color: 'bg-red-500/20 text-red-300' },
  HIGH_LATENCY: { label: 'Latence élevée', color: 'bg-amber-500/20 text-amber-300' },
  COVERAGE_HOLE: { label: 'Trou de couverture', color: 'bg-red-500/20 text-red-300' },
  INTERFERENCE: { label: 'Interférence', color: 'bg-purple-500/20 text-purple-300' },
  BACKHAUL: { label: 'Backhaul', color: 'bg-blue-500/20 text-blue-300' },
  DNS: { label: 'DNS', color: 'bg-cyan-500/20 text-cyan-300' },
  GPS_GAP: { label: 'Coupure GPS', color: 'bg-gray-500/20 text-gray-300' },
  OTHER: { label: 'Autre', color: 'bg-gray-500/20 text-gray-300' },
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-300',
  HIGH: 'bg-orange-500/20 text-orange-300',
  MEDIUM: 'bg-amber-500/20 text-amber-300',
  LOW: 'bg-gray-500/20 text-gray-300',
};

// ── Main Component ─────────────────────────────────────────────────────────

export function DriveAiTab({ runUid, orgId }: DriveAiTabProps) {
  const [mode, setMode] = useState<'FAST' | 'DEEP'>('FAST');
  const utils = trpc.useUtils();

  // Fetch latest analysis
  const { data: analysis, isLoading: isLoadingAnalysis } = trpc.driveAi.latest.useQuery(
    { runUid, orgId },
    { enabled: !!runUid, refetchInterval: (query) => {
      const status = query.state.data?.status;
      return (status === 'QUEUED' || status === 'RUNNING') ? 3000 : false;
    }},
  );

  // Fetch segments when analysis is completed
  const { data: segments } = trpc.driveAi.segments.useQuery(
    { analysisUid: analysis?.uid ?? '', orgId },
    { enabled: !!analysis?.uid && analysis?.status === 'COMPLETED' },
  );

  // Trigger mutation
  const triggerMutation = trpc.driveAi.trigger.useMutation({
    onSuccess: (res) => {
      if (res.alreadyRunning) {
        toast.info('Une analyse est déjà en cours');
      } else {
        toast.success('Analyse IA lancée');
      }
      utils.driveAi.latest.invalidate({ runUid, orgId });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleTrigger = () => {
    triggerMutation.mutate({ runUid, orgId, mode });
  };

  const isRunning = analysis?.status === 'QUEUED' || analysis?.status === 'RUNNING';

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-medium text-foreground">Diagnostic IA</h3>
              <p className="text-xs text-muted-foreground">
                Analyse automatique du drive test par intelligence artificielle
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode selector */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setMode('FAST')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'FAST'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <Zap className="w-3 h-3 inline mr-1" />
                Rapide
              </button>
              <button
                onClick={() => setMode('DEEP')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'DEEP'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <Search className="w-3 h-3 inline mr-1" />
                Approfondi
              </button>
            </div>
            <Button
              size="sm"
              onClick={handleTrigger}
              disabled={triggerMutation.isPending || isRunning}
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1" />
              )}
              {analysis?.status === 'COMPLETED' ? 'Relancer' : 'Analyser'}
            </Button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoadingAnalysis && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No analysis yet */}
      {!isLoadingAnalysis && !analysis && (
        <div className="bg-card border border-border border-dashed rounded-lg p-8 text-center">
          <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground mb-1">Aucune analyse IA disponible</p>
          <p className="text-xs text-muted-foreground">
            Cliquez sur "Analyser" pour lancer le diagnostic automatique de ce drive test.
          </p>
        </div>
      )}

      {/* Analysis in progress */}
      {isRunning && (
        <div className="bg-card border border-primary/30 rounded-lg p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Analyse en cours...</p>
          <p className="text-xs text-muted-foreground mt-1">
            {analysis?.mode === 'DEEP' ? 'Analyse approfondie' : 'Analyse rapide'} — Veuillez patienter
          </p>
        </div>
      )}

      {/* Failed */}
      {analysis?.status === 'FAILED' && (
        <div className="bg-card border border-red-500/30 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">Analyse échouée</p>
              <p className="text-xs text-muted-foreground mt-1">{analysis.error || 'Erreur inconnue'}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={handleTrigger}>
                Réessayer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Completed analysis */}
      {analysis?.status === 'COMPLETED' && (
        <>
          {/* Quality Score + Meta */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <QualityScoreCircle score={analysis.qualityScore ?? 0} />
                <div>
                  <p className="text-sm font-medium text-foreground">Score de qualité</p>
                  <p className="text-xs text-muted-foreground">
                    Mode: {analysis.mode === 'DEEP' ? 'Approfondi' : 'Rapide'} · 
                    Modèle: {analysis.model ?? 'N/A'} · 
                    {analysis.createdAt && (
                      <span>
                        <Clock className="w-3 h-3 inline mx-0.5" />
                        {new Date(analysis.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {segments && segments.length > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-300 text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {segments.length} segment{segments.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Summary Markdown */}
          {analysis.summaryMd && (
            <div className="bg-card border border-border rounded-lg p-5">
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                Résumé de l'analyse
              </h4>
              <div className="prose prose-invert prose-sm max-w-none text-muted-foreground">
                <Streamdown>{analysis.summaryMd}</Streamdown>
              </div>
            </div>
          )}

          {/* Segments */}
          {segments && segments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Segments problématiques ({segments.length})
              </h4>
              {segments.map((seg) => (
                <SegmentCard key={seg.uid} segment={seg} />
              ))}
            </div>
          )}

          {/* Feedback */}
          <FeedbackSection analysisUid={analysis.uid} orgId={orgId} />
        </>
      )}
    </div>
  );
}

// ── Quality Score Circle ───────────────────────────────────────────────────

function QualityScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const bgColor = score >= 80 ? 'bg-emerald-500/10' : score >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10';
  const ringColor = score >= 80 ? 'stroke-emerald-400' : score >= 50 ? 'stroke-amber-400' : 'stroke-red-400';

  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={`relative w-14 h-14 ${bgColor} rounded-full flex items-center justify-center`}>
      <svg className="absolute inset-0 w-14 h-14 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
        <circle
          cx="22" cy="22" r="20" fill="none" strokeWidth="3"
          className={ringColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className={`text-lg font-bold ${color}`}>{score}</span>
    </div>
  );
}

// ── Segment Card ───────────────────────────────────────────────────────────

function SegmentCard({ segment }: { segment: any }) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = SEGMENT_TYPE_LABELS[segment.segmentType] ?? SEGMENT_TYPE_LABELS.OTHER;
  const actions = (segment.actionsJson ?? []) as { action: string; priority: string }[];
  const evidence = (segment.evidenceJson as any)?.evidence ?? '';

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Badge className={`${typeInfo.color} text-xs`}>{typeInfo.label}</Badge>
          {segment.confidence != null && (
            <span className="text-xs text-muted-foreground">
              Confiance: {Math.round(segment.confidence * 100)}%
            </span>
          )}
          {segment.startTs && (
            <span className="text-xs text-muted-foreground">
              {new Date(segment.startTs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {segment.endTs && ` → ${new Date(segment.endTs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Evidence */}
          {evidence && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Preuves</p>
              <p className="text-sm text-foreground">{evidence}</p>
            </div>
          )}

          {/* Diagnosis */}
          {segment.diagnosisMd && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Diagnostic</p>
              <div className="prose prose-invert prose-sm max-w-none text-muted-foreground">
                <Streamdown>{segment.diagnosisMd}</Streamdown>
              </div>
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Actions recommandées</p>
              <div className="space-y-1.5">
                {actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Badge className={`${PRIORITY_COLORS[a.priority] ?? PRIORITY_COLORS.LOW} text-xs shrink-0`}>
                      {a.priority}
                    </Badge>
                    <span className="text-sm text-foreground">{a.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Geo bbox */}
          {segment.geoBboxJson && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Zone géographique</p>
              <p className="text-xs font-mono text-muted-foreground">
                [{(segment.geoBboxJson as any).minLat?.toFixed(5)}, {(segment.geoBboxJson as any).minLon?.toFixed(5)}] → [{(segment.geoBboxJson as any).maxLat?.toFixed(5)}, {(segment.geoBboxJson as any).maxLon?.toFixed(5)}]
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Feedback Section ───────────────────────────────────────────────────────

function FeedbackSection({ analysisUid, orgId }: { analysisUid: string; orgId: string }) {
  const [score, setScore] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: feedbackList } = trpc.driveAi.getFeedback.useQuery(
    { analysisUid, orgId },
    { enabled: !!analysisUid },
  );

  const submitMutation = trpc.driveAi.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success('Merci pour votre retour');
      setSubmitted(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const hasPreviousFeedback = (feedbackList?.length ?? 0) > 0;

  if (submitted || hasPreviousFeedback) {
    const fb = feedbackList?.[0];
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-foreground">Feedback enregistré</span>
          {fb && (
            <div className="flex items-center gap-0.5 ml-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${s <= (fb.score ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <ThumbsUp className="w-4 h-4 text-primary" />
        Évaluer cette analyse
      </h4>
      <div className="space-y-3">
        {/* Star rating */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setScore(s)}
              className="p-0.5 hover:scale-110 transition-transform"
            >
              <Star
                className={`w-5 h-5 ${s <= score ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground hover:text-amber-300'}`}
              />
            </button>
          ))}
          {score > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              {score}/5
            </span>
          )}
        </div>

        {/* Notes */}
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Commentaire optionnel..."
          className="text-sm h-16 resize-none"
        />

        <Button
          size="sm"
          disabled={score === 0 || submitMutation.isPending}
          onClick={() => submitMutation.mutate({ analysisUid, orgId, score, notes: notes.trim() || undefined })}
        >
          {submitMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
          Envoyer
        </Button>
      </div>
    </div>
  );
}
