import { useState } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryApi } from '../api/repositoryApi';
import type { TestProfile, CaptureProfile } from '../types';
import {
  Plus, Settings2, Loader2, Trash2, X, AlertCircle, Search,
  Globe, Phone, Server, Wifi, Code, Layers
} from 'lucide-react';

const PROTOCOLS: { value: CaptureProfile; label: string; icon: typeof Globe; desc: string }[] = [
  { value: 'SIP', label: 'SIP', icon: Phone, desc: 'Session Initiation Protocol' },
  { value: 'DIAMETER', label: 'DIAMETER', icon: Layers, desc: 'Protocole AAA télécom' },
  { value: 'HTTP2', label: 'HTTP/2', icon: Globe, desc: 'HTTP/2 & gRPC' },
  { value: 'IMS', label: 'IMS', icon: Server, desc: 'IP Multimedia Subsystem' },
  { value: 'WEB', label: 'WEB', icon: Wifi, desc: 'Web standard HTTP/HTTPS' },
  { value: 'CUSTOM', label: 'Custom', icon: Code, desc: 'Protocole personnalisé' },
];

function CreateProfileModal({ isOpen, onClose, projectId }: {
  isOpen: boolean; onClose: () => void; projectId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [protocol, setProtocol] = useState<CaptureProfile>('SIP');
  const [targetHost, setTargetHost] = useState('');
  const [targetPort, setTargetPort] = useState('5060');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: Partial<TestProfile>) => repositoryApi.createProfile(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles', projectId] });
      setName(''); setDescription(''); setProtocol('SIP'); setTargetHost(''); setTargetPort('5060');
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Erreur lors de la création.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !targetHost.trim()) {
      setError('Le nom et l\'hôte cible sont requis.');
      return;
    }
    mutation.mutate({
      name: name.trim(),
      description: description.trim(),
      protocol,
      target_host: targetHost.trim(),
      target_port: parseInt(targetPort) || 5060,
      parameters: {},
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-heading font-semibold text-foreground">Nouveau profil de test</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nom du profil *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex: IMS Registration Test"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Protocole *</label>
            <div className="grid grid-cols-3 gap-2">
              {PROTOCOLS.map((p) => (
                <button key={p.value} type="button" onClick={() => setProtocol(p.value)}
                  className={`flex flex-col items-center gap-1 rounded-md border p-3 text-xs transition-colors ${
                    protocol === p.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-border/80'
                  }`}>
                  <p.icon className="w-4 h-4" />
                  <span className="font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Hôte cible *</label>
              <input type="text" value={targetHost} onChange={(e) => setTargetHost(e.target.value)}
                placeholder="192.168.1.100"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Port</label>
              <input type="number" value={targetPort} onChange={(e) => setTargetPort(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Description optionnelle..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProfilesPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['profiles', currentProject?.id],
    queryFn: () => repositoryApi.listProfiles(currentProject!.id),
    enabled: !!currentProject,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repositoryApi.deleteProfile(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles', currentProject?.id] }),
  });

  const profiles = (data?.data || []) as TestProfile[];
  const filtered = search
    ? profiles.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
    : profiles;

  if (!currentProject) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <Settings2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Aucun projet sélectionné</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez un projet pour gérer ses profils de test.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Profils de test</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez les profils pour <strong className="text-foreground">{currentProject.name}</strong>. Un profil définit le protocole, l'hôte cible et les paramètres de connexion.
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau profil
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un profil..."
          className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Settings2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucun profil</h3>
          <p className="text-sm text-muted-foreground mb-4">Créez un profil pour définir les paramètres de connexion au système cible.</p>
          {canWrite && (
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Nouveau profil
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((profile) => {
            const proto = PROTOCOLS.find(p => p.value === profile.protocol);
            const ProtoIcon = proto?.icon || Code;
            return (
              <div key={profile.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <ProtoIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{profile.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      {profile.protocol} — {profile.target_host}:{profile.target_port}
                    </p>
                    {profile.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">{profile.description}</p>
                    )}
                  </div>
                </div>
                {canWrite && (
                  <button onClick={() => deleteMutation.mutate(profile.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5" title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateProfileModal isOpen={showCreate} onClose={() => setShowCreate(false)} projectId={currentProject.id} />
    </div>
  );
}
