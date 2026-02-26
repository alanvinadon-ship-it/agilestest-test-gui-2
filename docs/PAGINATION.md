# Standard de pagination — AgilesTest

**Version** : 1.0  
**Date** : 26 février 2026  
**Auteur** : Manus AI  

---

## 1. Décision architecturale

Le standard retenu est la **pagination par offset** (Option A). Ce choix est motivé par la simplicité d'implémentation, la compatibilité directe avec les composants UI de pagination classiques (numéros de page, "précédent/suivant"), et le fait que les volumes de données attendus dans AgilesTest restent compatibles avec cette approche (tables de l'ordre de dizaines de milliers de lignes, pas de millions).

> **Convention** : Tous les endpoints `list` volumineuses retournent un objet `{ items: T[], total: number }` au lieu d'un tableau brut.

---

## 2. Contrat d'interface

### 2.1 Input (requête)

| Paramètre | Type | Défaut | Contraintes | Description |
|-----------|------|--------|-------------|-------------|
| `limit` | `number` | `25` | `1 ≤ limit ≤ 100` | Nombre maximum d'éléments par page |
| `offset` | `number` | `0` | `offset ≥ 0` | Position de départ dans la liste |
| `sortBy` | `string` | *(dépend du routeur)* | Whitelisté par routeur | Colonne de tri |
| `sortDir` | `"asc" \| "desc"` | `"desc"` | — | Direction du tri |

Les paramètres de pagination sont **optionnels** : si omis, les valeurs par défaut s'appliquent. Les paramètres spécifiques au routeur (ex : `projectId`, `status`) sont fusionnés avec le schéma de pagination via `.merge(paginationInput)`.

### 2.2 Output (réponse)

```typescript
interface PaginatedResult<T> {
  items: T[];   // Éléments de la page courante (length ≤ limit)
  total: number; // Nombre total d'éléments correspondant aux filtres
}
```

Le champ `total` est **toujours présent** et correspond au `COUNT(*)` sur les mêmes filtres que la requête de données. Cela permet au frontend de calculer le nombre total de pages : `Math.ceil(total / limit)`.

---

## 3. Helpers serveur

Trois helpers centralisés sont définis dans `server/pagination.ts` :

### 3.1 `paginationInput` (Zod schema)

Schéma Zod réutilisable à fusionner dans l'input de chaque procédure :

```typescript
import { paginationInput } from "../pagination";

// Dans un routeur tRPC :
list: viewerProcedure
  .input(z.object({ projectId: z.string() }).merge(paginationInput))
  .query(async ({ input }) => { ... })
```

### 3.2 `paginate()` (pagination SQL native)

Pour les tables volumineuses, utilise directement les clauses SQL `LIMIT`, `OFFSET`, `ORDER BY` et un `COUNT(*)` séparé :

```typescript
import { paginate } from "../pagination";

const result = await paginate(
  db.select().from(executions).$dynamic(),
  executions,
  input,
  {
    allowedSortFields: ["createdAt", "status", "name"],
    defaultSort: { by: "createdAt", dir: "desc" },
    where: eq(executions.projectId, input.projectId),
  }
);
// result = { items: Execution[], total: number }
```

### 3.3 `paginateInMemory()` (pagination en mémoire)

Pour les petites collections ou comme pont de migration. Charge toutes les lignes puis découpe en mémoire :

```typescript
import { paginateInMemory } from "../pagination";

const all = await db.listAllItems(projectId);
return paginateInMemory(all, input, (a, b) => {
  return b.createdAt.getTime() - a.createdAt.getTime();
});
```

Cette approche est adaptée aux tables de faible volume (< 1 000 lignes). Pour les tables volumineuses, préférer `paginate()`.

---

## 4. Endpoints paginés

Le tableau ci-dessous recense tous les endpoints `list` qui retournent désormais un résultat paginé :

| Routeur | Endpoint | Filtres obligatoires | Tri par défaut | Méthode |
|---------|----------|---------------------|----------------|---------|
| `projects` | `list` | *(aucun)* | `createdAt desc` | `paginateInMemory` |
| `profiles` | `list` | `projectId` | `createdAt desc` | `paginateInMemory` |
| `scenarios` | `list` | `projectId` | `createdAt desc` | `paginateInMemory` |
| `datasets` | `listTypes` | *(aucun)* | `createdAt desc` | `paginateInMemory` |
| `datasets` | `listInstances` | `projectId` | `createdAt desc` | `paginateInMemory` |
| `datasets` | `listBundles` | `projectId` | `createdAt desc` | `paginateInMemory` |
| `executions` | `list` | `projectId` | `createdAt desc` | `paginateInMemory` |
| `executions` | `listJobs` | `executionId` | *(insertion)* | `paginateInMemory` |
| `executions` | `listArtifacts` | `executionId` | *(insertion)* | `paginateInMemory` |
| `executions` | `listIncidents` | `projectId` | `detectedAt desc` | `paginateInMemory` |
| `executions` | `listIncidentsByExecution` | `executionId` | *(insertion)* | `paginateInMemory` |
| `captures` | `listPolicies` | `projectId` | `createdAt desc` | `paginateInMemory` |
| `captures` | `listJobs` | `executionId` | `createdAt desc` | `paginateInMemory` |
| `captures` | `listSessions` | `policyId` | `createdAt desc` | `paginateInMemory` |
| `captures` | `listSessionsByExecution` | `executionId` | `createdAt desc` | `paginateInMemory` |
| `captures` | `listSources` | `captureId` | *(insertion)* | `paginateInMemory` |
| `captures` | `listArtifacts` | `sessionId` | *(insertion)* | `paginateInMemory` |
| `probes` | `list` | *(aucun)* | `createdAt desc` | `paginateInMemory` |
| `probes` | `listPolicies` | *(aucun)* | `createdAt desc` | `paginateInMemory` |
| `drivetest` | `listCampaigns` | `projectId` | `createdAt desc` | `paginateInMemory` |
| `drivetest` | `listJobs` | `campaignId` | `createdAt desc` | `paginateInMemory` |
| `drivetest` | `listKpiSamples` | `driveJobId` | `ts desc` | `paginateInMemory` |
| `drivetest` | `listRoutes` | `campaignId` | *(insertion)* | `paginateInMemory` |
| `drivetest` | `listImports` | `campaignId` | *(insertion)* | `paginateInMemory` |
| `drivetest` | `listRunSummaries` | `campaignId` | *(insertion)* | `paginateInMemory` |
| `admin` | `listAuditLogs` | *(optionnels : actorId, entityType, action)* | `createdAt desc` | `paginateInMemory` |
| `admin` | `listInvites` | *(aucun)* | `createdAt desc` | `paginateInMemory` |
| `admin` | `listMemberships` | *(aucun)* | *(insertion)* | `paginateInMemory` |

---

## 5. Whitelist de tri (protection contre l'injection SQL)

Le champ `sortBy` est validé côté serveur contre une **whitelist** de colonnes autorisées. Si la valeur fournie par le client ne figure pas dans la whitelist, le tri par défaut est appliqué. Cela empêche toute injection SQL via le paramètre de tri.

```typescript
// Exemple dans paginate()
const allowedFields = opts.allowedSortFields ?? [];
const sortField = input.sortBy && allowedFields.includes(input.sortBy)
  ? input.sortBy
  : defaultSort.by;
```

---

## 6. Index de base de données

Les index suivants ont été ajoutés pour optimiser les requêtes paginées triées par `createdAt` :

| Table | Index | Colonne(s) |
|-------|-------|-----------|
| `executions` | `idx_exec_created` | `created_at` |
| `capture_jobs` | `idx_cj_created` | `created_at` |
| `capture_sessions` | `idx_csess_created` | `created_at` |
| `capture_sessions` | `idx_csess_status` | `status` |
| `drive_jobs` | `idx_dj_created` | `created_at` |
| `drive_campaigns` | `idx_dc_created` | `created_at` |
| `probes` | `idx_probes_created` | `created_at` |
| `datasets` | `idx_datasets_created` | `created_at` |
| `test_scenarios` | `idx_scenarios_created` | `created_at` |
| `test_profiles` | `idx_profiles_created` | `created_at` |

Ces index s'ajoutent aux index existants sur `projectId`, `status`, et autres colonnes de filtrage.

---

## 7. Intégration frontend

### 7.1 Hooks React

Chaque hook de requête (`useProjectQueries`, `useExecutionQueries`, `useCaptureQueries`, etc.) a été mis à jour pour :

1. Accepter les paramètres de pagination (`limit`, `offset`) dans l'input du `useQuery`.
2. Extraire `.items` du résultat paginé pour la compatibilité avec les composants existants.
3. Exposer `total` pour permettre l'affichage du nombre total d'éléments et le calcul des pages.

```typescript
// Exemple d'utilisation dans un composant
const { data, isLoading } = trpc.executions.list.useQuery({
  projectId: currentProject.uid,
  limit: 25,
  offset: page * 25,
});

const items = data?.items ?? [];
const total = data?.total ?? 0;
const totalPages = Math.ceil(total / 25);
```

### 7.2 Couche de compatibilité

Les fichiers `localStoreTrpc.ts`, `repositoryApiTrpc.ts` et `datasetTrpcAdapter.ts` utilisent une fonction `extractItems()` qui extrait automatiquement le tableau `.items` d'un résultat paginé, assurant la rétrocompatibilité avec le code existant qui attend un tableau brut.

---

## 8. Tests

Les tests de pagination sont regroupés dans `server/pagination.test.ts` et couvrent :

| Catégorie | Tests | Description |
|-----------|-------|-------------|
| Schema Zod | 6 | Valeurs par défaut, bornes `limit`/`offset`, `sortDir` invalide |
| `paginateInMemory` | 8 | `items ≤ limit`, `total` correct, offset hors bornes, tri custom, tableau vide, dernière page |
| Intégration routeurs | 10 | Chaque endpoint `list` retourne `{ items, total }` avec `items.length ≤ limit` |

Tous les tests existants (101 au total) ont été mis à jour pour le nouveau format paginé et passent avec succès.

---

## 9. Migration et rétrocompatibilité

La migration a été effectuée de manière **non-breaking** :

1. Les paramètres de pagination sont **optionnels** avec des valeurs par défaut (`limit: 25`, `offset: 0`).
2. Les hooks frontend extraient `.items` et exposent `total` en parallèle.
3. Les fichiers de compatibilité (`localStoreTrpc.ts`, etc.) gèrent automatiquement le nouveau format.

Les anciens appels sans paramètres de pagination continuent de fonctionner grâce aux valeurs par défaut Zod.

---

## 10. Recommandations pour les futurs endpoints

Tout nouveau endpoint `list` doit :

1. Fusionner `paginationInput` dans son schéma d'input.
2. Retourner un `PaginatedResult<T>`.
3. Utiliser `paginate()` pour les tables volumineuses ou `paginateInMemory()` pour les petites collections.
4. Déclarer une whitelist de tri explicite.
5. Ajouter un index `createdAt` (ou sur la colonne de tri par défaut) si la table est volumineuse.
6. Ajouter un test vérifiant la forme `{ items, total }` dans `pagination.test.ts`.
