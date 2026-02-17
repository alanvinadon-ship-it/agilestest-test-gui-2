import { useState, useRef } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryApi } from '../api/repositoryApi';
import type { Dataset } from '../types';
import {
  Plus, Database, Loader2, Trash2, Upload, FileSpreadsheet,
  FileJson, FileCode, Download, Search
} from 'lucide-react';

const formatIcons: Record<string, typeof FileSpreadsheet> = {
  CSV: FileSpreadsheet,
  JSON: FileJson,
  YAML: FileCode,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function DatasetsPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['datasets', currentProject?.id],
    queryFn: () => repositoryApi.listDatasets(currentProject!.id),
    enabled: !!currentProject,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name.replace(/\.[^.]+$/, ''));
      return repositoryApi.createDataset(currentProject!.id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', currentProject?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repositoryApi.deleteDataset(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['datasets', currentProject?.id] }),
  });

  const datasets = (data?.data || []) as Dataset[];
  const filtered = search
    ? datasets.filter(d => d.name?.toLowerCase().includes(search.toLowerCase()))
    : datasets;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = '';
    }
  };

  if (!currentProject) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Aucun projet sélectionné</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez un projet pour gérer ses jeux de données.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Jeux de données</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importez des fichiers CSV, JSON ou YAML pour alimenter vos scénarios de test.
          </p>
        </div>
        {canWrite && (
          <>
            <button onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {uploadMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Upload...</>
              ) : (
                <><Upload className="w-4 h-4" /> Importer un fichier</>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.json,.yaml,.yml" onChange={handleFileChange} className="hidden" />
          </>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un dataset..."
          className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucun jeu de données</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Importez un fichier CSV, JSON ou YAML pour commencer.
          </p>
          {canWrite && (
            <button onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Upload className="w-4 h-4" /> Importer
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Nom</th>
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Format</th>
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Lignes</th>
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Taille</th>
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-right px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ds) => {
                const FormatIcon = formatIcons[ds.format] || FileCode;
                return (
                  <tr key={ds.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FormatIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{ds.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">{ds.format}</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground font-mono">{ds.row_count?.toLocaleString() || '—'}</td>
                    <td className="px-5 py-3 text-muted-foreground font-mono">{formatBytes(ds.size_bytes || 0)}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(ds.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {ds.storage_url && (
                          <a href={ds.storage_url} target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary p-1" title="Télécharger">
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        {canWrite && (
                          <button onClick={() => deleteMutation.mutate(ds.id)}
                            className="text-muted-foreground hover:text-destructive p-1" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
