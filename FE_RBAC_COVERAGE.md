# FE_RBAC_COVERAGE — Couverture RBAC Frontend

> **Version** : 1.0.0  
> **Date** : 2026-02-18  
> **Auteur** : AgilesTest Team

## 1. Architecture

Le système RBAC frontend repose sur trois couches :

```
┌─────────────────────────────────────────────────────┐
│  PermissionKey (enum)                                │
│  45+ permissions atomiques organisées en 11 groupes  │
├─────────────────────────────────────────────────────┤
│  usePermission (hook)                                │
│  Résout user.role → permissions via hasPermission()  │
├─────────────────────────────────────────────────────┤
│  PermissionGate (composant)                          │
│  Mode hide | disable avec tooltip explicatif         │
├─────────────────────────────────────────────────────┤
│  ErrorState403 (composant)                           │
│  Page/section d'erreur standardisée avec trace_id    │
└─────────────────────────────────────────────────────┘
```

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/admin/permissions.ts` | Enum `PermissionKey`, `PERMISSION_GROUPS`, `ROLE_PERMISSIONS`, `hasPermission()` |
| `src/security/index.ts` | Barrel export du module security |
| `src/security/PermissionGate.tsx` | Composant déclaratif pour protéger des boutons/sections |
| `src/security/ErrorState403.tsx` | Composant d'erreur 403 standardisé |
| `src/security/permissionLabels.ts` | Labels humains pour chaque PermissionKey |
| `src/hooks/usePermission.ts` | Hook React `usePermission()` → `{ can, canAny, canAll, role }` |
| `src/components/RequireProjectAccess.tsx` | Guard route : vérifie membership projet |

---

## 2. Catalogue de permissions

### Groupes et clés

| Groupe | Permissions | Description |
|--------|-------------|-------------|
| **Projets** | `projects.read`, `.create`, `.update`, `.delete` | CRUD projets |
| **Profils** | `profiles.read`, `.create`, `.update`, `.delete` | CRUD profils de test |
| **Scénarios** | `scenarios.read`, `.create`, `.update`, `.delete`, `.finalize` | CRUD + finalisation scénarios |
| **Datasets** | `datasets.read`, `.create`, `.update`, `.delete`, `.clone` | CRUD + clone instances |
| **Bundles** | `bundles.read`, `.create`, `.update`, `.delete`, `.validate` | CRUD + validation bundles |
| **Scripts** | `scripts.read`, `.create`, `.activate`, `.delete` | CRUD + activation scripts IA |
| **Exécutions** | `executions.read`, `.run`, `.rerun`, `.cancel`, `.delete` | Lancement + gestion exécutions |
| **Drive Test** | `drive.campaigns.read`, `.create`, `.update`, `.delete` | CRUD campagnes drive |
| **Drive Reporting** | `drive.reporting.read` | Lecture rapports KPI |
| **Admin** | `admin.users`, `.roles`, `.audit`, `.settings` | Administration plateforme |
| **Secrets** | `secrets.read`, `.write` | Gestion des clés secrètes |

### Matrice rôle → permissions

| Permission | VIEWER | MANAGER | ADMIN |
|------------|--------|---------|-------|
| `*.read` | ✅ | ✅ | ✅ |
| `*.create` | ❌ | ✅ | ✅ |
| `*.update` | ❌ | ✅ | ✅ |
| `*.delete` | ❌ | ❌ | ✅ |
| `*.finalize` / `*.activate` | ❌ | ✅ | ✅ |
| `executions.run` / `.rerun` | ❌ | ✅ | ✅ |
| `executions.cancel` / `.delete` | ❌ | ❌ | ✅ |
| `admin.*` | ❌ | ❌ | ✅ |

---

## 3. Couverture par page

### Pages refactorées

| Page | Fichier | Permissions utilisées | canWrite éliminé |
|------|---------|----------------------|------------------|
| **Projets** | `ProjectsPage.tsx` | `PROJECTS_CREATE`, `PROJECTS_UPDATE`, `PROJECTS_DELETE` | ✅ |
| **Profils** | `ProfilesPage.tsx` | `PROFILES_CREATE`, `PROFILES_UPDATE`, `PROFILES_DELETE` | ✅ |
| **Scénarios** | `ScenariosPage.tsx` | `SCENARIOS_CREATE`, `SCENARIOS_UPDATE`, `SCENARIOS_DELETE`, `SCENARIOS_FINALIZE` | ✅ |
| **Datasets** | `DatasetsPage.tsx` | `DATASETS_CREATE`, `DATASETS_UPDATE`, `DATASETS_DELETE`, `DATASETS_CLONE` | ✅ |
| **Bundles** | `BundlesPage.tsx` | `BUNDLES_CREATE`, `BUNDLES_UPDATE`, `BUNDLES_DELETE`, `BUNDLES_VALIDATE` | ✅ |
| **Scripts** | `GeneratedScriptsPage.tsx` | `SCRIPTS_ACTIVATE`, `SCRIPTS_DELETE` | ✅ |
| **Run Center** | `ExecutionsPage.tsx` | `EXECUTIONS_RUN`, `EXECUTIONS_RERUN`, `SCRIPTS_ACTIVATE` | ✅ |
| **Détail Exécution** | `ExecutionDetailPage.tsx` | `EXECUTIONS_RERUN`, `SCRIPTS_CREATE` | ✅ |
| **Campagnes Drive** | `DriveCampaignsPage.tsx` | `DRIVE_CAMPAIGNS_CREATE`, `DRIVE_CAMPAIGNS_UPDATE`, `DRIVE_CAMPAIGNS_DELETE` | ✅ |
| **Captures** | `CapturesPage.tsx` | `EXECUTIONS_RUN` | ✅ |
| **Sondes** | `ProbesPage.tsx` | `EXECUTIONS_RUN` | ✅ |

### Guards de route

| Guard | Fichier | Protège |
|-------|---------|---------|
| `RequireAdmin` | `App.tsx` (inline) | Routes `/admin/*` — redirige si non-admin |
| `RequireProjectAccess` | `RequireProjectAccess.tsx` | Routes projet — vérifie membership active |

---

## 4. Pattern d'utilisation

### Hook usePermission

```tsx
import { usePermission, PermissionKey } from '@/security';

function MyComponent() {
  const { can, canAny, canAll, role } = usePermission();
  
  // Check unique
  const canCreate = can(PermissionKey.PROJECTS_CREATE);
  
  // Check multiple (OR)
  const canModify = canAny([PermissionKey.PROJECTS_UPDATE, PermissionKey.PROJECTS_DELETE]);
  
  // Check multiple (AND)
  const canManage = canAll([PermissionKey.PROJECTS_UPDATE, PermissionKey.PROJECTS_DELETE]);
  
  return canCreate ? <CreateButton /> : null;
}
```

### Composant PermissionGate

```tsx
import { PermissionGate, PermissionKey } from '@/security';

// Mode hide (défaut) — le bouton disparaît
<PermissionGate requires={PermissionKey.PROJECTS_DELETE}>
  <DeleteButton />
</PermissionGate>

// Mode disable — le bouton est grisé avec tooltip
<PermissionGate requires={PermissionKey.PROJECTS_DELETE} mode="disable">
  <DeleteButton />
</PermissionGate>
```

### ErrorState403

```tsx
import { ErrorState403 } from '@/security';

// Affiche une page d'erreur 403 standardisée
<ErrorState403 
  requiredPermission="projects.delete"
  message="Vous n'avez pas la permission de supprimer ce projet."
/>
```

---

## 5. Migration depuis canWrite

### Avant (legacy)

```tsx
const { canWrite } = useAuth();
// ...
{canWrite && <DeleteButton />}
```

### Après (granulaire)

```tsx
const { can } = usePermission();
const canDelete = can(PermissionKey.PROJECTS_DELETE);
// ...
{canDelete && <DeleteButton />}
```

### Règles de migration

1. **Identifier l'action** : quel type d'opération le bouton/section protège ?
2. **Mapper vers PermissionKey** : `canWrite` pour create → `*.CREATE`, pour update → `*.UPDATE`, pour delete → `*.DELETE`
3. **Remplacer** : `canWrite &&` → `canSpecificAction &&`
4. **Conserver `canWrite` déclaré** : les déclarations `const { canWrite } = useAuth()` restent pour compatibilité mais ne sont plus utilisées dans le JSX

---

## 6. Rôles custom

Les administrateurs peuvent créer des rôles personnalisés via `/admin/roles` avec un sous-ensemble de permissions. Ces rôles sont évalués par `hasPermission()` qui vérifie d'abord les rôles built-in (VIEWER/MANAGER/ADMIN) puis les rôles custom stockés dans `adminStore`.

---

## 7. Audit

Chaque action protégée par permission est tracée dans le journal d'audit (`/admin/audit`) avec :
- `actor` : email de l'utilisateur
- `action` : type d'action (create, update, delete, etc.)
- `entity_type` : type d'entité (user, role, invite, access)
- `entity_id` : identifiant de l'entité
- `metadata` : détails supplémentaires (JSON)
- `timestamp` : horodatage ISO

L'audit est exportable en CSV et JSON depuis la page `/admin/audit`.
