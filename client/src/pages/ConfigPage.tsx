import { useTestContext } from "@/contexts/TestContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Settings,
  Globe,
  HardDrive,
  User,
  Lock,
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Shield,
} from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export default function ConfigPage() {
  const { targetConfig, setTargetConfig } = useTestContext();
  const [localConfig, setLocalConfig] = useState(targetConfig);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSave = useCallback(() => {
    setTargetConfig(localConfig);
    toast.success("Configuration sauvegardée");
  }, [localConfig, setTargetConfig]);

  const handleReset = useCallback(() => {
    setLocalConfig(targetConfig);
    toast.info("Configuration réinitialisée");
  }, [targetConfig]);

  const handleTestConnection = useCallback(() => {
    setTestingConnection(true);
    setConnectionStatus("idle");
    // Simulate connection test
    setTimeout(() => {
      const success = localConfig.baseUrl.startsWith("http");
      setConnectionStatus(success ? "success" : "error");
      setTestingConnection(false);
      toast(success ? "Connexion réussie" : "Échec de la connexion", {
        description: success ? `Connecté à ${localConfig.baseUrl}` : "Vérifiez l'URL et les identifiants",
      });
    }, 2000);
  }, [localConfig]);

  const hasChanges = JSON.stringify(localConfig) !== JSON.stringify(targetConfig);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Paramètres de connexion à la plateforme AgilesTest cible
          </p>
        </div>
        {hasChanges && (
          <Badge variant="outline" className="text-orange-400 border-orange-400/50">
            Modifications non sauvegardées
          </Badge>
        )}
      </div>

      {/* Platform URL */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-heading text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            Plateforme AgilesTest
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground">URL de base</Label>
            <Input
              value={localConfig.baseUrl}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="https://agilestest.orange-civ.local"
              className="bg-secondary/50 border-border font-mono text-sm"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="gap-2"
            >
              {testingConnection ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : connectionStatus === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : connectionStatus === "error" ? (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Server className="w-3.5 h-3.5" />
              )}
              Tester la connexion
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* MinIO */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-heading text-sm flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            MinIO / S3
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground">Endpoint API</Label>
            <Input
              value={localConfig.minioEndpoint}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, minioEndpoint: e.target.value }))}
              placeholder="https://minio.orange-civ.local"
              className="bg-secondary/50 border-border font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground">Console URL</Label>
            <Input
              value={localConfig.minioConsoleUrl}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, minioConsoleUrl: e.target.value }))}
              placeholder="https://minio.orange-civ.local:9001"
              className="bg-secondary/50 border-border font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Auth */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-heading text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400" />
            Authentification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground">Utilisateur Admin</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={localConfig.adminUser}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, adminUser: e.target.value }))}
                placeholder="admin@agilestest.local"
                className="bg-secondary/50 border-border font-mono text-sm pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="password"
                value={localConfig.adminPassword}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, adminPassword: e.target.value }))}
                placeholder="••••••••"
                className="bg-secondary/50 border-border font-mono text-sm pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={!hasChanges} className="gap-2">
          <Save className="w-4 h-4" /> Sauvegarder
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={!hasChanges} className="gap-2">
          <RotateCcw className="w-4 h-4" /> Réinitialiser
        </Button>
      </div>

      {/* Info */}
      <Card className="bg-secondary/20 border-border">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Note :</strong> Cette configuration est stockée localement dans le navigateur.
            Les identifiants ne sont jamais transmis à des serveurs tiers. Pour une utilisation en production,
            configurez l'authentification via les variables d'environnement du déploiement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
