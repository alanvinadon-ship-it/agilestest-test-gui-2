import { useTestContext } from "@/contexts/TestContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  ClipboardCheck,
  Network,
  Gauge,
  ListChecks,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
} from "lucide-react";

const HERO_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663315306103/EdCeetWnsZfgSyaj.png";
const PIPELINE_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663315306103/cqSqpcgwQMzGenJd.png";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    idle: { label: "En attente", variant: "secondary" },
    running: { label: "En cours", variant: "default" },
    passed: { label: "Réussi", variant: "default" },
    failed: { label: "Échoué", variant: "destructive" },
    skipped: { label: "Ignoré", variant: "outline" },
  };
  const { label, variant } = map[status] ?? map.idle;
  return <Badge variant={variant} className={status === "passed" ? "bg-emerald-600 hover:bg-emerald-700" : ""}>{label}</Badge>;
}

export default function Home() {
  const { campaigns, checklists } = useTestContext();

  const totalChecked = Object.values(checklists).flat().filter(i => i.checked).length;
  const totalItems = Object.values(checklists).flat().length;
  const checklistProgress = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;

  const lastVabf = campaigns.find(c => c.type === "vabf");
  const lastSpan = campaigns.find(c => c.type === "span");
  const lastVabe = campaigns.find(c => c.type === "vabe");

  const quickActions = [
    { href: "/vabf", icon: ClipboardCheck, label: "Lancer VABF", desc: "Test d'acceptance fonctionnel", color: "text-blue-400" },
    { href: "/span", icon: Network, label: "Test SPAN", desc: "Capture réseau PCAP", color: "text-cyan-400" },
    { href: "/vabe", icon: Gauge, label: "Lancer VABE", desc: "Test de charge k6", color: "text-orange-400" },
    { href: "/checklists", icon: ListChecks, label: "Checklists", desc: "Vérifications Jour J", color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="relative rounded-lg overflow-hidden border border-border" style={{ minHeight: 220 }}>
        <img
          src={HERO_IMG}
          alt="AgilesTest Test Console"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative z-10 p-8 flex flex-col justify-center" style={{ minHeight: 220 }}>
          <p className="font-mono text-xs text-primary tracking-widest uppercase mb-2">Orange CIV // AgilesTest v0.1.1</p>
          <h2 className="font-heading text-3xl font-bold text-foreground mb-2">Console de Test</h2>
          <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
            Pilotez les campagnes de validation fonctionnelle (VABF/VSR), les tests de capture réseau (SPAN/TAP),
            et les tests de charge (VABE) depuis cette interface unifiée.
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map(action => (
          <Link key={action.href} href={action.href}>
            <Card className="group hover:glow-border transition-all duration-200 cursor-pointer bg-card border-border h-full">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <div className="flex-1">
                  <p className="font-heading font-semibold text-sm text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pipeline illustration */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base">Pipeline de Validation</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <img
            src={PIPELINE_IMG}
            alt="Pipeline de test"
            className="w-full h-48 object-cover object-center opacity-80"
          />
        </CardContent>
      </Card>

      {/* Status grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* VABF Status */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-sm flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-blue-400" />
                VABF / VSR
              </CardTitle>
              {lastVabf ? <StatusBadge status={lastVabf.status} /> : <Badge variant="secondary">Non démarré</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {lastVabf ? (
              <>
                <Progress value={lastVabf.progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{lastVabf.steps.filter(s => s.status === "passed").length} / {lastVabf.steps.length} étapes</span>
                  <span>{lastVabf.progress}%</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" />{lastVabf.steps.filter(s => s.status === "passed").length}</span>
                  <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" />{lastVabf.steps.filter(s => s.status === "failed").length}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-muted-foreground" />{lastVabf.steps.filter(s => s.status === "idle").length}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground mb-3">Aucune campagne VABF lancée</p>
                <Link href="/vabf">
                  <Button size="sm" variant="outline" className="gap-1">
                    <Play className="w-3 h-3" /> Démarrer
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SPAN Status */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-sm flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                Capture SPAN
              </CardTitle>
              {lastSpan ? <StatusBadge status={lastSpan.status} /> : <Badge variant="secondary">Non démarré</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {lastSpan ? (
              <>
                <Progress value={lastSpan.progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{lastSpan.steps.filter(s => s.status === "passed").length} / {lastSpan.steps.length} étapes</span>
                  <span>{lastSpan.progress}%</span>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground mb-3">Aucun test SPAN lancé</p>
                <Link href="/span">
                  <Button size="sm" variant="outline" className="gap-1">
                    <Play className="w-3 h-3" /> Démarrer
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checklists */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-sm flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-emerald-400" />
                Checklists Jour J
              </CardTitle>
              <span className="text-xs font-mono text-muted-foreground">{totalChecked}/{totalItems}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={checklistProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{checklistProgress}% complété</span>
              <Link href="/checklists">
                <span className="text-primary hover:underline cursor-pointer">Voir tout →</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent campaigns */}
      {campaigns.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-base">Campagnes Récentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {campaigns.slice(0, 5).map(campaign => (
                <div key={campaign.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <span className={`status-led ${campaign.status === "passed" ? "status-led-success" : campaign.status === "failed" ? "status-led-error" : campaign.status === "running" ? "status-led-warning animate-pulse-glow" : "status-led-idle"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {campaign.startedAt ? new Date(campaign.startedAt).toLocaleString("fr-FR") : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={campaign.progress} className="w-24 h-1.5" />
                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">{campaign.progress}%</span>
                    <StatusBadge status={campaign.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
