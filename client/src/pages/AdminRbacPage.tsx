/**
 * AdminRbacPage — /admin/rbac
 * Matrice RBAC dynamique : affiche les permissions réelles des rôles (système + custom)
 * depuis le catalogue permissions.ts
 */
import { useState, useMemo, Fragment } from 'react';
import { ShieldCheck, Check, Minus, Info, Lock, Unlock, Search } from 'lucide-react';
import {
  PERMISSION_GROUPS,
  getAllRoles,
  PermissionKey,
  type RoleDefinition,
} from '../admin/permissions';

type ViewScope = 'GLOBAL' | 'PROJECT' | 'ALL';

export default function AdminRbacPage() {
  const [scope, setScope] = useState<ViewScope>('GLOBAL');
  const [searchPerm, setSearchPerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const roles = useMemo(() => {
    void refreshKey;
    if (scope === 'ALL') return getAllRoles();
    return getAllRoles(scope);
  }, [scope, refreshKey]);

  const filteredGroups = useMemo(() => {
    if (!searchPerm.trim()) return PERMISSION_GROUPS;
    const q = searchPerm.toLowerCase();
    return PERMISSION_GROUPS
      .map(g => ({
        ...g,
        permissions: g.permissions.filter(
          p => p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.permissions.length > 0);
  }, [searchPerm]);

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
            <p className="text-sm text-muted-foreground">
              Permissions effectives par rôle — source : catalogue permissions.ts
            </p>
          </div>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
        >
          Rafraîchir
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Cette matrice reflète les <strong className="text-foreground">permissions réelles</strong> définies
            dans le catalogue. Les rôles <Lock className="w-3 h-3 inline text-amber-400" /> système ne sont pas modifiables.
            Les rôles <Unlock className="w-3 h-3 inline text-green-400" /> custom sont éditables depuis la page "Rôles & Permissions".
          </p>
          <p>
            Le rôle <strong className="text-foreground">ADMIN global</strong> possède un override total :
            toutes les permissions sont accordées indépendamment de la matrice.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-secondary/30 rounded-md p-1">
          {(['GLOBAL', 'PROJECT', 'ALL'] as ViewScope[]).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                scope === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'GLOBAL' ? 'Rôles globaux' : s === 'PROJECT' ? 'Rôles projet' : 'Tous'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filtrer permissions..."
            value={searchPerm}
            onChange={e => setSearchPerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{roles.length} rôle(s) affichés</span>
        <span className="text-border">|</span>
        <span>{filteredGroups.reduce((a, g) => a + g.permissions.length, 0)} permission(s)</span>
        <span className="text-border">|</span>
        <span>{filteredGroups.length} groupe(s)</span>
      </div>

      {/* Matrix */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider min-w-[200px] sticky left-0 bg-secondary/30 z-10">
                  Permission
                </th>
                {roles.map((role, roleIdx) => (
                  <th key={`role-header-${role.role_id}-${roleIdx}`} className="text-center px-3 py-3 min-w-[110px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xs font-mono font-medium ${
                        role.role_id === 'ADMIN' ? 'text-red-400' :
                        role.scope === 'GLOBAL' ? 'text-amber-400' : 'text-blue-400'
                      }`}>
                        {role.name}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        {role.is_system ? (
                          <Lock className="w-2.5 h-2.5 text-amber-400/60" />
                        ) : (
                          <Unlock className="w-2.5 h-2.5 text-green-400/60" />
                        )}
                        {role.scope}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group, groupIdx) => (
                <Fragment key={`group-${groupIdx}`}>
                  {/* Group header */}
                  <tr key={`grp-${group.id}`} className="bg-secondary/10">
                    <td
                      colSpan={roles.length + 1}
                      className="px-4 py-2 text-xs font-mono font-semibold text-primary uppercase tracking-wider sticky left-0 bg-secondary/10"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {/* Permission rows */}
                  {group.permissions.map(perm => (
                    <tr key={perm.key} className="border-b border-border/50 last:border-0 hover:bg-secondary/5 transition-colors">
                      <td className="px-4 py-2 sticky left-0 bg-card z-10">
                        <div>
                          <span className="text-xs font-medium text-foreground">{perm.label}</span>
                          <span className="block text-[10px] font-mono text-muted-foreground/60">{perm.key}</span>
                        </div>
                      </td>
                      {roles.map((role, roleIdx) => {
                        const has = role.role_id === 'ADMIN' || role.permissions.includes(perm.key);
                        const isAdminOverride = role.role_id === 'ADMIN';
                        return (
                          <td key={`cell-${perm.key}-${role.role_id}-${roleIdx}`} className="px-3 py-2 text-center">
                            {has ? (
                              <div className="flex justify-center">
                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
                                  isAdminOverride
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-green-500/20 text-green-400'
                                }`}>
                                  <Check className="w-3 h-3" />
                                </span>
                              </div>
                            ) : (
                              <Minus className="w-4 h-4 text-muted-foreground/20 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary per role */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role, roleIdx) => {
          const permCount = role.role_id === 'ADMIN'
            ? Object.values(PermissionKey).length
            : role.permissions.length;
          const totalPerms = Object.values(PermissionKey).length;
          const pct = Math.round((permCount / totalPerms) * 100);

          return (
            <div key={`role-summary-${role.role_id}-${roleIdx}`} className="p-4 bg-card border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {role.is_system ? (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-green-400" />
                  )}
                  <span className="text-sm font-heading font-semibold text-foreground">{role.name}</span>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                  role.scope === 'GLOBAL' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                }`}>
                  {role.scope}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{role.description}</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{permCount} / {totalPerms} permissions</span>
                  <span className="font-mono text-foreground">{pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-secondary/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct === 100 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : pct > 30 ? 'bg-blue-500' : 'bg-muted-foreground'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resolution rules */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-heading font-semibold text-foreground">Règles de résolution</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <span>Le rôle <strong className="text-foreground">ADMIN global</strong> a un override total : toutes les permissions sont accordées.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <span>Les <strong className="text-foreground">rôles projet</strong> s'appliquent uniquement au projet concerné via le membership.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <span>La permission effective est vérifiée par <code className="text-xs font-mono bg-secondary/50 px-1 rounded">hasPermission(user, key, &#123;projectId&#125;)</code>.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <span>Les rôles <Unlock className="w-3 h-3 inline text-green-400" /> custom sont créés depuis "Rôles & Permissions" et peuvent être assignés comme rôles projet.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
