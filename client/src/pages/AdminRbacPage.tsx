/**
 * AdminRbacPage — /admin/rbac
 * Matrice RBAC informative : rôles globaux + rôles projet × modules × permissions
 */
import { useState } from 'react';
import { ShieldCheck, Check, Minus, Info } from 'lucide-react';
import { RBAC_MATRIX, GLOBAL_ROLE_LABELS, PROJECT_ROLE_LABELS } from '../admin/types';
import type { Permission } from '../admin/types';

const PERM_COLORS: Record<Permission, string> = {
  READ: 'bg-blue-500/20 text-blue-400',
  CREATE: 'bg-green-500/20 text-green-400',
  UPDATE: 'bg-amber-500/20 text-amber-400',
  DELETE: 'bg-red-500/20 text-red-400',
  RUN: 'bg-purple-500/20 text-purple-400',
  ACTIVATE: 'bg-cyan-500/20 text-cyan-400',
  REPAIR: 'bg-orange-500/20 text-orange-400',
};

type ViewMode = 'global' | 'project';

export default function AdminRbacPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('global');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Matrice RBAC</h1>
            <p className="text-sm text-muted-foreground">Permissions par rôle et module (lecture seule)</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>Cette matrice est <strong className="text-foreground">informative</strong>. Les permissions sont appliquées côté serveur via les guards RBAC.</p>
          <p className="mt-1">Les <strong className="text-foreground">rôles globaux</strong> (Admin, Manager, Viewer) s'appliquent à toute la plateforme. Les <strong className="text-foreground">rôles projet</strong> sont spécifiques à chaque projet et s'ajoutent aux permissions globales.</p>
        </div>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 bg-secondary/30 rounded-md p-1 w-fit">
        <button
          onClick={() => setViewMode('global')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'global' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Rôles globaux
        </button>
        <button
          onClick={() => setViewMode('project')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'project' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Rôles projet
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(PERM_COLORS).map(([perm, cls]) => (
          <span key={perm} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${cls}`}>
            {perm}
          </span>
        ))}
      </div>

      {/* Matrix table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider min-w-[160px]">
                  Module
                </th>
                {viewMode === 'global' ? (
                  <>
                    <th className="text-center px-4 py-3 text-xs font-mono font-medium text-red-400 uppercase tracking-wider">
                      {GLOBAL_ROLE_LABELS.ADMIN}
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-mono font-medium text-amber-400 uppercase tracking-wider">
                      {GLOBAL_ROLE_LABELS.MANAGER}
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-mono font-medium text-blue-400 uppercase tracking-wider">
                      {GLOBAL_ROLE_LABELS.VIEWER}
                    </th>
                  </>
                ) : (
                  <>
                    <th className="text-center px-4 py-3 text-xs font-mono font-medium text-red-400 uppercase tracking-wider">
                      {PROJECT_ROLE_LABELS.PROJECT_ADMIN}
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-mono font-medium text-amber-400 uppercase tracking-wider">
                      {PROJECT_ROLE_LABELS.PROJECT_EDITOR}
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-mono font-medium text-blue-400 uppercase tracking-wider">
                      {PROJECT_ROLE_LABELS.PROJECT_VIEWER}
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {RBAC_MATRIX.map(row => {
                const cols = viewMode === 'global'
                  ? [row.admin, row.manager, row.viewer]
                  : [row.project_admin, row.project_editor, row.project_viewer];

                return (
                  <tr key={row.module} className="border-b border-border last:border-0 hover:bg-secondary/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{row.module}</td>
                    {cols.map((perms, i) => (
                      <td key={i} className="px-4 py-3 text-center">
                        {perms.length === 0 ? (
                          <Minus className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        ) : (
                          <div className="flex flex-wrap justify-center gap-1">
                            {perms.map(p => (
                              <span key={p} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${PERM_COLORS[p]}`}>
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-heading font-semibold text-foreground">Règles de résolution</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <span>Le rôle <strong className="text-foreground">ADMIN global</strong> a accès à toutes les fonctionnalités, y compris l'administration.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <span>Les <strong className="text-foreground">rôles projet</strong> s'appliquent uniquement au projet concerné et ne donnent pas accès à l'administration.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <span>La permission effective est l'<strong className="text-foreground">union</strong> du rôle global et du rôle projet (le plus permissif l'emporte).</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <span>Un VIEWER global avec PROJECT_EDITOR sur un projet peut éditer les ressources de ce projet uniquement.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
