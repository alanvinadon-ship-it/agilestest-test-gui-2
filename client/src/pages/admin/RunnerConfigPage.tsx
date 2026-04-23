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
  Monitor,
  Wifi,
  Zap,
  Save,
  TestTube,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  Server,
  Globe,
  Camera,
  Video,
  Timer,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

type RunnerMode = "LOCAL" | "REMOTE" | "AUTO";

const MODE_INFO: Record<RunnerMode, { icon: typeof Monitor; label: string; desc: string; color: string }> = {
  LOCAL: {
    icon: Monitor,
    label: "Local",
    desc: "Chromium installé sur le serveur AgilesTest",
    color: "text-blue-400",
  },
  REMOTE: {
    icon: Wifi,
    label: "Distant",
    desc: "Navigateur distant via CDP (Browserless, etc.)",
    color: "text-purple-400",
  },
  AUTO: {
    icon: Zap,
    label: "Automatique",
    desc: "Essaie LOCAL d'abord, puis fallback sur REMOTE",
    color: "text-amber-400",
  },
};

export default function RunnerConfigPage() {

  const configQuery = trpc.runnerConfig.get.useQuery();
  const updateMutation = trpc.runnerConfig.update.useMutation();
  const testMutation = trpc.runnerConfig.testConnection.useMutation();

  const [form, setForm] = useState({
    runnerMode: "AUTO" as RunnerMode,
    remoteEndpoint: "",
    remoteToken: "",
    headless: true,
    timeoutMs: 15000,
    enableScreenshots: true,
    enableTrace: false,
    enableVideo: false,
  });
  const [showToken, setShowToken] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (configQuery.data) {
      setForm({
        runnerMode: configQuery.data.runnerMode as RunnerMode,
        remoteEndpoint: configQuery.data.remoteEndpoint || "",
        remoteToken: configQuery.data.remoteToken || "",
        headless: configQuery.data.headless,
        timeoutMs: configQuery.data.timeoutMs,
        enableScreenshots: configQuery.data.enableScreenshots,
        enableTrace: configQuery.data.enableTrace,
        enableVideo: configQuery.data.enableVideo,
      });
    }
  }, [configQuery.data]);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(form);
      setDirty(false);
      configQuery.refetch();
      toast.success("Configuration sauvegardée");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la sauvegarde");
    }
  };

  const handleTest = async () => {
    try {
      const result = await testMutation.mutateAsync();
      if (result.success) {
        toast.success(`Runner ${result.diagnostic?.resolvedMode || "disponible"} détecté`);
      } else {
        toast.error(result.error || result.diagnostic?.localMessage || result.diagnostic?.remoteMessage || "Aucun runner disponible");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du test");
    }
  };

  if (configQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const modeInfo = MODE_INFO[form.runnerMode];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-3">
          <Server className="w-6 h-6 text-primary" />
          Configuration Runner Playwright
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez le mode d'exécution des tests réels (navigateur local ou distant).
        </p>
      </div>

      {/* Mode Selection */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Mode du Runner
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["LOCAL", "REMOTE", "AUTO"] as RunnerMode[]).map((mode) => {
            const info = MODE_INFO[mode];
            const Icon = info.icon;
            const isSelected = form.runnerMode === mode;
            return (
              <button
                key={mode}
                onClick={() => updateField("runnerMode", mode)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/30 bg-card"
                }`}
              >
                <Icon className={`w-5 h-5 mb-2 ${isSelected ? "text-primary" : info.color}`} />
                <div className="text-sm font-medium text-foreground">{info.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{info.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Source indicator */}
        {configQuery.data?.source && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5" />
            Source : {configQuery.data.source.runnerMode === "db" ? "Base de données" : "Variable d'environnement"}
          </div>
        )}
      </div>

      {/* Remote Configuration */}
      {(form.runnerMode === "REMOTE" || form.runnerMode === "AUTO") && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-400" />
            Endpoint Distant (Browserless / CDP)
          </h2>

          <div className="space-y-3">
            <div>
              <Label htmlFor="remoteEndpoint" className="text-sm">
                URL WebSocket (ws:// ou wss://)
              </Label>
              <Input
                id="remoteEndpoint"
                value={form.remoteEndpoint}
                onChange={(e) => updateField("remoteEndpoint", e.target.value)}
                placeholder="wss://chrome.browserless.io?token=YOUR_TOKEN"
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Endpoint WebSocket du navigateur distant. Compatible Browserless, Playwright Server, ou tout endpoint CDP.
              </p>
            </div>

            <div>
              <Label htmlFor="remoteToken" className="text-sm">
                Token d'authentification (optionnel)
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="remoteToken"
                  type={showToken ? "text" : "password"}
                  value={form.remoteToken}
                  onChange={(e) => updateField("remoteToken", e.target.value)}
                  placeholder="Token Browserless"
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowToken(!showToken)}
                  className="shrink-0"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {form.runnerMode === "AUTO" && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-200">
                En mode <strong>AUTO</strong>, le système essaie d'abord le navigateur local. Si indisponible,
                il bascule automatiquement sur l'endpoint distant configuré ci-dessus.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Advanced Settings */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
          <Timer className="w-5 h-5 text-primary" />
          Paramètres avancés
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Timeout */}
          <div>
            <Label htmlFor="timeoutMs" className="text-sm">
              Timeout par étape (ms)
            </Label>
            <Input
              id="timeoutMs"
              type="number"
              min={1000}
              max={120000}
              step={1000}
              value={form.timeoutMs}
              onChange={(e) => updateField("timeoutMs", parseInt(e.target.value) || 15000)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Durée max par étape (1s – 120s)
            </p>
          </div>

          {/* Headless */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <Label className="text-sm font-medium">Mode Headless</Label>
              <p className="text-xs text-muted-foreground">Navigateur sans interface graphique</p>
            </div>
            <Switch
              checked={form.headless}
              onCheckedChange={(v) => updateField("headless", v)}
            />
          </div>
        </div>

        {/* Collection toggles */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-medium text-foreground">Collecte d'artefacts</h3>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Screenshots</Label>
                <p className="text-xs text-muted-foreground">Capture d'écran après chaque étape</p>
              </div>
            </div>
            <Switch
              checked={form.enableScreenshots}
              onCheckedChange={(v) => updateField("enableScreenshots", v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <TestTube className="w-4 h-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Trace Playwright</Label>
                <p className="text-xs text-muted-foreground">Enregistrement détaillé pour debug (trace.zip)</p>
              </div>
            </div>
            <Switch
              checked={form.enableTrace}
              onCheckedChange={(v) => updateField("enableTrace", v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Enregistrement vidéo</Label>
                <p className="text-xs text-muted-foreground">Vidéo de l'exécution complète</p>
              </div>
            </div>
            <Switch
              checked={form.enableVideo}
              onCheckedChange={(v) => updateField("enableVideo", v)}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={!dirty || updateMutation.isPending}
          className="gap-2"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Sauvegarder
        </Button>

        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testMutation.isPending}
          className="gap-2"
        >
          {testMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <TestTube className="w-4 h-4" />
          )}
          Tester la connexion
        </Button>

        {/* Test result indicator */}
        {testMutation.data && (
          <div className="flex items-center gap-2 text-sm">
            {testMutation.data.success ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Runner disponible</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400">Indisponible</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Diagnostic Panel */}
      {testMutation.data?.diagnostic && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-heading font-semibold text-foreground">Diagnostic</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-muted-foreground">Mode configuré</div>
            <div className="font-mono text-foreground">{testMutation.data.diagnostic.configuredMode}</div>

            <div className="text-muted-foreground">Mode résolu</div>
            <div className="font-mono text-foreground">{testMutation.data.diagnostic.resolvedMode || "—"}</div>

            <div className="text-muted-foreground">Fallback utilisé</div>
            <div className="font-mono text-foreground">{testMutation.data.diagnostic.fallbackUsed ? "Oui" : "Non"}</div>

            <div className="text-muted-foreground">Local disponible</div>
            <div className={`font-mono ${testMutation.data.diagnostic.localAvailable ? "text-green-400" : "text-red-400"}`}>
              {testMutation.data.diagnostic.localAvailable ? "Oui" : "Non"}
              {testMutation.data.diagnostic.localMessage && (
                <span className="text-muted-foreground ml-2">— {testMutation.data.diagnostic.localMessage}</span>
              )}
            </div>

            <div className="text-muted-foreground">Remote disponible</div>
            <div className={`font-mono ${testMutation.data.diagnostic.remoteAvailable ? "text-green-400" : "text-red-400"}`}>
              {testMutation.data.diagnostic.remoteAvailable ? "Oui" : "Non"}
              {testMutation.data.diagnostic.remoteMessage && (
                <span className="text-muted-foreground ml-2">— {testMutation.data.diagnostic.remoteMessage}</span>
              )}
            </div>

            {testMutation.data.diagnostic.remoteEndpoint && (
              <>
                <div className="text-muted-foreground">Endpoint distant</div>
                <div className="font-mono text-foreground truncate">{testMutation.data.diagnostic.remoteEndpoint}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
