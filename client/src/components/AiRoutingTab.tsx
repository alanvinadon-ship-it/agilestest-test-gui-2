import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Loader2,
  Route,
  FlaskConical,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const USE_CASES = ["DRIVE_DIAG", "ANALYTICS", "SUMMARIZE", "INGEST_LONG", "GENERAL"] as const;
type UseCase = (typeof USE_CASES)[number];

const USE_CASE_LABELS: Record<UseCase, string> = {
  DRIVE_DIAG: "Drive Test Diagnostic",
  ANALYTICS: "Analytique",
  SUMMARIZE: "Résumé",
  INGEST_LONG: "Ingestion Long-Context",
  GENERAL: "Général (fallback)",
};

interface Props {
  orgId: string;
  isLocked: boolean;
}

interface RuleForm {
  name: string;
  useCase: UseCase;
  priority: number;
  enabled: boolean;
  targetEngineUid: string;
  minTokens: string;
  maxTokens: string;
  hasLargeArtifacts: boolean;
  preferLongContext: boolean;
}

const defaultForm: RuleForm = {
  name: "",
  useCase: "GENERAL",
  priority: 100,
  enabled: true,
  targetEngineUid: "",
  minTokens: "",
  maxTokens: "",
  hasLargeArtifacts: false,
  preferLongContext: false,
};

export default function AiRoutingTab({ orgId, isLocked }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUid, setEditUid] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>({ ...defaultForm });
  const [filterUseCase, setFilterUseCase] = useState<UseCase | "ALL">("ALL");
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [dryRunUseCase, setDryRunUseCase] = useState<UseCase>("DRIVE_DIAG");
  const [dryRunTokens, setDryRunTokens] = useState("");

  const listQuery = trpc.aiRouting.list.useQuery(
    { orgId, ...(filterUseCase !== "ALL" ? { useCase: filterUseCase } : {}) },
    { staleTime: 10_000 }
  );
  const rules = listQuery.data?.rules ?? [];

  const enginesQuery = trpc.aiEngines.list.useQuery({ orgId }, { staleTime: 30_000 });
  const engines = enginesQuery.data?.engines ?? [];

  const createMut = trpc.aiRouting.create.useMutation({
    onSuccess: () => {
      toast.success("Règle créée");
      listQuery.refetch();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.aiRouting.update.useMutation({
    onSuccess: () => {
      toast.success("Règle mise à jour");
      listQuery.refetch();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.aiRouting.delete.useMutation({
    onSuccess: () => {
      toast.success("Règle supprimée");
      listQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const reorderMut = trpc.aiRouting.reorder.useMutation({
    onSuccess: () => {
      toast.success("Ordre mis à jour");
      listQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const dryRunQuery = trpc.aiRouting.dryRun.useQuery(
    {
      orgId,
      useCase: dryRunUseCase,
      context: {
        tokenEstimate: dryRunTokens ? Number(dryRunTokens) : undefined,
      },
    },
    { enabled: dryRunOpen, staleTime: 0 }
  );

  function closeDialog() {
    setDialogOpen(false);
    setEditUid(null);
    setForm({ ...defaultForm });
  }

  function openCreate() {
    setEditUid(null);
    setForm({ ...defaultForm });
    setDialogOpen(true);
  }

  function openEdit(rule: (typeof rules)[0]) {
    const cond = rule.conditionsJson as Record<string, unknown> | null;
    setEditUid(rule.uid);
    setForm({
      name: rule.name,
      useCase: rule.useCase as UseCase,
      priority: rule.priority,
      enabled: rule.enabled,
      targetEngineUid: rule.targetEngineUid,
      minTokens: cond?.minTokens != null ? String(cond.minTokens) : "",
      maxTokens: cond?.maxTokens != null ? String(cond.maxTokens) : "",
      hasLargeArtifacts: !!cond?.hasLargeArtifacts,
      preferLongContext: !!cond?.preferLongContext,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    if (!form.targetEngineUid) {
      toast.error("Sélectionnez un moteur cible");
      return;
    }

    const conditionsJson: Record<string, unknown> = {};
    if (form.minTokens) conditionsJson.minTokens = Number(form.minTokens);
    if (form.maxTokens) conditionsJson.maxTokens = Number(form.maxTokens);
    if (form.hasLargeArtifacts) conditionsJson.hasLargeArtifacts = true;
    if (form.preferLongContext) conditionsJson.preferLongContext = true;

    if (editUid) {
      updateMut.mutate({
        uid: editUid,
        name: form.name,
        useCase: form.useCase,
        priority: form.priority,
        enabled: form.enabled,
        targetEngineUid: form.targetEngineUid,
        conditionsJson: Object.keys(conditionsJson).length > 0 ? conditionsJson : null,
      });
    } else {
      createMut.mutate({
        orgId,
        name: form.name,
        useCase: form.useCase,
        priority: form.priority,
        enabled: form.enabled,
        targetEngineUid: form.targetEngineUid,
        conditionsJson: Object.keys(conditionsJson).length > 0 ? conditionsJson : null,
      });
    }
  }

  function moveRule(index: number, direction: "up" | "down") {
    const filtered = rules.filter(
      (r) => filterUseCase === "ALL" || r.useCase === filterUseCase
    );
    const newOrder = [...filtered];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[index], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[index]];

    // Group by useCase and reorder each group
    const byUseCase = new Map<string, string[]>();
    for (const r of newOrder) {
      if (!byUseCase.has(r.useCase)) byUseCase.set(r.useCase, []);
      byUseCase.get(r.useCase)!.push(r.uid);
    }

    for (const [uc, uids] of byUseCase) {
      reorderMut.mutate({
        orgId,
        useCase: uc as UseCase,
        orderedUids: uids,
      });
    }
  }

  const engineMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of engines) m.set(e.uid, e.name);
    return m;
  }, [engines]);

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Règles de routage</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Déterminent quel moteur utiliser selon le cas d'usage et le contexte.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isLocked && (
            <Button size="sm" variant="outline" onClick={() => setDryRunOpen(true)}>
              <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
              Dry Run
            </Button>
          )}
          {!isLocked && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Filtrer :</Label>
        <Select value={filterUseCase} onValueChange={(v) => setFilterUseCase(v as UseCase | "ALL")}>
          <SelectTrigger className="w-52 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les cas d'usage</SelectItem>
            {USE_CASES.map((uc) => (
              <SelectItem key={uc} value={uc}>{USE_CASE_LABELS[uc]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Route className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune règle de routage</p>
          <p className="text-xs mt-1">Le moteur principal sera utilisé pour toutes les requêtes.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rules.map((rule, idx) => (
            <div
              key={rule.uid}
              className={`bg-card border border-border rounded-lg px-4 py-3 ${
                !rule.enabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Drag handle / reorder */}
                {!isLocked && (
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveRule(idx, "up")}
                      disabled={idx === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveRule(idx, "down")}
                      disabled={idx === rules.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Priority badge */}
                <span className="text-[10px] font-mono text-muted-foreground w-8 text-center shrink-0">
                  #{rule.priority}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{rule.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                      {USE_CASE_LABELS[rule.useCase as UseCase] || rule.useCase}
                    </span>
                    {!rule.enabled && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        OFF
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    → {engineMap.get(rule.targetEngineUid) || rule.targetEngineUid.slice(0, 8)}
                    {rule.conditionsJson && Object.keys(rule.conditionsJson as object).length > 0 && (
                      <span className="ml-2 text-[10px]">
                        ({Object.keys(rule.conditionsJson as object).join(", ")})
                      </span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                {!isLocked && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(rule)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMut.mutate({ uid: rule.uid })}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dry Run Dialog */}
      <Dialog open={dryRunOpen} onOpenChange={setDryRunOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dry Run — Simulation de routage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Cas d'usage</Label>
              <Select value={dryRunUseCase} onValueChange={(v) => setDryRunUseCase(v as UseCase)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USE_CASES.map((uc) => (
                    <SelectItem key={uc} value={uc}>{USE_CASE_LABELS[uc]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estimation tokens <span className="text-xs text-muted-foreground">(optionnel)</span></Label>
              <Input
                type="number"
                value={dryRunTokens}
                onChange={(e) => setDryRunTokens(e.target.value)}
                placeholder="4000"
              />
            </div>

            {/* Result */}
            {dryRunQuery.data && (
              <div className={`rounded-lg p-4 border ${
                dryRunQuery.data.selectedEngine
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-amber-500/10 border-amber-500/30"
              }`}>
                {dryRunQuery.data.matched ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Règle matchée : {dryRunQuery.data.matchedRule?.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Moteur : {dryRunQuery.data.selectedEngine?.name} ({dryRunQuery.data.selectedEngine?.provider} / {dryRunQuery.data.selectedEngine?.model})
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Aucune règle matchée
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fallback : {dryRunQuery.data.fallback === "primary"
                          ? `Moteur principal (${dryRunQuery.data.selectedEngine?.name})`
                          : "Configuration ENV par défaut"
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {dryRunQuery.isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDryRunOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editUid ? "Modifier la règle" : "Nouvelle règle de routage"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Drive Diag → GPT-4o"
              />
            </div>

            {/* Use Case */}
            <div className="space-y-1.5">
              <Label>Cas d'usage</Label>
              <Select value={form.useCase} onValueChange={(v) => setForm({ ...form, useCase: v as UseCase })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USE_CASES.map((uc) => (
                    <SelectItem key={uc} value={uc}>{USE_CASE_LABELS[uc]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Engine */}
            <div className="space-y-1.5">
              <Label>Moteur cible</Label>
              {engines.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun moteur configuré. Créez-en un d'abord dans l'onglet Moteurs.</p>
              ) : (
                <Select value={form.targetEngineUid} onValueChange={(v) => setForm({ ...form, targetEngineUid: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un moteur" />
                  </SelectTrigger>
                  <SelectContent>
                    {engines.map((e) => (
                      <SelectItem key={e.uid} value={e.uid}>
                        {e.name} ({e.provider} / {e.model})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label>Priorité <span className="text-xs text-muted-foreground">(plus bas = plus prioritaire)</span></Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              />
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between">
              <Label>Activée</Label>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>

            {/* Conditions */}
            <details className="border border-border rounded-lg" open>
              <summary className="px-4 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                Conditions (optionnel)
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Min tokens</Label>
                    <Input
                      type="number"
                      value={form.minTokens}
                      onChange={(e) => setForm({ ...form, minTokens: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max tokens</Label>
                    <Input
                      type="number"
                      value={form.maxTokens}
                      onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
                      placeholder="∞"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Gros artifacts</Label>
                  <Switch
                    checked={form.hasLargeArtifacts}
                    onCheckedChange={(v) => setForm({ ...form, hasLargeArtifacts: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Préférer long-context</Label>
                  <Switch
                    checked={form.preferLongContext}
                    onCheckedChange={(v) => setForm({ ...form, preferLongContext: v })}
                  />
                </div>
              </div>
            </details>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annuler</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editUid ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
