import { useState, useEffect } from "react";
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
  Star,
  StarOff,
  RotateCw,
  Zap,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Server,
} from "lucide-react";
import { toast } from "sonner";

type Provider = "OPENAI" | "GEMINI" | "ANTHROPIC" | "CUSTOM_HTTP";

const PROVIDER_LABELS: Record<Provider, string> = {
  OPENAI: "OpenAI",
  GEMINI: "Google Gemini",
  ANTHROPIC: "Anthropic",
  CUSTOM_HTTP: "Custom HTTP",
};

const PROVIDER_MODELS: Record<Provider, string[]> = {
  OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o3-mini"],
  GEMINI: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  ANTHROPIC: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
  CUSTOM_HTTP: [],
};

interface Props {
  orgId: string;
  isLocked: boolean;
}

interface EngineForm {
  name: string;
  provider: Provider;
  model: string;
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  temperature: string;
  maxOutputTokens: string;
  apiKey: string;
}

const defaultForm: EngineForm = {
  name: "",
  provider: "OPENAI",
  model: "gpt-4o",
  enabled: true,
  baseUrl: "",
  timeoutMs: 30000,
  maxRetries: 2,
  temperature: "",
  maxOutputTokens: "",
  apiKey: "",
};

export default function AiEnginesTab({ orgId, isLocked }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUid, setEditUid] = useState<string | null>(null);
  const [form, setForm] = useState<EngineForm>({ ...defaultForm });
  const [showKey, setShowKey] = useState(false);
  const [rotateUid, setRotateUid] = useState<string | null>(null);
  const [rotateKey, setRotateKey] = useState("");
  const [showRotateKey, setShowRotateKey] = useState(false);

  const listQuery = trpc.aiEngines.list.useQuery({ orgId }, { staleTime: 10_000 });
  const engines = listQuery.data?.engines ?? [];

  const createMut = trpc.aiEngines.create.useMutation({
    onSuccess: () => {
      toast.success("Moteur créé");
      listQuery.refetch();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.aiEngines.update.useMutation({
    onSuccess: () => {
      toast.success("Moteur mis à jour");
      listQuery.refetch();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const setPrimaryMut = trpc.aiEngines.setPrimary.useMutation({
    onSuccess: () => {
      toast.success("Moteur défini comme principal");
      listQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const disableMut = trpc.aiEngines.disable.useMutation({
    onSuccess: () => {
      toast.success("Moteur désactivé");
      listQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rotateKeyMut = trpc.aiEngines.rotateKey.useMutation({
    onSuccess: () => {
      toast.success("Clé API rotée");
      listQuery.refetch();
      setRotateUid(null);
      setRotateKey("");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMut = trpc.aiEngines.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`Connexion OK (${result.latencyMs}ms) — ${result.info?.provider} / ${result.info?.model}`);
      } else {
        toast.error(`Échec: ${result.error}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditUid(null);
    setForm({ ...defaultForm });
    setShowKey(false);
  }

  function openCreate() {
    setEditUid(null);
    setForm({ ...defaultForm });
    setDialogOpen(true);
  }

  function openEdit(engine: (typeof engines)[0]) {
    setEditUid(engine.uid);
    setForm({
      name: engine.name,
      provider: engine.provider as Provider,
      model: engine.model,
      enabled: engine.enabled,
      baseUrl: engine.baseUrl || "",
      timeoutMs: engine.timeoutMs,
      maxRetries: engine.maxRetries,
      temperature: engine.temperature != null ? String(engine.temperature) : "",
      maxOutputTokens: engine.maxOutputTokens != null ? String(engine.maxOutputTokens) : "",
      apiKey: "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    if (editUid) {
      updateMut.mutate({
        engineUid: editUid,
        name: form.name,
        provider: form.provider,
        model: form.model,
        enabled: form.enabled,
        baseUrl: form.baseUrl || null,
        timeoutMs: form.timeoutMs,
        maxRetries: form.maxRetries,
        temperature: form.temperature ? Number(form.temperature) : null,
        maxOutputTokens: form.maxOutputTokens ? Number(form.maxOutputTokens) : null,
        ...(form.apiKey ? { apiKey: form.apiKey } : {}),
      });
    } else {
      createMut.mutate({
        orgId,
        name: form.name,
        provider: form.provider,
        model: form.model,
        enabled: form.enabled,
        baseUrl: form.baseUrl || null,
        timeoutMs: form.timeoutMs,
        maxRetries: form.maxRetries,
        temperature: form.temperature ? Number(form.temperature) : null,
        maxOutputTokens: form.maxOutputTokens ? Number(form.maxOutputTokens) : null,
        ...(form.apiKey ? { apiKey: form.apiKey } : {}),
      });
    }
  }

  const modelOptions = PROVIDER_MODELS[form.provider] || [];
  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Moteurs IA</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {engines.length} moteur{engines.length !== 1 ? "s" : ""} configuré{engines.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!isLocked && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Engines List */}
      {engines.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Server className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun moteur configuré</p>
          <p className="text-xs mt-1">Les requêtes IA utiliseront la configuration par défaut (ENV).</p>
        </div>
      ) : (
        <div className="space-y-2">
          {engines.map((engine) => (
            <div
              key={engine.uid}
              className={`bg-card border rounded-lg p-4 ${
                engine.isPrimary ? "border-primary/40" : "border-border"
              } ${!engine.enabled ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Primary star */}
                  <button
                    onClick={() => !isLocked && engine.enabled && setPrimaryMut.mutate({ engineUid: engine.uid })}
                    disabled={isLocked || !engine.enabled || engine.isPrimary}
                    className="mt-0.5 shrink-0"
                    title={engine.isPrimary ? "Moteur principal" : "Définir comme principal"}
                  >
                    {engine.isPrimary ? (
                      <Star className="w-4 h-4 text-primary fill-primary" />
                    ) : (
                      <StarOff className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{engine.name}</span>
                      {engine.isPrimary && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          PRINCIPAL
                        </span>
                      )}
                      {!engine.enabled && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          DÉSACTIVÉ
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {PROVIDER_LABELS[engine.provider as Provider] || engine.provider} · {engine.model}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      {engine.hasSecret ? "🔑 Clé configurée" : "⚠️ Pas de clé"} · {engine.timeoutMs}ms · {engine.maxRetries} retries
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {!isLocked && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => testMut.mutate({ engineUid: engine.uid })}
                      disabled={testMut.isPending}
                      title="Tester la connexion"
                    >
                      {testMut.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setRotateUid(engine.uid);
                        setRotateKey("");
                        setShowRotateKey(false);
                      }}
                      title="Rotation de clé"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(engine)}
                      title="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {engine.enabled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => disableMut.mutate({ engineUid: engine.uid })}
                        disabled={disableMut.isPending}
                        title="Désactiver"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rotate Key Dialog */}
      <Dialog open={!!rotateUid} onOpenChange={(open) => !open && setRotateUid(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rotation de clé API</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Nouvelle clé API</Label>
            <div className="relative">
              <Input
                type={showRotateKey ? "text" : "password"}
                value={rotateKey}
                onChange={(e) => setRotateKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowRotateKey(!showRotateKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showRotateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateUid(null)}>Annuler</Button>
            <Button
              onClick={() => rotateUid && rotateKey && rotateKeyMut.mutate({ engineUid: rotateUid, apiKey: rotateKey })}
              disabled={!rotateKey || rotateKeyMut.isPending}
            >
              {rotateKeyMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Rotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editUid ? "Modifier le moteur" : "Nouveau moteur IA"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="GPT-4o Production"
              />
            </div>

            {/* Provider */}
            <div className="space-y-1.5">
              <Label>Fournisseur</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => {
                  const p = v as Provider;
                  const models = PROVIDER_MODELS[p];
                  setForm({
                    ...form,
                    provider: p,
                    model: models.length > 0 ? models[0] : form.model,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
                    <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <Label>Modèle</Label>
              {modelOptions.length > 0 ? (
                <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="model-name"
                />
              )}
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between">
              <Label>Activé</Label>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>

            {/* Base URL */}
            <div className="space-y-1.5">
              <Label>Base URL <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
              <Input
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.openai.com"
              />
            </div>

            {/* Advanced */}
            <details className="border border-border rounded-lg">
              <summary className="px-4 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                Paramètres avancés
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Timeout (ms)</Label>
                    <Input
                      type="number"
                      value={form.timeoutMs}
                      onChange={(e) => setForm({ ...form, timeoutMs: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max retries</Label>
                    <Input
                      type="number"
                      value={form.maxRetries}
                      onChange={(e) => setForm({ ...form, maxRetries: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Température</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.temperature}
                      onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                      placeholder="auto"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max output tokens</Label>
                    <Input
                      type="number"
                      value={form.maxOutputTokens}
                      onChange={(e) => setForm({ ...form, maxOutputTokens: e.target.value })}
                      placeholder="auto"
                    />
                  </div>
                </div>
              </div>
            </details>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label>Clé API {editUid ? "(laisser vide pour conserver)" : ""}</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder={editUid ? "••••••••" : "sk-..."}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Chiffrée AES-256-GCM avant stockage. Jamais réaffichée.
              </p>
            </div>
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
