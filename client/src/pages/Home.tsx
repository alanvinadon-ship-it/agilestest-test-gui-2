import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { Link } from 'wouter';
import {
  FolderKanban, Settings2, FileText, Play,
  Network, Radio, Database, ArrowRight,
  Activity
} from 'lucide-react';

const quickActions = [
  { href: '/projects', icon: FolderKanban, label: 'Projets', desc: 'Créer ou sélectionner un projet' },
  { href: '/profiles', icon: Settings2, label: 'Profils', desc: 'Configurer les profils de test' },
  { href: '/scenarios', icon: FileText, label: 'Scénarios', desc: 'Définir les scénarios de test' },
  { href: '/datasets', icon: Database, label: 'Datasets', desc: 'Gérer les jeux de données' },
  { href: '/executions', icon: Play, label: 'Exécutions', desc: 'Lancer et suivre les tests' },
  { href: '/captures', icon: Network, label: 'Captures', desc: 'Captures réseau PCAP/Logs' },
  { href: '/probes', icon: Radio, label: 'Sondes', desc: 'Gérer les sondes de collecte' },
];

const workflowSteps = [
  { step: 1, label: 'Créer un projet', desc: 'Définir le domaine (IMS, 5GC, API...)', href: '/projects' },
  { step: 2, label: 'Configurer un profil', desc: 'Paramètres de connexion et protocole', href: '/profiles' },
  { step: 3, label: 'Définir les scénarios', desc: 'Étapes de test et assertions', href: '/scenarios' },
  { step: 4, label: 'Lancer l\'exécution', desc: 'Exécuter les tests et collecter', href: '/executions' },
  { step: 5, label: 'Analyser les résultats', desc: 'Artefacts, incidents, captures', href: '/captures' },
];

export default function Home() {
  const { currentProject } = useProject();
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              Bienvenue{user ? `, ${user.full_name}` : ''}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentProject
                ? <>Projet actif : <span className="text-primary font-medium">{currentProject.name}</span> ({currentProject.domain})</>
                : 'Sélectionnez un projet pour commencer les tests.'
              }
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Activity className="w-4 h-4 text-primary" />
            <span>AgilesTest Cloud</span>
          </div>
        </div>
      </div>

      {/* Workflow Pipeline */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-4">Workflow de test</h2>
        <div className="flex items-start gap-2 overflow-x-auto pb-2">
          {workflowSteps.map((step, i) => (
            <Link key={step.step} href={step.href}>
              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-card border border-border rounded-lg p-4 w-48 hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {step.step}
                    </span>
                    <span className="text-sm font-medium text-foreground">{step.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
                {i < workflowSteps.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-4">Accès rapide</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer group">
                <action.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                <h3 className="text-sm font-medium text-foreground">{action.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Info */}
      {!currentProject && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h3 className="text-sm font-heading font-semibold text-primary mb-1">Pour commencer</h3>
          <p className="text-sm text-muted-foreground">
            Rendez-vous sur la page <Link href="/projects" className="text-primary hover:underline">Projets</Link> pour créer votre premier projet, ou sélectionnez un projet existant via le sélecteur dans la barre supérieure.
          </p>
        </div>
      )}
    </div>
  );
}
