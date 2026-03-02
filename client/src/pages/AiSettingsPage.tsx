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
import AiEnginesTab from "../components/AiEnginesTab";
import AiRoutingTab from "../components/AiRoutingTab";

type Provider = "OPENAI" | "AZURE_OPENAI" | "ANTHROPIC" | "CUSTOM_HTTP";
type Tab = "config" | "engines" | "routing";

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
  const [activeTab, setActiveTab] = useState<Tab>("config");

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Configuration IA</h1>
          <p className="text-sm text-muted-foreground">
            Gérer les moteurs IA, les règles de routage et les configurations par défaut.
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
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Clé de chiffrement manquante</p>
            <p className="text-xs text-muted-foreground mt-1">
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">AI_CONFIG_MASTER_KEY</code> non configurée.
              L'enregistrement de clés API est désactivé.
            </p>
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Comment résoudre (Docker)
              </summary>
              <ol className="text-xs text-muted-foreground mt-1.5 space-y-1 list-decimal list-inside">
                <li>Générer la clé : <code className="bg-muted px-1 py-0.5 rounded text-[11px]">openssl rand -hex 32</code></li>
                <li>Créer <code className="bg-muted px-1 py-0.5 rounded text-[11px]">deploy/docker/secrets/ai_config_master_key.txt</code></li>
                <li>Redémarrer : <code className="bg-muted px-1 py-0.5 rounded text-[11px]">docker compose -f docker-compose.prod.yml up -d --force-recreate</code></li>
              </ol>
            </details>
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

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          {(["config", "engines", "routing"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "config" && "Configuration par défaut"}
              {tab === "engines" && "Moteurs"}
              {tab === "routing" && "Routage"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "config" && (
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
                placeholder="model-name"
                disabled={isLocked}
              />
            )}
          </div>

          {/* Advanced */}
          <details className="border border-border rounded-lg" open>
            <summary className="px-4 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
              Paramètres avancés
            </summary>
            <div className="px-4 pb-4 space-y-3">
              {/* Base URL */}
              <div className="space-y-2">
                <Label className="text-xs">Base URL <span className="text-muted-foreground">(optionnel)</span></Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com"
                  disabled={isLocked}
                />
              </div>

              {/* Timeout & Retries */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(Number(e.target.value))}
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max retries</Label>
                  <Input
                    type="number"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Number(e.target.value))}
                    disabled={isLocked}
                  />
                </div>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <Label className="text-xs">Température <span className="text-muted-foreground">(optionnel)</span></Label>
                <Input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="0.7"
                  disabled={isLocked}
                />
              </div>

              {/* Azure fields */}
              {provider === "AZURE_OPENAI" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">Azure Endpoint</Label>
                    <Input
                      value={azureEndpoint}
                      onChange={(e) => setAzureEndpoint(e.target.value)}
                      placeholder="https://xxx.openai.azure.com"
                      disabled={isLocked}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Deployment</Label>
                      <Input
                        value={azureDeployment}
                        onChange={(e) => setAzureDeployment(e.target.value)}
                        placeholder="gpt-4o"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">API Version</Label>
                      <Input
                        value={azureApiVersion}
                        onChange={(e) => setAzureApiVersion(e.target.value)}
                        placeholder="2024-02-01"
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Custom HTTP */}
              {provider === "CUSTOM_HTTP" && (
                <div className="space-y-2">
                  <Label className="text-xs">Custom HTTP URL</Label>
                  <Input
                    value={customHttpUrl}
                    onChange={(e) => setCustomHttpUrl(e.target.value)}
                    placeholder="https://api.example.com/v1/chat/completions"
                    disabled={isLocked}
                  />
                </div>
              )}
            </div>
          </details>

          {/* API Key */}
          {enabled && (
            <div className="space-y-2">
              <Label>Clé API {rotateMode ? "(nouvelle clé)" : "(laisser vide pour conserver)"}</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={rotateMode ? "sk-..." : "••••••••"}
                  className="pr-10"
                  disabled={isLocked}
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
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            {!isLocked && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={upsertMut.isPending || (!hasMasterKeyAvail && !!apiKey)}
                  title={!hasMasterKeyAvail && !!apiKey ? "Master key manquante — impossible de chiffrer la clé API" : undefined}
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

                {hasSecret && (
                  <Button
                    variant="outline"
                    onClick={() => setRotateMode(!rotateMode)}
                  >
                    <RotateCw className="w-4 h-4 mr-2" />
                    {rotateMode ? "Annuler rotation" : "Rotation de clé"}
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
      )}

      {activeTab === "engines" && <AiEnginesTab orgId={orgId} isLocked={isLocked} />}
      {activeTab === "routing" && <AiRoutingTab orgId={orgId} isLocked={isLocked} />}
    </div>
  );
}
