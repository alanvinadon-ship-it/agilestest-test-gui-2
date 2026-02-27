import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "../state/projectStore";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BookTemplate, Search, Download, ChevronRight, ChevronDown,
  Filter, Zap, Shield, Radio, Globe, Gauge, Wifi, Car,
  Loader2, CheckCircle2, AlertTriangle,
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

const testTypeLabels: Record<string, string> = {
  VABF: "VABF",
  VSR: "VSR",
  VABE: "VABE",
};

export default function ScenarioTemplatesPage() {
  const { currentProject } = useProject();
  const [, navigate] = useLocation();

  // Filters
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [importingId, setImportingId] = useState<number | null>(null);

  // Fetch templates
  const { data: templates, isLoading } = trpc.scenarioTemplates.list.useQuery(
    {
      domain: domainFilter as any,
      difficulty: difficultyFilter as any,
      search: search || undefined,
    },
  );

  const importMutation = trpc.scenarioTemplates.importToProject.useMutation();

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
            Scénarios de test pré-configurés par domaine — importez en un clic
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {templates?.length ?? 0} template{(templates?.length ?? 0) > 1 ? "s" : ""}
        </Badge>
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
          <p className="text-sm">Aucun template trouvé pour ces filtres.</p>
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
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tpl.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
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
