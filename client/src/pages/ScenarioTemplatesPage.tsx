import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "../state/projectStore";
import { useAuth } from "../auth/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BookTemplate, Search, Download, ChevronRight, ChevronDown,
  Filter, Zap, Shield, Radio, Globe, Gauge, Wifi, Car,
  Loader2, AlertTriangle, Star, MessageSquare, Users2,
  Send, Trash2, Upload,
} from "lucide-react";

// ─── Domain config ──────────────────────────────────────────────────────────
const domainConfig: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  IMS: { label: "IMS", icon: Radio, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  "5GC": { label: "5G Core", icon: Wifi, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  API_REST: { label: "API REST", icon: Globe, color: "bg-green-500/10 text-green-400 border-green-500/20" },
  VOLTE: { label: "VoLTE", icon: Zap, color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  DRIVE_TEST: { label: "Drive Test", icon: Car, color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  SECURITY: { label: "Sécurité", icon: Shield, color: "bg-red-500/10 text-red-400 border-red-500/20" },
  PERFORMANCE: { label: "Performance", icon: Gauge, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

const difficultyConfig: Record<string, { label: string; color: string }> = {
  BEGINNER: { label: "Débutant", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  INTERMEDIATE: { label: "Intermédiaire", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  ADVANCED: { label: "Avancé", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const testTypeLabels: Record<string, string> = { VABF: "VABF", VSR: "VSR", VABE: "VABE" };

// ─── Star Rating Component ──────────────────────────────────────────────────
function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`p-0 ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => onChange?.(star)}
        >
          <Star
            className={`w-4 h-4 ${
              star <= (hover || value)
                ? "text-amber-400 fill-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ScenarioTemplatesPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Tab: all vs community
  const [tab, setTab] = useState<"all" | "community">("all");

  // Filters
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [importingId, setImportingId] = useState<number | null>(null);

  // Comment input per template
  const [commentText, setCommentText] = useState<Record<string, string>>({});

  // Fetch templates
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.scenarioTemplates.list.useQuery({
    domain: domainFilter as any,
    difficulty: difficultyFilter as any,
    search: search || undefined,
    communityOnly: tab === "community" ? true : undefined,
  });

  // Fetch detail for expanded template (includes comments + ratings)
  const { data: expandedDetail } = trpc.scenarioTemplates.get.useQuery(
    { templateId: expandedId! },
    { enabled: expandedId !== null },
  );

  const importMutation = trpc.scenarioTemplates.importToProject.useMutation();
  const rateMutation = trpc.scenarioTemplates.rate.useMutation();
  const addCommentMutation = trpc.scenarioTemplates.addComment.useMutation();
  const deleteCommentMutation = trpc.scenarioTemplates.deleteComment.useMutation();

  // Group templates by domain
  const grouped = useMemo(() => {
    if (!templates) return {};
    const groups: Record<string, typeof templates> = {};
    for (const tpl of templates) {
      const d = tpl.domain;
      if (!groups[d]) groups[d] = [];
      groups[d].push(tpl);
    }
    return groups;
  }, [templates]);

  const handleImport = async (templateId: number, createProfile: boolean) => {
    if (!currentProject) {
      toast.error("Sélectionnez un projet avant d'importer un template.");
      return;
    }
    setImportingId(templateId);
    try {
      const result = await importMutation.mutateAsync({
        templateId,
        projectId: currentProject.id,
        createProfile,
      });
      toast.success(`Scénario "${result.scenarioName}" créé${result.profileUid ? " avec profil associé" : ""}. Redirection...`);
      setTimeout(() => navigate("/scenarios"), 1000);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'import");
    } finally {
      setImportingId(null);
    }
  };

  const handleRate = async (templateUid: string, rating: number) => {
    try {
      await rateMutation.mutateAsync({ templateUid, rating });
      utils.scenarioTemplates.list.invalidate();
      if (expandedId) utils.scenarioTemplates.get.invalidate({ templateId: expandedId });
      toast.success("Note enregistrée !");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  const handleAddComment = async (templateUid: string) => {
    const content = commentText[templateUid]?.trim();
    if (!content) return;
    try {
      await addCommentMutation.mutateAsync({ templateUid, content });
      setCommentText((prev) => ({ ...prev, [templateUid]: "" }));
      if (expandedId) utils.scenarioTemplates.get.invalidate({ templateId: expandedId });
      toast.success("Commentaire ajouté");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  const handleDeleteComment = async (commentUid: string) => {
    try {
      await deleteCommentMutation.mutateAsync({ commentUid });
      if (expandedId) utils.scenarioTemplates.get.invalidate({ templateId: expandedId });
      toast.success("Commentaire supprimé");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <BookTemplate className="w-6 h-6 text-primary" />
            Bibliothèque de templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scénarios pré-configurés et templates communautaires — importez en un clic
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {templates?.length ?? 0} template{(templates?.length ?? 0) > 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Button
          size="sm"
          variant={tab === "all" ? "default" : "ghost"}
          onClick={() => setTab("all")}
          className="h-8 text-xs"
        >
          <BookTemplate className="w-3.5 h-3.5 mr-1" />
          Tous les templates
        </Button>
        <Button
          size="sm"
          variant={tab === "community" ? "default" : "ghost"}
          onClick={() => setTab("community")}
          className="h-8 text-xs"
        >
          <Users2 className="w-3.5 h-3.5 mr-1" />
          Communauté
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">Domaine :</span>
          <Button
            size="sm"
            variant={domainFilter === null ? "default" : "outline"}
            onClick={() => setDomainFilter(null)}
            className="h-7 text-xs"
          >
            Tous
          </Button>
          {Object.entries(domainConfig).map(([key, cfg]) => (
            <Button
              key={key}
              size="sm"
              variant={domainFilter === key ? "default" : "outline"}
              onClick={() => setDomainFilter(domainFilter === key ? null : key)}
              className="h-7 text-xs"
            >
              <cfg.icon className="w-3 h-3 mr-1" />
              {cfg.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Niveau :</span>
          {Object.entries(difficultyConfig).map(([key, cfg]) => (
            <Button
              key={key}
              size="sm"
              variant={difficultyFilter === key ? "default" : "outline"}
              onClick={() => setDifficultyFilter(difficultyFilter === key ? null : key)}
              className="h-7 text-xs"
            >
              {cfg.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement des templates...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && templates?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BookTemplate className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            {tab === "community"
              ? "Aucun template communautaire pour le moment. Publiez le vôtre !"
              : "Aucun template trouvé pour ces filtres."}
          </p>
        </div>
      )}

      {/* Template list grouped by domain */}
      {!isLoading && Object.entries(grouped).map(([domain, tpls]) => {
        const cfg = domainConfig[domain] || { label: domain, icon: Zap, color: "bg-muted text-muted-foreground" };
        const DomainIcon = cfg.icon;

        return (
          <div key={domain} className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DomainIcon className="w-4 h-4" />
              {cfg.label}
              <Badge variant="outline" className="text-xs ml-1">{tpls.length}</Badge>
            </h2>

            <div className="space-y-1.5">
              {tpls.map((tpl) => {
                const isExpanded = expandedId === tpl.id;
                const isImporting = importingId === tpl.id;
                const diffCfg = difficultyConfig[tpl.difficulty] || { label: tpl.difficulty, color: "" };
                const avgRating = (tpl as any).avgRating ?? 0;
                const ratingCount = (tpl as any).ratingCount ?? 0;
                const usageCount = (tpl as any).usageCount ?? 0;
                const isCommunity = !tpl.isBuiltIn;
                const publishedBy = (tpl as any).publishedByName;

                return (
                  <div key={tpl.id} className="bg-card border border-border rounded-lg overflow-hidden">
                    {/* Summary row */}
                    <button
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{tpl.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${diffCfg.color}`}>
                            {diffCfg.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {testTypeLabels[tpl.testType] || tpl.testType}
                          </Badge>
                          {isCommunity && (
                            <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                              <Users2 className="w-2.5 h-2.5 mr-0.5" />
                              Communauté
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-xs text-muted-foreground line-clamp-1 flex-1">{tpl.description}</p>
                          {publishedBy && (
                            <span className="text-[10px] text-muted-foreground shrink-0">par {publishedBy}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Rating */}
                        <div className="flex items-center gap-1">
                          <StarRating value={Math.round(avgRating)} readonly />
                          <span className="text-[10px] text-muted-foreground">({ratingCount})</span>
                        </div>
                        {/* Usage count */}
                        <span className="text-[10px] text-muted-foreground">
                          <Download className="w-3 h-3 inline mr-0.5" />
                          {usageCount}
                        </span>
                        {/* Steps count */}
                        <span className="text-xs text-muted-foreground">
                          {(tpl.steps as any[])?.length ?? 0} étapes
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={isImporting || !currentProject}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImport(tpl.id, true);
                          }}
                        >
                          {isImporting ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Download className="w-3 h-3 mr-1" />
                          )}
                          Importer
                        </Button>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3 bg-muted/10 space-y-4">
                        {/* Description */}
                        <p className="text-sm text-muted-foreground">{tpl.description}</p>

                        {/* Tags */}
                        {(() => {
                          const tags = tpl.tags as string[] | null;
                          if (!tags || tags.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1.5">
                              {tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Steps */}
                        {(() => {
                          const steps = tpl.steps as Array<{ order?: number; action?: string; method?: string; description?: string }> | null;
                          if (!steps || steps.length === 0) return null;
                          return (
                            <div>
                              <h4 className="text-xs font-semibold text-foreground mb-2">Étapes du scénario</h4>
                              <div className="space-y-1">
                                {steps.map((step, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                      {String(step.order ?? i + 1)}
                                    </span>
                                    <div className="flex-1">
                                      <span className="font-mono text-[10px] text-muted-foreground mr-1.5">
                                        {step.action ?? ""}
                                        {step.method ? ` ${step.method}` : ""}
                                      </span>
                                      <span className="text-muted-foreground">{step.description ?? ""}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Required datasets */}
                        {(() => {
                          const rdt = tpl.requiredDatasetTypes as string[] | null;
                          if (!rdt || rdt.length === 0) return null;
                          return (
                            <div>
                              <h4 className="text-xs font-semibold text-foreground mb-1">Datasets requis</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {rdt.map((dt) => (
                                  <Badge key={dt} variant="outline" className="text-[10px] font-mono">{dt}</Badge>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* KPI thresholds */}
                        {(() => {
                          const kpi = tpl.kpiThresholds as Record<string, number> | null;
                          if (!kpi || Object.keys(kpi).length === 0) return null;
                          return (
                            <div>
                              <h4 className="text-xs font-semibold text-foreground mb-1">Seuils KPI</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {Object.entries(kpi).map(([key, val]) => (
                                  <div key={key} className="bg-card border border-border rounded px-2 py-1.5">
                                    <span className="text-[10px] text-muted-foreground font-mono block">{key}</span>
                                    <span className="text-sm font-semibold text-foreground">{String(val)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* ─── Rating Section ─────────────────────────────── */}
                        <div className="border-t border-border pt-3">
                          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                            Évaluation
                            <span className="text-muted-foreground font-normal ml-1">
                              ({avgRating.toFixed(1)}/5 — {ratingCount} vote{ratingCount > 1 ? "s" : ""})
                            </span>
                          </h4>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">Votre note :</span>
                            <StarRating
                              value={
                                expandedDetail?.ratings?.find((r: any) => r.userOpenId === user?.id)?.rating ?? 0
                              }
                              onChange={(v) => handleRate(tpl.uid, v)}
                            />
                          </div>
                        </div>

                        {/* ─── Comments Section ──────────────────────────── */}
                        <div className="border-t border-border pt-3">
                          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5" />
                            Commentaires
                            <span className="text-muted-foreground font-normal">
                              ({expandedDetail?.comments?.length ?? 0})
                            </span>
                          </h4>

                          {/* Comment list */}
                          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                            {expandedDetail?.comments?.map((c: any) => (
                              <div key={c.uid} className="bg-card border border-border rounded p-2.5">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-foreground">
                                    {c.userName || "Anonyme"}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                                    </span>
                                    {c.userOpenId === user?.id && (
                                      <button
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                        onClick={() => handleDeleteComment(c.uid)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground">{c.content}</p>
                              </div>
                            ))}
                            {expandedDetail?.comments?.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">Aucun commentaire pour le moment.</p>
                            )}
                          </div>

                          {/* Add comment */}
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Ajouter un commentaire..."
                              value={commentText[tpl.uid] ?? ""}
                              onChange={(e) => setCommentText((prev) => ({ ...prev, [tpl.uid]: e.target.value }))}
                              className="text-xs min-h-[60px] flex-1"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 self-end"
                              disabled={!commentText[tpl.uid]?.trim() || addCommentMutation.isPending}
                              onClick={() => handleAddComment(tpl.uid)}
                            >
                              {addCommentMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Import actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border">
                          <Button
                            size="sm"
                            disabled={isImporting || !currentProject}
                            onClick={() => handleImport(tpl.id, true)}
                          >
                            {isImporting ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Download className="w-3 h-3 mr-1" />
                            )}
                            Importer avec profil
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isImporting || !currentProject}
                            onClick={() => handleImport(tpl.id, false)}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Scénario seul
                          </Button>
                          {!currentProject && (
                            <span className="text-xs text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Sélectionnez un projet d'abord
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
