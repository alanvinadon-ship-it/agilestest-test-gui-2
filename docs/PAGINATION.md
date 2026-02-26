# Standard de pagination — AgilesTest

**Version** : 2.0  
**Date** : 26 février 2026  
**Auteur** : Manus AI  

---

## 1. Décision architecturale

Le standard retenu est la **pagination par offset (page/pageSize)**. Ce choix est motivé par la simplicité d'implémentation, la compatibilité directe avec les composants UI de pagination classiques (numéros de page, "précédent/suivant"), et le fait que les volumes de données attendus dans AgilesTest restent compatibles avec cette approche.

> **Convention** : Tous les endpoints `list` volumineuses retournent un objet `{ items: T[], total: number, page: number, pageSize: number }` au lieu d'un tableau brut.

---

## 2. Contrat d'interface

### 2.1 Input (requête)

| Paramètre | Type | Défaut | Contraintes | Description |
|-----------|------|--------|-------------|-------------|
| `page` | `number` | `1` | `page ≥ 1` | Numéro de page (1-based) |
| `pageSize` | `number` | `25` | `1 ≤ pageSize ≤ 100` | Nombre d'éléments par page |
| `limit` | `number` | *(optionnel)* | `1 ≤ limit ≤ 100` | Legacy : alias de pageSize (prioritaire si fourni) |
| `offset` | `number` | *(optionnel)* | `offset ≥ 0` | Legacy : offset explicite (prioritaire si fourni) |
| `sortBy` | `string` | *(dépend du routeur)* | Whitelisté par routeur | Colonne de tri |
| `sortDir` | `"asc" \| "desc"` | `"desc"` | — | Direction du tri |

Les paramètres de pagination sont **optionnels** : si omis, les valeurs par défaut s'appliquent. Les paramètres spécifiques au routeur (ex : `projectId`, `status`, `dateFrom`, `dateTo`) sont fusionnés avec le schéma de pagination via `.merge(paginationInput)`.

### 2.2 Output (réponse)

```typescript
interface PaginatedResult<T> {
  items: T[];      // Éléments de la page courante (length ≤ pageSize)
  total: number;   // Nombre total d'éléments correspondant aux filtres
  page: number;    // Page courante
  pageSize: number; // Taille de page effective
}
```

Le champ `total` est **toujours présent** et correspond au `COUNT(*)` sur les mêmes filtres que la requête de données. Le frontend peut calculer le nombre total de pages : `Math.ceil(total / pageSize)`.

---

## 3. Helpers serveur (`server/pagination.ts`)

### 3.1 `paginationInput` (Zod schema)

Schéma Zod réutilisable à fusionner dans l'input de chaque procédure :

```typescript
import { paginationInput } from "../pagination";

list: viewerProcedure
  .input(z.object({ projectId: z.string() }).merge(paginationInput))
  .query(async ({ input }) => { ... })
```

### 3.2 `paginate<T>()` — Pagination SQL native (recommandé)

Pour les tables volumineuses, utilise directement les clauses SQL `LIMIT`, `OFFSET`, `ORDER BY` et un `COUNT(*)` séparé via Drizzle ORM :

```typescript
import { paginate } from "../pagination";

return paginate(
  db.select().from(executions).$dynamic(),
  executions,
  input,
  {
    allowedSortFields: ["createdAt", "status", "target_env"],
    defaultSort: { by: "createdAt", dir: "desc" },
    where: [eq(executions.projectId, input.projectId)],
  },
);
```

**Options :**

| Option | Type | Description |
|--------|------|-------------|
| `allowedSortFields` | `string[]` | Whitelist des champs de tri (anti SQL-injection) |
| `defaultSort` | `{ by: string; dir: "asc" \| "desc" }` | Tri par défaut si `sortBy` absent ou invalide |
| `where` | `SQL \| SQL[]` | Clauses WHERE (ANDées ensemble) |

### 3.3 `paginateInMemory<T>()` — Fallback mémoire

Pour les petits datasets ou comme pont de migration :

```typescript
import { paginateInMemory } from "../pagination";

const all = await adminDb.listProjectMemberships(input.projectId);
return paginateInMemory(all, input);
```

### 3.4 `dateRangeFilter()` — Filtres date

Génère des clauses `WHERE column >= dateFrom AND column <= dateTo` :

```typescript
import { dateRangeFilter } from "../pagination";

const where = [
  eq(auditLogs.actorId, input.actorId),
  ...dateRangeFilter(auditLogs.timestamp, input.dateFrom, input.dateTo),
];
```

---

## 4. Endpoints paginés

### 4.1 Endpoints SQL natif (`paginate()`) — Tables volumineuses

| Routeur | Endpoint | Filtres serveur | Tri par défaut |
|---------|----------|----------------|----------------|
| `executions` | `list` | `projectId`, `status`, `dateFrom`, `dateTo` | `createdAt` DESC |
| `executions` | `listJobs` | `executionId` | `createdAt` DESC |
| `executions` | `listArtifacts` | `executionId` | `createdAt` DESC |
| `executions` | `listIncidents` | `executionId`, `severity` | `createdAt` DESC |
| `captures` | `listJobs` | `projectId`, `status`, `dateFrom`, `dateTo` | `createdAt` DESC |
| `captures` | `listSessions` | `policyId`, `status` | `createdAt` DESC |
| `captures` | `listArtifacts` | `sessionId` | `createdAt` DESC |
| `admin` | `listAuditLogs` | `actorId`, `entityType`, `action`, `dateFrom`, `dateTo` | `timestamp` DESC |
| `admin` | `listInvites` | `status` | `createdAt` DESC |

### 4.2 Endpoints `paginateInMemory()` — Petits volumes

| Routeur | Endpoint | Filtres |
|---------|----------|---------|
| `projects` | `list` | — |
| `profiles` | `list` | `projectId` |
| `scenarios` | `list` | `projectId` |
| `datasets` | `listTypes` / `listInstances` / `listBundles` | `typeId`, `projectId` |
| `probes` | `list` / `listPolicies` | — |
| `captures` | `listPolicies` / `listSources` | `projectId` |
| `drivetest` | `listCampaigns` / `listJobs` / `listKpiSamples` / `listRoutes` / `listImports` / `listRunSummaries` | `projectId`, `campaignId`, `driveJobId` |
| `admin` | `listProjectMemberships` / `listUserMemberships` | `projectId`, `userId` |

---

## 5. Composant UI `<Pagination />`

Fichier : `client/src/components/Pagination.tsx`

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `page` | `number` | — | Page courante (1-based) |
| `pageSize` | `number` | — | Taille de page |
| `total` | `number` | — | Total d'éléments |
| `onPageChange` | `(page: number) => void` | — | Callback changement de page |
| `onPageSizeChange` | `(size: number) => void` | — | Callback changement de taille |
| `pageSizeOptions` | `number[]` | `[10, 25, 50, 100]` | Options du sélecteur de taille |
| `showPageSize` | `boolean` | `true` | Afficher le sélecteur de taille |
| `compact` | `boolean` | `false` | Mode compact (prev/next uniquement) |

### Fonctionnalités

Le composant affiche « X–Y sur Z résultats », un sélecteur de taille de page, des boutons première/précédente/numéros de page/suivante/dernière avec ellipses pour les grandes plages. Il se réinitialise automatiquement à la page 1 lors d'un changement de taille.

### Pages intégrées

| Page | Source de données | Filtres UI |
|------|-------------------|------------|
| **ExecutionsPage** | `trpc.executions.list` (SQL natif) | Statut, recherche texte |
| **CapturesPage** | `trpc.captures.listJobs` (SQL natif) | — |
| **AdminAuditPage** | `trpc.admin.listAuditLogs` (SQL natif) | Action, entité, acteur, plage de dates |

### Exemple d'intégration

```tsx
import Pagination from '../components/Pagination';

const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(25);

useEffect(() => { setPage(1); }, [statusFilter]);

const { data } = useQuery({
  queryKey: ['items', page, pageSize, statusFilter],
  queryFn: () => trpcVanilla.items.list.query({ page, pageSize, status: statusFilter }),
});

<Pagination
  page={page}
  pageSize={pageSize}
  total={data?.total ?? 0}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
/>
```

---

## 6. Index de base de données

Les index suivants optimisent les requêtes paginées triées par date :

| Table | Index | Colonne(s) |
|-------|-------|-----------|
| `executions` | `idx_exec_created_at` | `createdAt` |
| `execution_jobs` | `idx_ej_created_at` | `createdAt` |
| `capture_jobs` | `idx_cj_created_at` | `createdAt` |
| `capture_sessions` | `idx_cs_created_at` | `createdAt` |
| `capture_artifacts` | `idx_ca_created_at` | `createdAt` |
| `drive_jobs` | `idx_dj_created_at` | `createdAt` |
| `kpi_samples` | `idx_ks_created_at` | `createdAt` |
| `incidents` | `idx_inc_created_at` | `createdAt` |
| `audit_logs` | `idx_al_ts` | `timestamp` |

---

## 7. Tests

**28 tests de pagination** dans `server/pagination.test.ts` :

| Suite | Tests | Couverture |
|-------|-------|------------|
| `paginationInput schema` | 9 | Défauts page/pageSize, legacy limit/offset, bornes, rejet |
| `paginateInMemory` | 8 | Slicing par page, total, page vide, sort custom, legacy |
| `Router paginated list` | 11 | Shape `{ items, total }` sur 11 endpoints |

**Total : 105 tests passent** (6 fichiers, 0 échec, 0 erreur TypeScript).

---

## 8. Whitelist de tri (protection SQL injection)

Le champ `sortBy` est validé côté serveur contre une **whitelist** de colonnes autorisées. Si la valeur fournie par le client ne figure pas dans la whitelist, le tri par défaut est appliqué :

```typescript
const allowedFields = opts.allowedSortFields ?? [];
const sortField = input.sortBy && allowedFields.includes(input.sortBy)
  ? input.sortBy
  : defaultSort.by;
```

---

## 9. Migration guide

Pour ajouter la pagination à un nouvel endpoint :

1. **Routeur** : fusionner `paginationInput` dans l'input Zod
2. **Choisir le helper** : `paginate()` pour les tables volumineuses, `paginateInMemory()` pour les petits datasets
3. **Whitelist** : définir `allowedSortFields` pour éviter les injections SQL
4. **Frontend** : ajouter `page`/`pageSize` dans le state React, passer au query, afficher `<Pagination />`
5. **Test** : ajouter un test `assertPaginatedShape()` dans `pagination.test.ts`
6. **Index** : ajouter un index `createdAt` si la table est volumineuse
