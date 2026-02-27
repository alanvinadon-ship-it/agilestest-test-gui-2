import { useState, useRef, useCallback } from 'react';
import { useProject } from '../state/projectStore';
import { useProjects } from '../hooks/useProjectQueries';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Download, Upload, FileJson, Loader2, CheckCircle2,
  AlertCircle, ChevronDown, FolderKanban, ArrowRight,
  Package, FileText, Settings2, Database, Code2,
} from 'lucide-react';

// ─── Export Section ─────────────────────────────────────────────────────────

function ExportSection() {
  const { currentProject } = useProject();
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!currentProject) {
      toast.error('Sélectionnez un projet pour exporter.');
      return;
    }
    setExporting(true);
    try {
      const response = await fetch(
        `/api/trpc/projects.exportProject?input=${encodeURIComponent(JSON.stringify({ projectId: currentProject.id }))}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Export échoué');
      const json = await response.json();
      const exportData = json.result?.data;
      if (!exportData) throw new Error('Données d\'export vides');

      // Download as JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = currentProject.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      a.download = `agilestest-export-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export terminé ! Le fichier JSON a été téléchargé.');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de l\'export.');
    } finally {
      setExporting(false);
    }
  }, [currentProject]);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-heading font-semibold text-foreground">Exporter le projet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Téléchargez l'intégralité du projet actif sous forme de fichier JSON portable.
            Inclut les profils, scénarios, datasets, bundles et scripts générés.
          </p>

          {currentProject ? (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-2 text-sm">
                <FolderKanban className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">{currentProject.name}</span>
                <span className="text-xs text-muted-foreground">({currentProject.domain})</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {exporting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Export en cours...</>
                ) : (
                  <><Download className="w-4 h-4" /> Exporter en JSON</>
                )}
              </button>
            </div>
          ) : (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">
                Sélectionnez un projet dans le sélecteur de la barre latérale pour pouvoir l'exporter.
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { icon: Settings2, label: 'Profils de test' },
              { icon: FileText, label: 'Scénarios' },
              { icon: Database, label: 'Dataset Instances' },
              { icon: Package, label: 'Bundles' },
              { icon: Code2, label: 'Scripts générés' },
              { icon: FileJson, label: 'Types de datasets' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Import Section ─────────────────────────────────────────────────────────

interface ImportPreview {
  version: string;
  exportedAt: string;
  project: { name: string; description?: string; domain: string; status: string };
  profiles: any[];
  scenarios: any[];
  datasetTypes: any[];
  datasetInstances: any[];
  bundles: any[];
  scripts: any[];
}

function ImportSection() {
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects({ limit: 100 });
  const importMutation = trpc.projects.importProject.useMutation();
  const utils = trpc.useUtils();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [importMode, setImportMode] = useState<'new' | 'existing'>('new');
  const [targetProjectId, setTargetProjectId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ projectId: string; success: boolean } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setImportResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data?.version || !data?.project) {
          setParseError('Format de fichier invalide. Assurez-vous d\'utiliser un export AgilesTest.');
          setPreview(null);
          return;
        }
        setPreview(data);
      } catch {
        setParseError('Erreur de parsing JSON. Le fichier est peut-être corrompu.');
        setPreview(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(async () => {
    if (!preview) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importMutation.mutateAsync({
        data: preview,
        targetProjectId: importMode === 'existing' ? targetProjectId : undefined,
      });
      setImportResult(result);
      utils.projects.list.invalidate();
      toast.success('Import terminé avec succès !');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de l\'import.');
    } finally {
      setImporting(false);
    }
  }, [preview, importMode, targetProjectId, importMutation, utils]);

  const resetImport = useCallback(() => {
    setPreview(null);
    setFileName('');
    setImportResult(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Upload className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-heading font-semibold text-foreground">Importer un projet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Chargez un fichier JSON exporté depuis AgilesTest pour créer un nouveau projet
            ou fusionner les données dans un projet existant.
          </p>

          {/* File Upload */}
          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            {!preview && !parseError && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-8 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer flex flex-col items-center gap-3"
              >
                <FileJson className="w-8 h-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Cliquez pour sélectionner un fichier JSON</p>
                  <p className="text-xs text-muted-foreground mt-1">Format: agilestest-export-*.json</p>
                </div>
              </button>
            )}

            {parseError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-destructive font-medium">{parseError}</p>
                  <button onClick={resetImport} className="text-xs text-destructive/80 hover:text-destructive underline mt-2">
                    Réessayer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview && !importResult && (
            <div className="mt-4 space-y-4">
              <div className="bg-secondary/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{fileName}</span>
                  </div>
                  <button onClick={resetImport} className="text-xs text-muted-foreground hover:text-foreground">
                    Changer de fichier
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Projet source</p>
                    <p className="text-sm font-medium text-foreground">{preview.project.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Domaine</p>
                    <p className="text-sm text-foreground">{preview.project.domain}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Version export</p>
                    <p className="text-sm text-foreground">v{preview.version}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date d'export</p>
                    <p className="text-sm text-foreground">
                      {preview.exportedAt ? new Date(preview.exportedAt).toLocaleDateString('fr-FR') : '—'}
                    </p>
                  </div>
                </div>

                {/* Counts */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { label: 'Profils', count: preview.profiles?.length || 0, icon: Settings2 },
                    { label: 'Scénarios', count: preview.scenarios?.length || 0, icon: FileText },
                    { label: 'Datasets', count: preview.datasetInstances?.length || 0, icon: Database },
                    { label: 'Bundles', count: preview.bundles?.length || 0, icon: Package },
                    { label: 'Scripts', count: preview.scripts?.length || 0, icon: Code2 },
                  ].map(({ label, count, icon: Icon }) => (
                    <span key={label} className="inline-flex items-center gap-1.5 bg-background border border-border rounded-md px-2 py-1 text-xs">
                      <Icon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-foreground font-medium">{count}</span>
                      <span className="text-muted-foreground">{label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Import Mode */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Destination</p>
                <div className="flex gap-3">
                  <label className={`flex-1 cursor-pointer rounded-lg border p-3 transition-colors ${importMode === 'new' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="new"
                      checked={importMode === 'new'}
                      onChange={() => setImportMode('new')}
                      className="sr-only"
                    />
                    <p className="text-sm font-medium text-foreground">Nouveau projet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Crée un nouveau projet "{preview.project.name} (import)"
                    </p>
                  </label>
                  <label className={`flex-1 cursor-pointer rounded-lg border p-3 transition-colors ${importMode === 'existing' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="existing"
                      checked={importMode === 'existing'}
                      onChange={() => setImportMode('existing')}
                      className="sr-only"
                    />
                    <p className="text-sm font-medium text-foreground">Projet existant</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fusionne dans un projet déjà créé
                    </p>
                  </label>
                </div>

                {importMode === 'existing' && (
                  <div className="mt-3 relative">
                    <select
                      value={targetProjectId}
                      onChange={(e) => setTargetProjectId(e.target.value)}
                      className="w-full rounded-md border border-input px-3 py-2 text-sm text-foreground bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30"
                    >
                      <option value="">— Sélectionnez un projet —</option>
                      {(projectsData?.data || []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Import Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={resetImport}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || (importMode === 'existing' && !targetProjectId)}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {importing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Import en cours...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Lancer l'import</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">Import réussi !</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Le projet a été importé avec succès. Les profils, scénarios, datasets, bundles et scripts
                    ont été créés avec de nouveaux identifiants.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={resetImport}
                      className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                    >
                      Importer un autre fichier
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ImportExportPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Import / Export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transférez vos projets entre environnements AgilesTest via des fichiers JSON portables.
        </p>
      </div>

      <ExportSection />
      <ImportSection />

      {/* Format Documentation */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Format d'export</h3>
        <div className="text-xs text-muted-foreground space-y-2">
          <p>
            Le fichier JSON exporté suit le format <code className="bg-secondary px-1 py-0.5 rounded text-foreground">agilestest-project-v1.0</code> et contient :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Métadonnées du projet (nom, domaine, description)</li>
            <li>Profils de test avec configuration complète</li>
            <li>Scénarios avec étapes et types de datasets requis</li>
            <li>Instances de datasets avec valeurs</li>
            <li>Bundles avec leurs items liés</li>
            <li>Scripts générés (code, framework, version)</li>
          </ul>
          <p className="mt-2">
            Lors de l'import, tous les identifiants (UID) sont régénérés pour éviter les conflits.
            Les relations entre entités (profil → scénario, instance → bundle) sont préservées.
          </p>
        </div>
      </div>
    </div>
  );
}
