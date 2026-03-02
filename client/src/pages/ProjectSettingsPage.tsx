import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Save, Shield, RotateCcw, CheckCircle } from 'lucide-react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { PermissionKey } from '../admin/permissions';
import { CapturePolicyEditor } from '../capture/CapturePolicyEditor';
import type { CapturePolicy } from '../capture/types';
import { DEFAULT_CAPTURE_POLICY } from '../capture/types';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function ProjectSettingsPage() {
  const { currentProject } = useProject();
  const { can } = usePermission();
  const canEdit = can(PermissionKey.PROJECTS_UPDATE);

  const [capturePolicy, setCapturePolicy] = useState<CapturePolicy | null>(null);
  const [saved, setSaved] = useState(false);

  // Charger la policy du projet via tRPC
  const { data: policyData } = trpc.capturePolicies.getByScope.useQuery(
    { scope: 'project', scopeId: currentProject?.id || '' },
    { enabled: !!currentProject }
  );
  const utils = trpc.useUtils();
  const upsertPolicy = trpc.capturePolicies.upsert.useMutation({
    onSuccess: () => utils.capturePolicies.getByScope.invalidate({ scope: 'project', scopeId: currentProject?.id || '' }),
  });
  const removePolicy = trpc.capturePolicies.remove.useMutation({
    onSuccess: () => utils.capturePolicies.getByScope.invalidate({ scope: 'project', scopeId: currentProject?.id || '' }),
  });

  useEffect(() => {
    if (policyData?.policyJson) {
      setCapturePolicy(policyData.policyJson as unknown as CapturePolicy);
    } else {
      setCapturePolicy(null);
    }
  }, [policyData]);

  const handleSave = async () => {
    if (!currentProject) return;
    const policyToSave = capturePolicy || { ...DEFAULT_CAPTURE_POLICY };
    await upsertPolicy.mutateAsync({ scope: 'project', scopeId: currentProject.id, policyJson: policyToSave as any });
    setSaved(true);
    toast.success('Paramètres du projet sauvegardés');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    if (!currentProject) return;
    await removePolicy.mutateAsync({ scope: 'project', scopeId: currentProject.id });
    setCapturePolicy(null);
    toast.info('Politique de capture réinitialisée aux valeurs par défaut');
  };

  if (!currentProject) {
    return (
      <div className="p-6 text-muted-foreground text-sm">
        Sélectionnez un projet pour accéder aux paramètres.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            Paramètres du projet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentProject.name} — Configuration par défaut
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!canEdit || !capturePolicy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser
          </button>
          <button
            onClick={handleSave}
            disabled={!canEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Sauvegardé' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Section Capture Policy */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-orange-500" />
          <h2 className="font-semibold">Politique de capture par défaut</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Cette politique s'applique à toutes les campagnes et scénarios du projet, sauf si un override est défini au niveau campagne, scénario ou run.
          La résolution suit la cascade : <strong>Run Override → Scénario → Campagne → Projet</strong>.
        </p>
        <CapturePolicyEditor
          value={capturePolicy}
          onChange={setCapturePolicy}
          scopeLabel="Projet"
          readOnly={!canEdit}
        />
      </div>

      {/* Info cascade */}
      <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold">Résolution en cascade</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>1. <strong>Projet</strong> — Définit le mode par défaut (cette page)</p>
          <p>2. <strong>Campagne</strong> — Override optionnel dans l'onglet Campagne Drive</p>
          <p>3. <strong>Scénario</strong> — Override optionnel dans l'éditeur de scénario</p>
          <p>4. <strong>Run</strong> — Override admin uniquement, au moment du lancement</p>
          <p className="mt-2 text-orange-400">Le premier override non-NONE trouvé en remontant la cascade est utilisé.</p>
        </div>
      </div>
    </div>
  );
}
