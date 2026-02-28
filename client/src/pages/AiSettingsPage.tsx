import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "../auth/AuthContext";
import { useProject } from "../state/projectStore";
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
  Brain,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCw,
  Zap,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";

type Provider = "OPENAI" | "AZURE_OPENAI" | "ANTHROPIC" | "CUSTOM_HTTP";

const PROVIDER_LABELS: Record<Provider, string> = {
  OPENAI: "OpenAI",
  AZURE_OPENAI: "Azure OpenAI",
  ANTHROPIC: "Anthropic",
  CUSTOM_HTTP: "Custom HTTP",
};

const PROVIDER_MODELS: Record<Provider, string[]> = {
  OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini"],
  AZURE_OPENAI: ["gpt-4o", "gpt-4", "gpt-35-turbo"],
  ANTHROPIC: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
  CUSTOM_HTTP: [],
};

export default function AiSettingsPage() {
  const { user, isAdmin } = useAuth();
  const { currentProject } = useProject();
  const orgId = currentProject?.id || "global";

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<Provider>("OPENAI");
  const [model, setModel] = useState("gpt-4o");
  const [customModel, setCustomModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [maxRetries, setMaxRetries] = useState(2);
  const [temperature, setTemperature] = useState("");
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [azureApiVersion, setAzureApiVersion] = useState("2024-02-01");
  const [azureDeployment, setAzureDeployment] = useState("");
  const [customHttpUrl, setCustomHttpUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [rotateMode, setRotateMode] = useState(false);

  // Query
  const configQuery = trpc.aiSettings.get.useQuery({ orgId }, { staleTime: 10_000 });
  const config = configQuery.data;

  // Mutations
  const upsertMut = trpc.aiSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("Configuration IA sauvegardée");
      configQuery.refetch();
      setApiKey("");
      setShowKey(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const rotateKeyMut = trpc.aiSettings.rotateKey.useMutation({
    onSuccess: () => {
      toast.success("Clé API rotée avec succès");
      configQuery.refetch();
      setApiKey("");
      setRotateMode(false);
      setShowKey(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const disableMut = trpc.aiSettings.disable.useMutation({
    onSuccess: () => {
      toast.success("IA désactivée");
      configQuery.refetch();
      setEnabled(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const testMut = trpc.aiSettings.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`Connexion réussie (${result.latencyMs}ms) — ${result.providerInfo?.provider} / ${result.providerInfo?.model}`);
      } else {
        toast.error(`Échec connexion: ${result.error}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Sync form from query
  useEffect(() => {
    if (!config) return;
    setEnabled(config.enabled);
    setProvider(config.provider as Provider);
    setModel(config.model);
    setBaseUrl(config.baseUrl || "");
    setTimeoutMs(config.timeoutMs);
    setMaxRetries(config.maxRetries);
    setTemperature(config.temperature != null ? String(config.temperature) : "");
    setAzureEndpoint(config.azureEndpoint || "");
    setAzureApiVersion(config.azureApiVersion || "2024-02-01");
    setAzureDeployment(config.azureDeployment || "");
    setCustomHttpUrl(config.customHttpUrl || "");
  }, [config]);

  const isLocked = config?.locked ?? false;
  const hasSecret = config?.hasSecret ?? false;
  const hasMasterKeyAvail = config?.hasMasterKey ?? false;

  const modelOptions = useMemo(() => PROVIDER_MODELS[provider] || [], [provider]);

  function handleSave() {
    const finalModel = provider === "CUSTOM_HTTP" ? (customModel || model) : model;
    upsertMut.mutate({
      orgId,
      enabled,
      provider,
      model: finalModel,
      baseUrl: baseUrl || null,
      timeoutMs,
      maxRetries,
      temperature: temperature ? Number(temperature) : null,
      azureEndpoint: azureEndpoint || null,
      azureApiVersion: azureApiVersion || null,
      azureDeployment: azureDeployment || null,
      customHttpUrl: customHttpUrl || null,
      ...(apiKey ? { apiKey } : {}),
    });
  }

  function handleRotateKey() {
    if (!apiKey) {
      toast.error("Entrez la nouvelle clé API");
      return;
    }
    rotateKeyMut.mutate({ orgId, apiKey });
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Accès réservé aux administrateurs.</p>
        </div>
      </div>
    );
  }

  if (configQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Configuration IA</h1>
          <p className="text-sm text-muted-foreground">
            Configurer le fournisseur IA, le modèle et la clé API pour les fonctionnalités intelligentes.
          </p>
        </div>
      </div>

      {/* Locked Banner */}
      {isLocked && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <Lock className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Configuration verrouillée (ENV only)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI_CONFIG_LOCKED=true — La configuration est gérée via les variables d'environnement. L'interface est en lecture seule.
            </p>
          </div>
        </div>
      )}

      {/* No Master Key Warning */}
      {!isLocked && !hasMasterKeyAvail && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Clé de chiffrement manquante</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI_CONFIG_MASTER_KEY non configurée. Vous ne pourrez pas enregistrer de clé API. Contactez votre administrateur système.
            </p>
          </div>
        </div>
      )}

      {/* Source indicator */}
      <div className="flex items-center gap-2 text-xs font-mono">
        <Info className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Source active :</span>
        <span className={
          config?.source === "DB" ? "text-green-400" :
          config?.source === "ENV" ? "text-blue-400" :
          "text-red-400"
        }>
          {config?.source || "DISABLED"}
        </span>
        {config?.updatedAt && (
          <span className="text-muted-foreground ml-2">
            · Dernière mise à jour : {new Date(config.updatedAt).toLocaleString("fr-FR")}
          </span>
        )}
      </div>

      {/* ── Main Form ──────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">IA activée</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active les fonctionnalités IA (diagnostics drive, génération de scripts, etc.)
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={isLocked}
          />
        </div>

        <hr className="border-border" />

        {/* Provider */}
        <div className="space-y-2">
          <Label>Fournisseur</Label>
          <Select
            value={provider}
            onValueChange={(v) => {
              setProvider(v as Provider);
              const models = PROVIDER_MODELS[v as Provider];
              if (models.length > 0) setModel(models[0]);
            }}
            disabled={isLocked}
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
        <div className="space-y-2">
          <Label>Modèle</Label>
          {modelOptions.length > 0 ? (
            <Select value={model} onValueChange={setModel} disabled={isLocked}>
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
              value={customModel || model}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="Nom du modèle"
              disabled={isLocked}
            />
          )}
        </div>

        {/* Provider-specific fields */}
        {provider === "OPENAI" && (
          <div className="space-y-2">
            <Label>Base URL <span className="text-muted-foreground">(optionnel)</span></Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com"
              disabled={isLocked}
            />
          </div>
        )}

        {provider === "AZURE_OPENAI" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Azure Endpoint</Label>
              <Input
                value={azureEndpoint}
                onChange={(e) => setAzureEndpoint(e.target.value)}
                placeholder="https://your-resource.openai.azure.com"
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label>API Version</Label>
              <Input
                value={azureApiVersion}
                onChange={(e) => setAzureApiVersion(e.target.value)}
                placeholder="2024-02-01"
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Deployment Name</Label>
              <Input
                value={azureDeployment}
                onChange={(e) => setAzureDeployment(e.target.value)}
                placeholder="gpt-4o"
                disabled={isLocked}
              />
            </div>
          </div>
        )}

        {provider === "ANTHROPIC" && (
          <div className="space-y-2">
            <Label>Base URL <span className="text-muted-foreground">(optionnel)</span></Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.anthropic.com"
              disabled={isLocked}
            />
          </div>
        )}

        {provider === "CUSTOM_HTTP" && (
          <div className="space-y-2">
            <Label>URL du endpoint</Label>
            <Input
              value={customHttpUrl}
              onChange={(e) => setCustomHttpUrl(e.target.value)}
              placeholder="https://your-server.com/v1/chat/completions"
              disabled={isLocked}
            />
          </div>
        )}

        <hr className="border-border" />

        {/* Advanced Settings */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Paramètres avancés
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input
                type="number"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
                min={1000}
                max={120000}
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Retries</Label>
              <Input
                type="number"
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
                min={0}
                max={10}
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label>Température</Label>
              <Input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                step={0.1}
                min={0}
                max={2}
                placeholder="Auto"
                disabled={isLocked}
              />
            </div>
          </div>
        </details>

        <hr className="border-border" />

        {/* API Key Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Clé API</Label>
            {hasSecret && !rotateMode && (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Clé configurée
              </span>
            )}
          </div>

          {!isLocked && (
            <>
              {hasSecret && !rotateMode ? (
                <div className="flex items-center gap-3">
                  <Input
                    value="••••••••••••••••••••••••"
                    disabled
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRotateMode(true)}
                    className="shrink-0"
                  >
                    <RotateCw className="w-3.5 h-3.5 mr-1.5" />
                    Rotation
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={rotateMode ? "Nouvelle clé API..." : "sk-..."}
                      className="font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {rotateMode && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleRotateKey}
                        disabled={!apiKey || rotateKeyMut.isPending}
                      >
                        {rotateKeyMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RotateCw className="w-3.5 h-3.5 mr-1.5" />}
                        Confirmer rotation
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setRotateMode(false); setApiKey(""); }}
                      >
                        Annuler
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                La clé est chiffrée (AES-256-GCM) avant stockage. Elle ne sera jamais réaffichée.
              </p>
            </>
          )}

          {isLocked && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              Clé gérée via variable d'environnement
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {!isLocked && (
          <>
            <Button
              onClick={handleSave}
              disabled={upsertMut.isPending}
            >
              {upsertMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>

            {enabled && (
              <Button
                variant="outline"
                onClick={() => disableMut.mutate({ orgId })}
                disabled={disableMut.isPending}
              >
                Désactiver IA
              </Button>
            )}
          </>
        )}

        <Button
          variant="outline"
          onClick={() => testMut.mutate({ orgId })}
          disabled={testMut.isPending}
        >
          {testMut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Zap className="w-4 h-4 mr-2" />
          )}
          Tester la connexion
        </Button>
      </div>

      {/* Test result */}
      {testMut.data && (
        <div className={`flex items-start gap-3 rounded-lg p-4 border ${
          testMut.data.ok
            ? "bg-green-500/10 border-green-500/30"
            : "bg-red-500/10 border-red-500/30"
        }`}>
          {testMut.data.ok ? (
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-medium">
              {testMut.data.ok ? "Connexion réussie" : "Échec de connexion"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {testMut.data.providerInfo?.provider} / {testMut.data.providerInfo?.model}
              {" · "}{testMut.data.latencyMs}ms
            </p>
            {testMut.data.error && (
              <p className="text-xs text-red-400 mt-1 font-mono">{testMut.data.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
