/**
 * ScenarioDatasetSection — Section "Datasets & Bundles" intégrée dans chaque scénario.
 * Affiche la compatibilité par environnement et les bundles disponibles.
 * Utilise tRPC directement (plus de DatasetStorageAdapter).
 */
import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useProject } from '../state/projectStore';
import type { TestScenario, TargetEnv, ScenarioDatasetValidation } from '../types';
import {
  Package, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronRight,
} from 'lucide-react';

const ALL_ENVS: TargetEnv[] = ['DEV', 'PREPROD', 'PILOT_ORANGE', 'PROD'];

const ENV_META: Record<TargetEnv, { label: string; bgClass: string; textClass: string; borderClass: string }> = {
  DEV:          { label: 'DEV',          bgClass: 'bg-sky-500/10',    textClass: 'text-sky-400',    borderClass: 'border-sky-500/20' },
  PREPROD:      { label: 'PREPROD',      bgClass: 'bg-violet-500/10', textClass: 'text-violet-400', borderClass: 'border-violet-500/20' },
  PILOT_ORANGE: { label: 'PILOT ORANGE', bgClass: 'bg-orange-500/10', textClass: 'text-orange-400', borderClass: 'border-orange-500/20' },
  PROD:         { label: 'PROD',         bgClass: 'bg-red-500/10',    textClass: 'text-red-400',    borderClass: 'border-red-500/20' },
};

interface Props {
  scenario: TestScenario;
}

export default function ScenarioDatasetSection({ scenario }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { currentProject } = useProject();
  const requiredTypes = scenario.required_dataset_types || [];

  // Charger les noms des dataset types via tRPC
  const { data: dtData } = trpc.datasetTypes.list.useQuery();
  const dtMap = useMemo(() => {
    if (!dtData?.data) return new Map<string, string>();
    return new Map(dtData.data.map((dt: any) => [dt.datasetTypeId, dt.name]));
  }, [dtData]);

  // Load instances per env to compute validation client-side
  // We query all instances for the project and compute compatibility
  const { data: instancesData } = trpc.datasetInstances.list.useQuery(
    { projectId: String(currentProject?.id || '') },
    { enabled: !!currentProject?.id && requiredTypes.length > 0 },
  );

  const { data: bundlesDataDev } = trpc.bundles.list.useQuery(
    { projectId: String(currentProject?.id || ''), env: 'DEV' as any },
    { enabled: !!currentProject?.id && requiredTypes.length > 0 },
  );
  const { data: bundlesDataPreprod } = trpc.bundles.list.useQuery(
    { projectId: String(currentProject?.id || ''), env: 'PREPROD' as any },
    { enabled: !!currentProject?.id && requiredTypes.length > 0 },
  );
  const { data: bundlesDataPilot } = trpc.bundles.list.useQuery(
    { projectId: String(currentProject?.id || ''), env: 'PILOT_ORANGE' as any },
    { enabled: !!currentProject?.id && requiredTypes.length > 0 },
  );
  const { data: bundlesDataProd } = trpc.bundles.list.useQuery(
    { projectId: String(currentProject?.id || ''), env: 'PROD' as any },
    { enabled: !!currentProject?.id && requiredTypes.length > 0 },
  );

  // Compute validation by env
  const envMap = useMemo(() => {
    const map = new Map<TargetEnv, ScenarioDatasetValidation>();
    if (requiredTypes.length === 0) return map;

    const instances = instancesData?.data || [];
    const bundlesByEnv: Record<TargetEnv, any[]> = {
      DEV: bundlesDataDev?.data || [],
      PREPROD: bundlesDataPreprod?.data || [],
      PILOT_ORANGE: bundlesDataPilot?.data || [],
      PROD: bundlesDataProd?.data || [],
    };

    for (const env of ALL_ENVS) {
      const envInstances = instances.filter((i: any) => i.env === env);
      const availableTypes = new Set(envInstances.map((i: any) => i.datasetTypeId));
      const missingTypes = requiredTypes.filter(t => !availableTypes.has(t));
      const bundles = bundlesByEnv[env];
      const compatibleBundles = bundles.map((b: any) => ({
        bundle_id: b.uid,
        name: b.name,
        version: b.version ?? 1,
        status: b.status || 'DRAFT',
      }));

      map.set(env, {
        ok_for_env: missingTypes.length === 0 && compatibleBundles.length > 0,
        compatible_bundles: compatibleBundles,
        missing_types_global: missingTypes,
      });
    }
    return map;
  }, [requiredTypes, instancesData, bundlesDataDev, bundlesDataPreprod, bundlesDataPilot, bundlesDataProd]);

  if (requiredTypes.length === 0) {
    return null; // Pas de dataset requis, ne rien afficher
  }

  const okCount = Array.from(envMap.values()).filter(v => v.ok_for_env).length;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Package className="w-3 h-3" />
        <span>Datasets : {okCount}/{ALL_ENVS.length} env prêts</span>
        {okCount === ALL_ENVS.length ? (
          <CheckCircle2 className="w-3 h-3 text-green-400" />
        ) : okCount > 0 ? (
          <AlertTriangle className="w-3 h-3 text-amber-400" />
        ) : (
          <XCircle className="w-3 h-3 text-red-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 pl-4 border-l-2 border-border" onClick={e => e.stopPropagation()}>
          {ALL_ENVS.map(env => {
            const validation = envMap.get(env);
            if (!validation) return null;
            const meta = ENV_META[env];

            return (
              <div key={env} className="rounded-md p-2.5 bg-secondary/10">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}>
                    {meta.label}
                  </span>
                  {validation.ok_for_env ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-green-400">
                      <CheckCircle2 className="w-3 h-3" /> {validation.compatible_bundles.length} bundle(s) compatible(s)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
                      <XCircle className="w-3 h-3" /> Aucun bundle complet
                    </span>
                  )}
                </div>

                {/* Bundles compatibles */}
                {validation.compatible_bundles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {validation.compatible_bundles.map(b => (
                      <span key={b.bundle_id}
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          b.status === 'ACTIVE'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                        {b.name} v{b.version} [{b.status}]
                      </span>
                    ))}
                  </div>
                )}

                {/* Types manquants */}
                {validation.missing_types_global.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-red-400/70">Manquants :</span>
                    {validation.missing_types_global.map(t => (
                      <span key={t} className="text-[10px] font-mono px-1 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        {dtMap.get(t) || t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
