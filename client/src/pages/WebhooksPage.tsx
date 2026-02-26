import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "../state/projectStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Webhook,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  Send,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";

const EVENT_LABELS: Record<string, string> = {
  "run.completed": "Exécution terminée",
  "run.failed": "Exécution échouée",
  "probe.alert.red": "Sonde en alerte RED",
  "probe.status.changed": "Changement statut sonde",
  "incident.created": "Incident créé",
};

const ALL_EVENTS = Object.keys(EVENT_LABELS);

export default function WebhooksPage() {
  const { currentProject } = useProject();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const projectId = currentProject?.id ?? "";

  const { data: webhooks, isLoading, refetch } = trpc.webhooks.list.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const utils = trpc.useUtils();

  const deleteMut = trpc.webhooks.delete.useMutation({
    onSuccess: () => {
      toast.success("Webhook supprimé");
      utils.webhooks.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMut = trpc.webhooks.update.useMutation({
    onSuccess: () => {
      utils.webhooks.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const testMut = trpc.webhooks.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Test réussi (HTTP ${result.httpStatus})`);
      } else {
        toast.error(`Test échoué${result.httpStatus ? ` (HTTP ${result.httpStatus})` : ""}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  if (!currentProject) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground">
          Sélectionnez un projet pour gérer les webhooks.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Webhook className="w-6 h-6 text-primary" />
            Webhooks sortants
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recevez des notifications en temps réel sur vos endpoints HTTP
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Nouveau webhook
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <CreateWebhookForm
          projectId={projectId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            utils.webhooks.list.invalidate();
          }}
        />
      )}

      {/* Webhooks List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
              <div className="h-5 w-48 bg-muted rounded" />
              <div className="h-4 w-64 bg-muted rounded mt-2" />
            </div>
          ))}
        </div>
      ) : !webhooks || webhooks.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <Webhook className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun webhook configuré</p>
          <p className="text-xs text-muted-foreground mt-1">
            Créez un webhook pour recevoir des notifications HTTP automatiques
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-card border border-border rounded-lg">
              {/* Webhook header */}
              <div className="p-4 flex items-center justify-between">
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)}
                >
                  {expandedId === wh.id ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{wh.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          wh.enabled
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {wh.enabled ? "ACTIF" : "INACTIF"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-md">
                      {wh.url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggleMut.mutate({
                        webhookId: wh.id,
                        enabled: !wh.enabled,
                      })
                    }
                    title={wh.enabled ? "Désactiver" : "Activer"}
                  >
                    {wh.enabled ? (
                      <ToggleRight className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => testMut.mutate({ webhookId: wh.id })}
                    disabled={testMut.isPending}
                    title="Envoyer un test"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Supprimer ce webhook ?")) {
                        deleteMut.mutate({ webhookId: wh.id });
                      }
                    }}
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {/* Events badges */}
              <div className="px-4 pb-3 flex flex-wrap gap-1">
                {(wh.events as string[]).map((ev) => (
                  <span
                    key={ev}
                    className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium"
                  >
                    {EVENT_LABELS[ev] ?? ev}
                  </span>
                ))}
              </div>

              {/* Expanded: delivery logs */}
              {expandedId === wh.id && (
                <DeliveryLogs webhookId={wh.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Webhook Form ────────────────────────────────────────────────────

function CreateWebhookForm({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const createMut = trpc.webhooks.create.useMutation({
    onSuccess: (result) => {
      setCreatedSecret(result.secret);
      toast.success("Webhook créé");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleEvent = (ev: string) => {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  if (createdSecret) {
    return (
      <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Secret du webhook</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Copiez ce secret maintenant. Il ne sera plus affiché.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted rounded px-3 py-2 text-xs font-mono text-foreground">
            {showSecret ? createdSecret : "••••••••••••••••••••••••"}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(createdSecret);
              toast.success("Secret copié");
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <Button size="sm" onClick={onCreated}>
          Fermer
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-medium text-foreground">Nouveau webhook</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nom</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Slack Notifications"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">URL endpoint</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">
          Événements ({selectedEvents.length} sélectionné{selectedEvents.length !== 1 ? "s" : ""})
        </label>
        <div className="flex flex-wrap gap-2">
          {ALL_EVENTS.map((ev) => (
            <button
              key={ev}
              onClick={() => toggleEvent(ev)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                selectedEvents.includes(ev)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              {EVENT_LABELS[ev] ?? ev}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Button
          size="sm"
          onClick={() =>
            createMut.mutate({
              projectId,
              name,
              url,
              events: selectedEvents as any,
            })
          }
          disabled={!name || !url || selectedEvents.length === 0 || createMut.isPending}
        >
          {createMut.isPending ? "Création..." : "Créer"}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

// ─── Delivery Logs ──────────────────────────────────────────────────────────

function DeliveryLogs({ webhookId }: { webhookId: number }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.webhooks.deliveries.useQuery(
    { webhookId, page, pageSize: 10 },
    { placeholderData: (prev) => prev }
  );

  const statusColor: Record<string, string> = {
    SUCCESS: "text-emerald-500 bg-emerald-500/10",
    FAILED: "text-red-500 bg-red-500/10",
    PENDING: "text-amber-500 bg-amber-500/10",
  };

  return (
    <div className="border-t border-border p-4 space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Historique des livraisons
      </h4>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Chargement...</div>
      ) : !data || data.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune livraison enregistrée</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-3">Événement</th>
                  <th className="text-left py-2 pr-3">Statut</th>
                  <th className="text-left py-2 pr-3">HTTP</th>
                  <th className="text-left py-2 pr-3">Tentative</th>
                  <th className="text-left py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((d) => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono">{d.eventType}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          statusColor[d.status] ?? ""
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono">
                      {d.httpStatus ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {d.attempt}/{d.maxAttempts}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {d.createdAt
                        ? new Date(d.createdAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {data.total > 10 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {data.total} livraison{data.total > 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 10 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
