import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function KeycloakConfigPage() {
  const [formData, setFormData] = useState({
    url: "",
    realm: "",
    clientId: "",
    clientSecret: "",
    sessionTimeoutMinutes: 1440,
    googleClientId: "",
    googleClientSecret: "",
    githubClientId: "",
    githubClientSecret: "",
  });

  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load current configuration
  const { data: config, isLoading: configLoading } = trpc.keycloak.get.useQuery();

  // Update configuration mutation
  const updateMutation = trpc.keycloak.update.useMutation({
    onSuccess: () => {
      setMessage({ type: "success", text: "Configuration saved successfully" });
    },
    onError: (error) => {
      setMessage({ type: "error", text: error.message });
    },
  });

  // Test connection mutation
  const testConnectionMutation = trpc.keycloak.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        setMessage({ type: "success", text: "Connection test successful" });
      } else {
        setMessage({ type: "error", text: `Connection failed: ${result.error}` });
      }
    },
    onError: (error) => {
      setMessage({ type: "error", text: error.message });
    },
  });

  // Test social providers mutation
  const testProvidersMutation = trpc.keycloak.testSocialProviders.useMutation({
    onSuccess: (result) => {
      setTestResults(result);
      setMessage({ type: "success", text: "Social providers tested" });
    },
    onError: (error) => {
      setMessage({ type: "error", text: error.message });
    },
  });

  // Load config data
  useEffect(() => {
    if (config) {
      setFormData({
        url: config.url || "",
        realm: config.realm || "",
        clientId: config.clientId || "",
        clientSecret: config.clientSecret || "",
        sessionTimeoutMinutes: config.sessionTimeoutMinutes || 1440,
        googleClientId: config.googleClientId || "",
        googleClientSecret: config.googleClientSecret || "",
        githubClientId: config.githubClientId || "",
        githubClientSecret: config.githubClientSecret || "",
      });
    }
  }, [config]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateMutation.mutateAsync(formData);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      await testConnectionMutation.mutateAsync(formData);
    } finally {
      setLoading(false);
    }
  };

  const handleTestProviders = async () => {
    setLoading(true);
    try {
      await testProvidersMutation.mutateAsync({
        url: formData.url,
        realm: formData.realm,
        googleClientId: formData.googleClientId,
        githubClientId: formData.githubClientId,
      });
    } finally {
      setLoading(false);
    }
  };

  if (configLoading) {
    return <div className="flex items-center justify-center p-8">Loading configuration...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Keycloak Configuration</h1>
        <p className="text-muted-foreground mt-2">Configure Keycloak server and social login providers</p>
      </div>

      {message && (
        <Alert variant={message.type === "success" ? "default" : "destructive"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Keycloak Server Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Keycloak Server</CardTitle>
          <CardDescription>Configure your Keycloak server connection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="url">Keycloak URL</Label>
              <Input
                id="url"
                placeholder="http://localhost:8080"
                value={formData.url}
                onChange={(e) => handleInputChange("url", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="realm">Realm</Label>
              <Input
                id="realm"
                placeholder="agilestest"
                value={formData.realm}
                onChange={(e) => handleInputChange("realm", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                placeholder="agilestest-web"
                value={formData.clientId}
                onChange={(e) => handleInputChange("clientId", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                placeholder="••••••••"
                value={formData.clientSecret}
                onChange={(e) => handleInputChange("clientSecret", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleTestConnection}
              variant="outline"
              disabled={loading || !formData.url || !formData.realm}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Social Providers Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Social Login Providers</CardTitle>
          <CardDescription>Configure Google and GitHub OAuth</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google */}
          <div className="space-y-2">
            <h3 className="font-semibold">Google</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="googleClientId">Client ID</Label>
                <Input
                  id="googleClientId"
                  placeholder="xxx.apps.googleusercontent.com"
                  value={formData.googleClientId}
                  onChange={(e) => handleInputChange("googleClientId", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="googleClientSecret">Client Secret</Label>
                <Input
                  id="googleClientSecret"
                  type="password"
                  placeholder="••••••••"
                  value={formData.googleClientSecret}
                  onChange={(e) => handleInputChange("googleClientSecret", e.target.value)}
                />
              </div>
            </div>
            {testResults?.google && (
              <div className="flex items-center gap-2 text-sm">
                {testResults.google.available ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span>
                  {testResults.google.available
                    ? "Google provider is available"
                    : `Error: ${testResults.google.error}`}
                </span>
              </div>
            )}
          </div>

          {/* GitHub */}
          <div className="space-y-2">
            <h3 className="font-semibold">GitHub</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="githubClientId">Client ID</Label>
                <Input
                  id="githubClientId"
                  placeholder="Ov23liXXXXXXXXXX"
                  value={formData.githubClientId}
                  onChange={(e) => handleInputChange("githubClientId", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="githubClientSecret">Client Secret</Label>
                <Input
                  id="githubClientSecret"
                  type="password"
                  placeholder="••••••••"
                  value={formData.githubClientSecret}
                  onChange={(e) => handleInputChange("githubClientSecret", e.target.value)}
                />
              </div>
            </div>
            {testResults?.github && (
              <div className="flex items-center gap-2 text-sm">
                {testResults.github.available ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span>
                  {testResults.github.available
                    ? "GitHub provider is available"
                    : `Error: ${testResults.github.error}`}
                </span>
              </div>
            )}
          </div>

          <Button
            onClick={handleTestProviders}
            variant="outline"
            disabled={loading || !formData.url || !formData.realm}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test Social Providers
          </Button>
        </CardContent>
      </Card>

      {/* Session Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Session Settings</CardTitle>
          <CardDescription>Configure session timeout</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
            <Input
              id="sessionTimeout"
              type="number"
              min="5"
              max="10080"
              value={formData.sessionTimeoutMinutes}
              onChange={(e) => handleInputChange("sessionTimeoutMinutes", parseInt(e.target.value))}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Minimum 5 minutes, maximum 7 days (10080 minutes)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={loading || updateMutation.isPending}
          className="w-full sm:w-auto"
        >
          {loading || updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
