# RBAC Server — Architecture et Matrice d'Accès

**Version** : 1.0.0  
**Date** : 26 février 2026  
**Auteur** : Manus AI  

---

## 1. Vue d'ensemble

Le système RBAC (Role-Based Access Control) d'AgilesTest implémente un contrôle d'accès **serveur strict** sur toutes les procédures tRPC. Chaque requête est interceptée par des middlewares composables qui vérifient l'authentification, le rôle applicatif, les permissions granulaires et l'appartenance aux projets (multi-tenant).

Le principe fondamental est **"ne jamais faire confiance au client"** : toutes les vérifications sont effectuées côté serveur avant l'exécution de la logique métier. Les tentatives d'accès refusées sont systématiquement journalisées dans la table `audit_logs`.

---

## 2. Modèle de rôles

### 2.1 Rôles applicatifs

Les rôles applicatifs définissent le niveau d'accès global d'un utilisateur dans la plateforme. Ils sont résolus à partir de la table `user_roles` → `roles`, avec un fallback sur le champ `users.role` pour la compatibilité.

| Rôle | Niveau | Description | Fallback DB |
|------|--------|-------------|-------------|
| **ORG_ADMIN** | 4 (max) | Administrateur de l'organisation. Accès complet à toutes les ressources, gestion des utilisateurs, rôles et permissions. | `users.role = 'admin'` |
| **QA_MANAGER** | 3 | Responsable qualité. Crée et configure les projets, profils, scénarios, datasets. Peut lire les audit logs. | — |
| **SECURITY_ANALYST** | 2 | Analyste sécurité. Accès en lecture à toutes les ressources. Peut créer des findings VSR et valider des remédiations. | — |
| **TEST_ENGINEER** | 1 | Ingénieur de test. Peut lancer des exécutions, pousser des résultats, créer des sondes et ajouter des artefacts. | — |
| **VIEWER** | 0 (min) | Observateur. Accès en lecture seule à toutes les ressources accessibles. | Rôle par défaut si aucun rôle assigné |

La hiérarchie est **cumulative vers le haut** : un `QA_MANAGER` peut faire tout ce qu'un `TEST_ENGINEER` peut faire, plus ses propres permissions.

### 2.2 Rôles projet (multi-tenant)

Les rôles projet définissent le niveau d'accès d'un utilisateur au sein d'un projet spécifique, via la table `project_memberships`.

| Rôle projet | Niveau | Description |
|-------------|--------|-------------|
| **PROJECT_ADMIN** | 2 | Administrateur du projet. Peut modifier les paramètres et gérer les membres. |
| **PROJECT_EDITOR** | 1 | Éditeur. Peut créer et modifier les ressources du projet. |
| **PROJECT_VIEWER** | 0 | Lecteur. Accès en lecture seule aux ressources du projet. |

> **Règle multi-tenant** : un `ORG_ADMIN` contourne automatiquement les vérifications de membership projet et obtient `PROJECT_ADMIN` sur tous les projets.

### 2.3 Résolution des rôles

La résolution des rôles suit cet algorithme :

1. Interroger la table `user_roles` → joindre `roles` pour obtenir les noms de rôles
2. Si `users.role === 'admin'` et `ORG_ADMIN` n'est pas déjà dans la liste → ajouter `ORG_ADMIN`
3. Si aucun rôle trouvé → attribuer `VIEWER` par défaut
4. Le **rôle effectif** est le rôle de plus haut niveau dans la hiérarchie

Un cache en mémoire (TTL 60 secondes) évite les requêtes DB répétitives. Le cache est invalidé automatiquement lors des changements de rôle via `invalidateRoleCache()`.

---

## 3. Middlewares tRPC

### 3.1 Architecture des middlewares

Les middlewares sont composables et s'enchaînent dans l'ordre suivant :

```
requireAuth → requireRole → requireProjectAccess → auditMutation
```

Chaque middleware enrichit le contexte tRPC (`ctx.rbac`) avec les informations RBAC résolues.

### 3.2 Middlewares disponibles

| Middleware | Rôle | Contexte injecté |
|-----------|------|-----------------|
| `requireAuth` | Vérifie que l'utilisateur est authentifié. Résout les rôles applicatifs. | `ctx.rbac: RbacContext` |
| `requireRole(...roles)` | Vérifie que l'utilisateur possède au moins un des rôles listés. | — |
| `requirePermission(...perms)` | Vérifie les permissions granulaires (module.action). ORG_ADMIN bypass. | — |
| `requireProjectAccess(minRole)` | Vérifie l'appartenance au projet cible (multi-tenant strict). | `ctx.rbac: ProjectRbacContext` |
| `auditMutation(action, entity)` | Journalise la mutation après exécution réussie. | — |

### 3.3 Procédures pré-composées

Pour simplifier l'utilisation, des procédures pré-composées sont exportées :

```typescript
// server/rbac/middleware.ts
export const authedProcedure     = t.procedure.use(requireAuth);
export const orgAdminProcedure   = authedProcedure.use(requireRole("ORG_ADMIN"));
export const qaManagerProcedure  = authedProcedure.use(requireRole("ORG_ADMIN", "QA_MANAGER"));
export const testEngineerProcedure = authedProcedure.use(requireRole("ORG_ADMIN", "QA_MANAGER", "TEST_ENGINEER"));
export const securityAnalystProcedure = authedProcedure.use(requireRole("ORG_ADMIN", "SECURITY_ANALYST"));
export const viewerProcedure     = authedProcedure.use(requireRole("ORG_ADMIN", "QA_MANAGER", "TEST_ENGINEER", "SECURITY_ANALYST", "VIEWER"));
```

### 3.4 Codes d'erreur

| Code | Message | Signification |
|------|---------|---------------|
| `10001` | Authentication required | Utilisateur non authentifié |
| `10002` | Insufficient role | Rôle applicatif insuffisant |
| `10003` | Missing permissions | Permissions granulaires manquantes |
| `10004` | Access denied to project | Pas de membership pour ce projet |
| `10005` | Insufficient project role | Rôle projet insuffisant |

---

## 4. Matrice Rôles × Actions

### 4.1 Module Projects

| Action | VIEWER | TEST_ENGINEER | SECURITY_ANALYST | QA_MANAGER | ORG_ADMIN |
|--------|:------:|:-------------:|:----------------:|:----------:|:---------:|
| list | ✅ | ✅ | ✅ | ✅ | ✅ |
| getByUid | ✅ | ✅ | ✅ | ✅ | ✅ |
| create | ❌ | ❌ | ❌ | ✅ | ✅ |
| update | ❌ | ❌ | ❌ | ✅ | ✅ |
| delete | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.2 Module Profiles

| Action | VIEWER | TEST_ENGINEER | SECURITY_ANALYST | QA_MANAGER | ORG_ADMIN |
|--------|:------:|:-------------:|:----------------:|:----------:|:---------:|
| list | ✅ | ✅ | ✅ | ✅ | ✅ |
| getByUid | ✅ | ✅ | ✅ | ✅ | ✅ |
| create | ❌ | ❌ | ❌ | ✅ | ✅ |
| update | ❌ | ❌ | ❌ | ✅ | ✅ |
| delete | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.3 Module Scenarios

| Action | VIEWER | TEST_ENGINEER | SECURITY_ANALYST | QA_MANAGER | ORG_ADMIN |
|--------|:------:|:-------------:|:----------------:|:----------:|:---------:|
| list | ✅ | ✅ | ✅ | ✅ | ✅ |
| getByUid | ✅ | ✅ | ✅ | ✅ | ✅ |
| create | ❌ | ❌ | ❌ | ✅ | ✅ |
| update | ❌ | ❌ | ❌ | ✅ | ✅ |
| delete | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.4 Module Executions

| Action | VIEWER | TEST_ENGINEER | SECURITY_ANALYST | QA_MANAGER | ORG_ADMIN |
|--------|:------:|:-------------:|:----------------:|:----------:|:---------:|
| list | ✅ | ✅ | ✅ | ✅ | ✅ |
| getByUid | ✅ | ✅ | ✅ | ✅ | ✅ |
| create | ❌ | ✅ | ❌ | ✅ | ✅ |
| update | ❌ | ✅ | ❌ | ✅ | ✅ |
| delete | ❌ | ❌ | ❌ | ❌ | ✅ |
| addArtifact | ❌ | ✅ | ❌ | ✅ | ✅ |
| addIncident | ❌ | ✅ | ❌ | ✅ | ✅ |

### 4.5 Module Datasets

| Action | VIEWER | TEST_ENGINEER | SECURITY_ANALYST | QA_MANAGER | ORG_ADMIN |
|--------|:------:|:-------------:|:----------------:|:----------:|:---------:|
| listTypes | ✅ | ✅ | ✅ | ✅ | ✅ |
| listInstances | ✅ | ✅ | ✅ | ✅ | ✅ |
| createType | ❌ | ❌ | ❌ | ✅ | ✅ |
| createInstance | ❌ | ❌ | ❌ | ✅ | ✅ |
| updateInstance | ❌ | ❌ | ❌ | ✅ | ✅ |
| deleteInstance | ❌ | ❌ | ❌ | ❌ | ✅ |
| listBundles | ✅ | ✅ | ✅ | ✅ | ✅ |
| createBundle | ❌ | ❌ | ❌ | ✅ | ✅ |
| deleteBundle | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.6 Module Captures

| Action | VIEWER | TEST_ENGINEER | SECURITY_ANALYST | QA_MANAGER | ORG_ADMIN |
|--------|:------:|:-------------:|:----------------:|:----------:|:---------:|
| listSources | ✅ | ✅ | ✅ | ✅ | ✅ |
| createSource | ❌ | ✅ | ❌ | ✅ | ✅ |
| deleteSource | ❌ | ❌ | ❌ | ❌ | ✅ |
| listPolicies | ✅ | ✅ | ✅ | ✅ | ✅ |
| createPolicy | ❌ | ❌ | ❌ | ✅ | ✅ |
| deletePolicy | ❌ | ❌ | ❌ | ❌ | ✅ |
| listSessions | ✅ | ✅ | ✅ | ✅ | ✅ |
| createSession | ❌ | ✅ | ❌ | ✅ | ✅ |

### 4.7 Module Probes

| Action | VIEWER | TEST_ENGINEER | SECURITY_ANALYST | QA_MANAGER | ORG_ADMIN |
|--------|:------:|:-------------:|:----------------:|:----------:|:---------:|
| list | ✅ | ✅ | ✅ | ✅ | ✅ |
| getByUid | ✅ | ✅ | ✅ | ✅ | ✅ |
| create | ❌ | ❌ | ❌ | ✅ | ✅ |
| update | ❌ | ❌ | ❌ | ✅ | ✅ |
| delete | ❌ | ❌ | ❌ | ❌ | ✅ |
| heartbeat | ❌ | ✅ | ❌ | ✅ | ✅ |

### 4.8 Module Drive Test

| Action | VIEWER | TEST_ENGINEER | SECURITY_ANALYST | QA_MANAGER | ORG_ADMIN |
|--------|:------:|:-------------:|:----------------:|:----------:|:---------:|
| listCampaigns | ✅ | ✅ | ✅ | ✅ | ✅ |
| createCampaign | ❌ | ❌ | ❌ | ✅ | ✅ |
| updateCampaign | ❌ | ❌ | ❌ | ✅ | ✅ |
| deleteCampaign | ❌ | ❌ | ❌ | ❌ | ✅ |
| listJobs | ✅ | ✅ | ✅ | ✅ | ✅ |
| createJob | ❌ | ✅ | ❌ | ✅ | ✅ |
| updateJob | ❌ | ✅ | ❌ | ✅ | ✅ |
| insertKpiSamples | ❌ | ✅ | ❌ | ✅ | ✅ |
| upsertRunSummary | ❌ | ✅ | ❌ | ✅ | ✅ |
| createImport | ❌ | ✅ | ❌ | ✅ | ✅ |
| listRoutes | ✅ | ✅ | ✅ | ✅ | ✅ |
| createRoute | ❌ | ❌ | ❌ | ✅ | ✅ |
| deleteRoute | ❌ | ❌ | ❌ | ❌ | ✅ |
| listDevices | ✅ | ✅ | ✅ | ✅ | ✅ |
| createDevice | ❌ | ❌ | ❌ | ✅ | ✅ |
| deleteDevice | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.9 Module Admin

| Action | VIEWER | TEST_ENGINEER | SECURITY_ANALYST | QA_MANAGER | ORG_ADMIN |
|--------|:------:|:-------------:|:----------------:|:----------:|:---------:|
| listInvites | ❌ | ❌ | ❌ | ❌ | ✅ |
| createInvite | ❌ | ❌ | ❌ | ❌ | ✅ |
| revokeInvite | ❌ | ❌ | ❌ | ❌ | ✅ |
| listProjectMemberships | ❌ | ❌ | ❌ | ✅ | ✅ |
| createMembership | ❌ | ❌ | ❌ | ❌ | ✅ |
| deleteMembership | ❌ | ❌ | ❌ | ❌ | ✅ |
| listRoles | ❌ | ❌ | ❌ | ✅ | ✅ |
| createRole | ❌ | ❌ | ❌ | ❌ | ✅ |
| updateRole | ❌ | ❌ | ❌ | ❌ | ✅ |
| deleteRole | ❌ | ❌ | ❌ | ❌ | ✅ |
| listPermissions | ❌ | ❌ | ❌ | ✅ | ✅ |
| createPermission | ❌ | ❌ | ❌ | ❌ | ✅ |
| addPermissionToRole | ❌ | ❌ | ❌ | ❌ | ✅ |
| removePermissionFromRole | ❌ | ❌ | ❌ | ❌ | ✅ |
| getUserRoles | ❌ | ❌ | ❌ | ✅ | ✅ |
| addRoleToUser | ❌ | ❌ | ❌ | ❌ | ✅ |
| removeRoleFromUser | ❌ | ❌ | ❌ | ❌ | ✅ |
| listAuditLogs | ❌ | ❌ | ❌ | ✅ | ✅ |
| createAuditLog | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 5. Audit automatique

### 5.1 Mutations réussies

Chaque mutation protégée par `auditMutation(action, entityType)` génère automatiquement une entrée dans `audit_logs` après exécution réussie :

```json
{
  "actorId": "user-open-id",
  "actorName": "Jean Dupont",
  "actorEmail": "jean@agilestest.io",
  "action": "CREATE",
  "entityType": "project",
  "entityId": "proj-abc123",
  "targetLabel": "Mon Projet IMS",
  "metadata": { "input": { "name": "Mon Projet IMS", "domain": "TELECOM_IMS" } }
}
```

### 5.2 Accès refusés

Chaque tentative d'accès refusée par `requireRole` ou `requireProjectAccess` génère une entrée `ACCESS_DENIED` :

```json
{
  "actorId": "user-open-id",
  "action": "ACCESS_DENIED",
  "entityType": "rbac",
  "targetLabel": "requireRole — Required roles: [ORG_ADMIN], user has: [VIEWER]",
  "metadata": {
    "attemptedAction": "requireRole",
    "reason": "Required roles: [ORG_ADMIN], user has: [VIEWER]"
  }
}
```

### 5.3 Consultation des logs

Les audit logs sont consultables par les `QA_MANAGER` et `ORG_ADMIN` via l'endpoint `admin.listAuditLogs` avec filtres optionnels :

```typescript
const logs = await trpc.admin.listAuditLogs.useQuery({
  actorId: "user-id",       // Filtrer par acteur
  entityType: "project",    // Filtrer par type d'entité
  action: "DELETE",          // Filtrer par action
  limit: 50,                 // Limiter le nombre de résultats
});
```

---

## 6. Multi-tenant (Isolation projet)

### 6.1 Principe

Le middleware `requireProjectAccess(minProjectRole)` assure l'isolation multi-tenant en vérifiant que l'utilisateur est membre du projet cible avant d'autoriser l'accès. Le `projectId` est extrait automatiquement de l'input de la procédure.

### 6.2 Règles d'accès projet

1. **ORG_ADMIN** : bypass automatique → `PROJECT_ADMIN` sur tous les projets
2. **Autres rôles** : doivent avoir une entrée dans `project_memberships` avec un rôle projet ≥ `minProjectRole`
3. **Pas de membership** → `FORBIDDEN` avec code `10004`
4. **Rôle projet insuffisant** → `FORBIDDEN` avec code `10005`

### 6.3 Endpoints protégés par projet

Les endpoints suivants vérifient l'accès projet en plus du rôle applicatif :

| Endpoint | Rôle projet minimum |
|----------|-------------------|
| `projects.list` | `PROJECT_VIEWER` |
| `profiles.list`, `profiles.create` | `PROJECT_VIEWER` / `PROJECT_EDITOR` |
| `scenarios.list`, `scenarios.create` | `PROJECT_VIEWER` / `PROJECT_EDITOR` |
| `datasets.listInstances`, `datasets.createInstance` | `PROJECT_VIEWER` / `PROJECT_EDITOR` |
| `drivetest.listCampaigns`, `drivetest.createCampaign` | `PROJECT_VIEWER` / `PROJECT_EDITOR` |
| `drivetest.listDevices`, `drivetest.createDevice` | `PROJECT_VIEWER` / `PROJECT_EDITOR` |

---

## 7. Tests

### 7.1 Couverture

Le fichier `server/rbac.test.ts` contient **31 tests** répartis en 8 suites :

| Suite | Tests | Description |
|-------|-------|-------------|
| Unauthenticated access | 3 | Vérifie le blocage des accès non authentifiés |
| VIEWER restrictions | 6 | Vérifie la lecture seule et le blocage des mutations |
| TEST_ENGINEER restrictions | 5 | Vérifie l'accès exécution et le blocage admin |
| SECURITY_ANALYST restrictions | 3 | Vérifie l'accès restreint spécifique |
| QA_MANAGER permissions | 6 | Vérifie la création de ressources et le blocage admin |
| ORG_ADMIN full access | 4 | Vérifie l'accès complet |
| Privilege escalation | 3 | Vérifie l'impossibilité d'auto-promotion |
| Audit logging | 1 | Vérifie la journalisation des mutations |

### 7.2 Test harness

Le test harness utilise `appRouter.createCaller(ctx)` avec un contexte simulé. La fonction `seedUserWithRole(roleName, userId)` crée les rôles dans la DB via un caller ORG_ADMIN et les assigne à l'utilisateur de test, puis invalide le cache pour garantir la résolution immédiate.

```typescript
// Exemple d'utilisation dans un test
const viewerId = `viewer-${Date.now()}`;
await seedUserWithRole("VIEWER", viewerId);

const ctx = createCtx({ openId: viewerId });
const caller = createCaller(ctx);

// Ce test doit échouer avec FORBIDDEN
await expect(
  caller.projects.delete({ uid: "some-project" })
).rejects.toThrow(/10002|Insufficient role/);
```

---

## 8. Guide d'implémentation

### 8.1 Ajouter un nouveau endpoint protégé

```typescript
import { qaManagerProcedure, auditMutation, requireProjectAccess } from "../rbac/middleware";

export const myRouter = router({
  // Lecture : VIEWER minimum
  listItems: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => db.listItems(input.projectId)),

  // Création : QA_MANAGER minimum + audit + accès projet
  createItem: qaManagerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "item"))
    .input(z.object({ projectId: z.string(), name: z.string() }))
    .mutation(({ input }) => db.createItem(input)),

  // Suppression : ORG_ADMIN uniquement + audit
  deleteItem: orgAdminProcedure
    .use(auditMutation("DELETE", "item"))
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => db.deleteItem(input.uid)),
});
```

### 8.2 Assigner un rôle à un utilisateur

```sql
-- Via SQL direct
INSERT INTO user_roles (uid, user_id, role_id)
VALUES (UUID(), 'user-open-id', (SELECT uid FROM roles WHERE name = 'QA_MANAGER'));
```

Ou via l'API admin (ORG_ADMIN uniquement) :

```typescript
await trpc.admin.addRoleToUser.mutate({
  userId: "user-open-id",
  roleId: "role-uid",
});
```

### 8.3 Créer un rôle personnalisé

```typescript
// 1. Créer le rôle
const role = await trpc.admin.createRole.mutate({
  name: "CUSTOM_ROLE",
  description: "Rôle personnalisé pour le module X",
  scope: "PROJECT",
});

// 2. Créer une permission
const perm = await trpc.admin.createPermission.mutate({
  module: "module_x",
  action: "execute",
  description: "Peut exécuter les actions du module X",
});

// 3. Associer la permission au rôle
await trpc.admin.addPermissionToRole.mutate({
  roleId: role.uid,
  permissionId: perm.uid,
});
```

---

## 9. Fichiers clés

| Fichier | Description |
|---------|-------------|
| `server/rbac/middleware.ts` | Middlewares RBAC, résolution des rôles, audit, procédures composées |
| `server/routers/admin.ts` | Endpoints admin (invites, memberships, rôles, permissions, audit logs) |
| `server/rbac.test.ts` | 31 tests Vitest couvrant tous les rôles et scénarios d'accès |
| `drizzle/schema.ts` | Tables RBAC : `roles`, `permissions`, `role_permissions`, `user_roles`, `project_memberships`, `audit_logs` |
| `server/db/admin.ts` | Helpers DB pour les opérations RBAC |
