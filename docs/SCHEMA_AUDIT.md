# Schema Audit — Drizzle ORM vs MySQL Database

**Date :** 27 février 2026  
**Auteur :** Manus AI  
**Statut :** Complété — 0 erreur TypeScript, 601 tests verts, script CI opérationnel

---

## 1. Contexte

L'application AgilesTest utilise **Drizzle ORM** pour mapper les tables MySQL vers des objets TypeScript. Au fil des itérations de développement, des incohérences se sont accumulées entre les définitions Drizzle (`drizzle/schema.ts`) et les colonnes réelles en base de données. Un audit systématique a été mené, suivi de la création d'un **script CI automatisé** pour prévenir toute dérive future.

## 2. Script d'audit automatisé

### 2.1 Exécution en local

```bash
# Depuis la racine du projet
pnpm audit:schema
```

Le script utilise la variable d'environnement `DATABASE_URL` pour se connecter à la base de données. En développement local, cette variable est automatiquement injectée par le serveur Manus.

### 2.2 Mode JSON

```bash
pnpm audit:schema --json
```

Produit une sortie JSON structurée au lieu du rapport formaté, utile pour l'intégration dans des pipelines ou pour comparer les résultats entre exécutions.

### 2.3 Exit codes

| Code | Signification |
|------|---------------|
| `0`  | Aucune divergence bloquante — le schéma Drizzle est aligné avec la DB |
| `1`  | Au moins une **erreur** détectée — le schéma Drizzle diverge de la DB |

### 2.4 Niveaux de sévérité

Le script distingue deux niveaux de sévérité :

**ERREUR (bloquant, exit code 1)** — Le schéma Drizzle définit quelque chose qui n'existe pas dans la DB, ou un type/nullabilité incompatible :

- `Column "table.col" defined in Drizzle but missing from database` — La colonne est dans le schéma Drizzle mais n'existe pas dans la table MySQL. Soit la migration n'a pas été exécutée, soit la colonne a été supprimée manuellement.
- `Type mismatch on "table.col": Drizzle=varchar, DB=enum(...)` — Le type Drizzle ne correspond pas au type MySQL. Corriger le schéma Drizzle ou migrer la DB.
- `Nullability mismatch on "table.col": Drizzle=NOT NULL, DB=NULLABLE` — Le schéma Drizzle est plus strict que la DB. Risque d'erreur à l'insertion si la DB contient des NULL.

**AVERTISSEMENT (non bloquant, exit code 0)** — Divergences tolérables mais à surveiller :

- `Column "table.col" exists in database but not in Drizzle schema` — La colonne existe en DB mais n'est pas déclarée dans Drizzle. Acceptable si la colonne est gérée par du SQL brut.
- `Column "table.col" is NULLABLE in Drizzle but NOT NULL in database` — Le schéma Drizzle est plus permissif. Pas de risque d'erreur runtime, mais le typage TypeScript sera moins précis.

### 2.5 Mapping de types

Le script applique un mapping tolérant entre les types MySQL et Drizzle :

| Type MySQL | Types Drizzle acceptés |
|------------|----------------------|
| `int(11)` | `int`, `integer`, `serial` |
| `bigint(20)` | `bigint`, `serial` |
| `varchar(N)` | `varchar` |
| `text`, `longtext`, `mediumtext` | `text` |
| `json` | `json` |
| `timestamp` | `timestamp`, `datetime` |
| `datetime` | `datetime`, `timestamp` |
| `tinyint(1)` | `boolean`, `tinyint` |
| `double` | `double`, `float`, `real`, `decimal` |
| `float` | `float`, `double`, `real`, `decimal` |
| `decimal(M,D)` | `decimal`, `float`, `double` |
| `enum(...)` | `enum` |

## 3. Intégration CI

Le workflow GitHub Actions `.github/workflows/ci-schema-audit.yml` exécute automatiquement l'audit sur chaque PR et push vers `main` qui touche les fichiers `drizzle/`, `server/`, `scripts/` ou `package.json`.

### 3.1 Secrets GitHub requis

| Secret | Description | Requis par |
|--------|-------------|------------|
| `DATABASE_URL` | URL de connexion MySQL/TiDB | `schema-audit`, `tests` |
| `JWT_SECRET` | Secret de signature JWT | `tests` |
| `VITE_APP_ID` | ID application OAuth | `tests` |
| `OAUTH_SERVER_URL` | URL backend OAuth | `tests` |
| `VITE_OAUTH_PORTAL_URL` | URL portail login | `tests` |
| `BUILT_IN_FORGE_API_URL` | URL API Forge | `tests` |
| `BUILT_IN_FORGE_API_KEY` | Clé API Forge | `tests` |

### 3.2 Pipeline

```
schema-audit ──→ tests
                      (séquentiel : tests ne s'exécutent que si l'audit passe)
typecheck ────────→
                      (parallèle : s'exécute indépendamment)
```

## 4. Architecture du script

```
scripts/
├── audit-schema.mjs           # Script principal (Node.js ESM)
└── _extract-drizzle-schema.ts  # Helper TypeScript pour extraire les métadonnées Drizzle
```

Le script principal (`audit-schema.mjs`) :
1. Se connecte à la DB via `mysql2/promise` avec SSL activé
2. Extrait les colonnes réelles depuis `information_schema.columns`
3. Lance le helper TypeScript via `npx tsx` pour extraire les métadonnées Drizzle
4. Compare les deux sources et génère le rapport

Le helper TypeScript (`_extract-drizzle-schema.ts`) :
1. Importe toutes les tables exportées depuis `drizzle/schema.ts`
2. Utilise `getTableConfig()` de Drizzle pour introspecter les colonnes
3. Produit un JSON normalisé sur stdout

## 5. Résolution des problèmes courants

### "Column defined in Drizzle but missing from database"

1. Vérifier que la migration a été exécutée : `pnpm db:push`
2. Si la colonne a été ajoutée intentionnellement dans Drizzle, exécuter la migration
3. Si la colonne a été supprimée de la DB, retirer la définition du schéma Drizzle

### "Type mismatch"

1. Vérifier le type réel en DB : `SHOW COLUMNS FROM table_name`
2. Corriger le type dans `drizzle/schema.ts` pour correspondre à la DB
3. Si le type DB doit changer, créer une migration appropriée

### "Nullability mismatch"

1. Si Drizzle dit `NOT NULL` mais la DB est `NULLABLE` : ajouter `.notNull()` en DB via migration, ou retirer `.notNull()` du schéma Drizzle
2. Si Drizzle est `NULLABLE` mais la DB est `NOT NULL` : ajouter `.notNull()` au schéma Drizzle

## 6. Historique de l'audit initial

### 6.1 Tables corrigées

| Table | Problème | Correction appliquée |
|-------|----------|---------------------|
| `invites` | Colonnes Drizzle en camelCase ne correspondaient pas aux noms DB snake_case | Remappé vers `invite_role`, `invite_status`, `invited_by`, `invited_by_name`, `expires_at`, `accepted_at`, `created_at`. Ajouté champ `uid`. |
| `incidents` | Colonnes Drizzle en camelCase + 7 colonnes manquantes | Réécrit complet : `execution_id`, `project_id`, `title`, `description`, `severity`, `step_name`, `expected_result`, `actual_result`, `detected_at` |
| `drive_run_summaries` | Colonnes `uid`, `orgId`, `createdAt` inexistantes en DB | Supprimé `uid`, `orgId`, `createdAt` du schéma |
| `kpi_samples` | Colonnes `orgId`, `createdAt` inexistantes en DB | Supprimé `orgId` et `createdAt` du schéma |
| `users` | Colonnes `full_name`, `status`, `password_hash` non mappées | Ajouté `fullName`, `status`, `passwordHash` |
| `probes` | Types `type`, `status`, `uptime`, `health_status` incorrects | Corrigé vers `enum`, `enum`, `double`, `enum` |
| `capture_policies` | Colonnes `scope`, `scope_id`, `policy_json` inexistantes en DB | Réécrit avec colonnes réelles : `project_id`, `name`, `capture_mode`, etc. |
| `audit_logs` | `uid`, `entity_type` nullable mais NOT NULL en DB | Ajouté `.notNull()` |

### 6.2 Fichiers de routeurs corrigés

| Fichier | Correction |
|---------|-----------|
| `server/routers/kpiData.ts` | Supprimé références à colonnes inexistantes. Converti `timestamp` string → Date. |
| `server/jobQueue.ts` | Converti `executionId` (number) en `String(executionId)` pour type `varchar`. |
| `server/routers/capturePolicies.ts` | Réécrit pour correspondre aux colonnes DB réelles avec compatibilité legacy. |
| `server/routers/testing.ts` | Corrigé `zone` de nullable à notNull avec valeur par défaut. |
| `server/lib/auditLog.ts` | Corrigé `entity` de nullable à notNull avec valeur par défaut "SYSTEM". |

### 6.3 Tables DB sans schéma Drizzle (par design)

Vingt tables existent en DB mais ne sont pas déclarées dans `drizzle/schema.ts`. Certaines sont gérées via SQL brut, d'autres sont des tables héritées ou de système :

| Catégorie | Tables |
|-----------|--------|
| **Webhooks** (SQL brut) | `outbound_webhooks`, `webhook_deliveries` |
| **Notifications** (SQL brut) | `notification_delivery_logs`, `notification_rules`, `notification_settings`, `notification_templates` |
| **RBAC** (non utilisé activement) | `roles`, `permissions`, `role_permissions`, `user_roles` |
| **Captures avancées** | `capture_jobs`, `capture_sessions`, `capture_sources`, `capture_artifacts` |
| **Drive** | `drive_imports`, `drive_probe_configs` |
| **Probes** | `probe_policies` |
| **Divers** | `analyses`, `runner_jobs`, `test_devices` |

> **Note :** Ces tables ne causent pas d'erreur TypeScript car elles sont soit accédées via SQL brut, soit non référencées dans le code applicatif actuel. L'ajout de schémas Drizzle pour ces tables est recommandé lors de leur intégration future.

## 7. Résultat final

| Métrique | Valeur |
|----------|--------|
| Erreurs TypeScript | **0** |
| Tests Vitest | **601 passés, 0 échoué** |
| Tables Drizzle | **37** (toutes alignées avec la DB) |
| Tables DB totales | **58** (dont 21 sans schéma Drizzle, par design) |
| Script CI | **audit-schema.mjs** — exit 0 en local, exit 1 sur divergence |
| Workflow GitHub Actions | **ci-schema-audit.yml** — schema-audit → tests + typecheck |
