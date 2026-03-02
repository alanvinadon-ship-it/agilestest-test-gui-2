import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
export type TestStatus = "idle" | "running" | "passed" | "failed" | "skipped";
export type CampaignType = "vabf" | "span" | "vabe";

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category: string;
}

export interface TestStep {
  id: string;
  title: string;
  description: string;
  status: TestStatus;
  result?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

export interface VabeScenario {
  id: string;
  name: string;
  type: "read-heavy" | "create-upload" | "reporting" | "combined";
  status: TestStatus;
  config: {
    rps: number;
    duration: number;
    vus: number;
  };
  results?: {
    p95Latency: number;
    errorRate: number;
    avgRps: number;
    totalRequests: number;
    cpuPeak: number;
    memPeak: number;
  };
}

export interface Campaign {
  id: string;
  type: CampaignType;
  name: string;
  status: TestStatus;
  startedAt?: string;
  completedAt?: string;
  steps: TestStep[];
  progress: number;
}

export interface TargetConfig {
  baseUrl: string;
  minioEndpoint: string;
  minioConsoleUrl: string;
  adminUser: string;
  adminPassword: string;
}

interface TestContextType {
  targetConfig: TargetConfig;
  setTargetConfig: (config: TargetConfig) => void;
  campaigns: Campaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  activeCampaign: Campaign | null;
  setActiveCampaign: (campaign: Campaign | null) => void;
  vabeScenarios: VabeScenario[];
  setVabeScenarios: React.Dispatch<React.SetStateAction<VabeScenario[]>>;
  checklists: Record<string, ChecklistItem[]>;
  toggleChecklistItem: (category: string, itemId: string) => void;
  updateStepStatus: (campaignId: string, stepId: string, status: TestStatus, result?: string) => void;
  startCampaign: (type: CampaignType) => void;
}

// ── Default data ──────────────────────────────────────────────────────────
const defaultVabfSteps: TestStep[] = [
  { id: "vabf-01", title: "Connexion Admin", description: "Login avec le compte admin@agilestest.local / Admin@2025", status: "idle" },
  { id: "vabf-02", title: "Vérification Dashboard", description: "Le dashboard principal s'affiche sans erreur", status: "idle" },
  { id: "vabf-03", title: "Création Projet", description: "Créer le projet ORANGE-PILOT-WEB via l'UI ou vérifier le seed", status: "idle" },
  { id: "vabf-04", title: "Sélection Projet", description: "Sélectionner le projet dans le ProjectSwitcher", status: "idle" },
  { id: "vabf-05", title: "Import Profil de Test", description: "Créer ou importer un profil de test (SIP/DIAMETER/HTTP2)", status: "idle" },
  { id: "vabf-06", title: "Création Scénario", description: "Créer un scénario de test avec les datasets associés", status: "idle" },
  { id: "vabf-07", title: "Exécution Nominale", description: "Lancer une exécution de test en mode nominal", status: "idle" },
  { id: "vabf-08", title: "Vérification Artefacts", description: "Vérifier la présence des artefacts (logs, screenshots)", status: "idle" },
  { id: "vabf-09", title: "Exécution avec Bug", description: "Lancer une exécution avec un bug connu reproductible", status: "idle" },
  { id: "vabf-10", title: "Incident Créé", description: "Vérifier qu'un incident a été créé automatiquement", status: "idle" },
  { id: "vabf-11", title: "Analyse IA", description: "Vérifier que l'analyse IA explicable est disponible", status: "idle" },
  { id: "vabf-12", title: "Rapport Incident", description: "Vérifier le rendu du rapport d'incident complet", status: "idle" },
  { id: "vabf-13", title: "RBAC Viewer", description: "Se connecter en Viewer et vérifier les restrictions", status: "idle" },
];

const defaultSpanSteps: TestStep[] = [
  { id: "span-01", title: "Vérification Interface SPAN", description: "Confirmer que l'interface ens224 reçoit du trafic miroir", status: "idle" },
  { id: "span-02", title: "Probe Agent Actif", description: "Vérifier que l'agent probe est connecté (heartbeat OK)", status: "idle" },
  { id: "span-03", title: "Lancer Capture BPF", description: "Lancer une capture de 120s avec filtre BPF 'port 5060'", status: "idle" },
  { id: "span-04", title: "Statut Running", description: "Vérifier que le statut passe à RUNNING dans l'UI", status: "idle" },
  { id: "span-05", title: "Capture Terminée", description: "Attendre la fin de la capture (statut COMPLETED)", status: "idle" },
  { id: "span-06", title: "Artefact PCAP", description: "Vérifier la présence du fichier .pcap.gz dans les artefacts", status: "idle" },
  { id: "span-07", title: "Summary JSON", description: "Vérifier la présence et le contenu du summary.json", status: "idle" },
  { id: "span-08", title: "Upload MinIO", description: "Vérifier que les fichiers sont dans le bucket MinIO", status: "idle" },
  { id: "span-09", title: "Téléchargement URL", description: "Télécharger le PCAP via l'URL présignée depuis l'UI", status: "idle" },
  { id: "span-10", title: "Sécurité BPF", description: "Tenter une capture sans filtre BPF → doit être refusée", status: "idle" },
  { id: "span-11", title: "Sécurité Interface", description: "Tenter une capture sur une interface non autorisée → refus", status: "idle" },
  { id: "span-12", title: "Limite Durée", description: "Tenter une capture > durée max → doit être tronquée/refusée", status: "idle" },
];

const defaultVabeScenarios: VabeScenario[] = [
  {
    id: "vabe-read", name: "Read Heavy", type: "read-heavy", status: "idle",
    config: { rps: 50, duration: 300, vus: 50 },
  },
  {
    id: "vabe-create", name: "Create & Upload", type: "create-upload", status: "idle",
    config: { rps: 20, duration: 300, vus: 20 },
  },
  {
    id: "vabe-report", name: "Reporting", type: "reporting", status: "idle",
    config: { rps: 30, duration: 300, vus: 30 },
  },
  {
    id: "vabe-combined", name: "Combiné (80/15/5)", type: "combined", status: "idle",
    config: { rps: 100, duration: 600, vus: 100 },
  },
];

const defaultChecklists: Record<string, ChecklistItem[]> = {
  "vabf-avant": [
    { id: "c1", label: "Plateforme AgilesTest déployée et accessible", checked: false, category: "vabf-avant" },
    { id: "c2", label: "Comptes admin/manager/viewer créés (seed OK)", checked: false, category: "vabf-avant" },
    { id: "c3", label: "Projet ORANGE-PILOT-WEB créé ou seed activé", checked: false, category: "vabf-avant" },
    { id: "c4", label: "Bug reproductible identifié et documenté", checked: false, category: "vabf-avant" },
    { id: "c5", label: "Navigateur Chrome/Firefox récent disponible", checked: false, category: "vabf-avant" },
    { id: "c6", label: "Accès réseau à l'URL de la plateforme confirmé", checked: false, category: "vabf-avant" },
  ],
  "vabf-apres": [
    { id: "c7", label: "PV de recette signé par les deux parties", checked: false, category: "vabf-apres" },
    { id: "c8", label: "Anomalies mineures listées avec tickets", checked: false, category: "vabf-apres" },
    { id: "c9", label: "Captures d'écran des résultats archivées", checked: false, category: "vabf-apres" },
    { id: "c10", label: "Rapport de test exporté en PDF", checked: false, category: "vabf-apres" },
  ],
  "vabe-avant": [
    { id: "c11", label: "k6 installé sur la machine d'injection", checked: false, category: "vabe-avant" },
    { id: "c12", label: "Scripts k6 copiés et configurés (BASE_URL)", checked: false, category: "vabe-avant" },
    { id: "c13", label: "Monitoring CPU/RAM actif (htop, Grafana, ou docker stats)", checked: false, category: "vabe-avant" },
    { id: "c14", label: "MinIO accessible et bucket agilestest-artifacts créé", checked: false, category: "vabe-avant" },
    { id: "c15", label: "Base de données Postgres accessible", checked: false, category: "vabe-avant" },
    { id: "c16", label: "Réseau entre injecteur et plateforme vérifié (latence < 5ms)", checked: false, category: "vabe-avant" },
  ],
  "vabe-apres": [
    { id: "c17", label: "Résultats k6 exportés (JSON + HTML)", checked: false, category: "vabe-apres" },
    { id: "c18", label: "Métriques p95 latence, taux d'erreur, CPU, RAM documentées", checked: false, category: "vabe-apres" },
    { id: "c19", label: "Rapport VABE complété avec interprétation", checked: false, category: "vabe-apres" },
    { id: "c20", label: "Décision GO/NO-GO documentée", checked: false, category: "vabe-apres" },
  ],
};

// ── Context ──────────────────────────────────────────────────────────────
const TestContext = createContext<TestContextType | null>(null);

export function TestProvider({ children }: { children: ReactNode }) {
  const [targetConfig, setTargetConfig] = useState<TargetConfig>({
    baseUrl: "https://agilestest.orange-civ.local",
    minioEndpoint: "https://minio.orange-civ.local",
    minioConsoleUrl: "https://minio.orange-civ.local:9001",
    adminUser: "admin@agilestest.local",
    adminPassword: "Admin@2025",
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [vabeScenarios, setVabeScenarios] = useState<VabeScenario[]>(defaultVabeScenarios);
  const [checklists, setChecklists] = useState(defaultChecklists);

  const toggleChecklistItem = useCallback((category: string, itemId: string) => {
    setChecklists(prev => ({
      ...prev,
      [category]: prev[category]?.map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      ) ?? [],
    }));
  }, []);

  const updateStepStatus = useCallback((campaignId: string, stepId: string, status: TestStatus, result?: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id !== campaignId) return c;
      const steps = c.steps.map(s =>
        s.id === stepId
          ? { ...s, status, result, completedAt: status === "passed" || status === "failed" ? new Date().toISOString() : undefined }
          : s
      );
      const done = steps.filter(s => s.status !== "idle" && s.status !== "running").length;
      const progress = Math.round((done / steps.length) * 100);
      const allDone = steps.every(s => s.status !== "idle" && s.status !== "running");
      const anyFailed = steps.some(s => s.status === "failed");
      return {
        ...c,
        steps,
        progress,
        status: allDone ? (anyFailed ? "failed" : "passed") : c.status,
        completedAt: allDone ? new Date().toISOString() : undefined,
      };
    }));
  }, []);

  const startCampaign = useCallback((type: CampaignType) => {
    const now = new Date().toISOString();
    const id = `${type}-${Date.now()}`;
    const steps = type === "vabf" ? defaultVabfSteps : type === "span" ? defaultSpanSteps : [];
    const campaign: Campaign = {
      id, type,
      name: type === "vabf" ? "VABF/VSR Acceptance" : type === "span" ? "Capture SPAN" : "VABE Charge",
      status: "running", startedAt: now, steps: steps.map(s => ({ ...s })), progress: 0,
    };
    setCampaigns(prev => [campaign, ...prev]);
    setActiveCampaign(campaign);
  }, []);

  return (
    <TestContext.Provider value={{
      targetConfig, setTargetConfig,
      campaigns, setCampaigns,
      activeCampaign, setActiveCampaign,
      vabeScenarios, setVabeScenarios,
      checklists, toggleChecklistItem,
      updateStepStatus, startCampaign,
    }}>
      {children}
    </TestContext.Provider>
  );
}

export function useTestContext() {
  const ctx = useContext(TestContext);
  if (!ctx) throw new Error("useTestContext must be used within TestProvider");
  return ctx;
}
