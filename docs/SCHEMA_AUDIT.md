# Schema Audit — Drizzle ORM vs MySQL Database

**Date :** 27 février 2026  
**Auteur :** Manus AI  
**Statut :** Complété — 0 erreur TypeScript, 596 tests verts

---

## 1. Contexte

L'application AgilesTest utilise **Drizzle ORM** pour mapper les tables MySQL vers des objets TypeScript. Au fil des itérations de développement, des incohérences se sont accumulées entre les définitions Drizzle (`drizzle/schema.ts`) et les colonnes réelles en base de données. Cet audit systématique a été mené pour identifier et corriger toutes les divergences.

## 2. Méthodologie

L'audit a procédé en trois étapes :

1. **Extraction des colonnes DB** via `SHOW COLUMNS FROM` sur les 57 tables MySQL existantes.
2. **Extraction des colonnes Drizzle** par parsing du fichier `drizzle/schema.ts` (noms SQL entre guillemets dans les appels `varchar()`, `int()`, `timestamp()`, etc.).
3. **Comparaison automatisée** via script Python pour détecter les colonnes présentes en DB mais absentes du schéma Drizzle, et vice-versa.

## 3. Résultats de l'audit

### 3.1 Tables corrigées

| Table | Problème | Correction appliquée |
|-------|----------|---------------------|
| `invites` | Colonnes Drizzle en camelCase (`inviteRole`, `inviteStatus`, `invitedBy`, `invitedByName`, `expiresAt`, `acceptedAt`, `createdAt`) ne correspondaient pas aux noms DB snake_case | Remappé vers `invite_role`, `invite_status`, `invited_by`, `invited_by_name`, `expires_at`, `accepted_at`, `created_at`. Ajouté champ `uid`. |
| `incidents` | Colonnes Drizzle en camelCase (`createdBy`, `createdAt`, `updatedAt`) + 7 colonnes manquantes | Réécrit complet : `execution_id`, `project_id`, `title`, `description`, `severity`, `step_name`, `expected_result`, `actual_result`, `detected_at` |
| `drive_run_summaries` | Colonnes `uid`, `orgId`, `createdAt` inexistantes en DB | Supprimé `uid`, `orgId`, `createdAt` du schéma. Table DB ne contient que : `id`, `drive_job_id`, `campaign_id`, `total_samples`, `duration_sec`, `distance_km`, `kpi_averages`, `kpi_min`, `kpi_max`, `threshold_violations`, `overall_pass` |
| `kpi_samples` | Colonnes `orgId`, `createdAt` inexistantes en DB | Supprimé `orgId` et `createdAt` du schéma. |
| `users` | Colonnes `full_name`, `status`, `password_hash` non mappées | Ajouté `fullName` → `full_name`, `status` → `status`, `passwordHash` → `password_hash` |

### 3.2 Fichiers de routeurs corrigés

| Fichier | Correction |
|---------|-----------|
| `server/routers/kpiData.ts` | Supprimé références à `driveRunSummaries.uid`, `.createdAt`, `.orgId`. Pagination par `id` au lieu de `uid`. Supprimé `orgId` du `bulkInsert` de `kpiSamples`. |
| `server/jobQueue.ts` (ligne 421) | Converti `executionId` (number) en `String(executionId)` pour correspondre au type `varchar` de `incidents.executionId`. |
| `server/kpiData.test.ts` | Supprimé assertion `expect(cols).toContain("uid")` pour `driveRunSummaries`. |

### 3.3 Table manquante créée

| Table | Action |
|-------|--------|
| `captures` | Table référencée dans le schéma Drizzle et le routeur `capturesRouter` mais absente de la DB. Créée via `CREATE TABLE` avec les colonnes : `id`, `projectId`, `executionId`, `name`, `captureType`, `status`, `targetType`, `config`, `startedAt`, `finishedAt`, `createdBy`, `createdAt`, `updatedAt`. |

### 3.4 Tables DB sans schéma Drizzle (par design)

Vingt tables existent en DB mais ne sont pas déclarées dans `drizzle/schema.ts`. Certaines sont gérées via SQL brut (`sql.raw`), d'autres sont des tables héritées ou de système :

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

## 4. Résultat final

| Métrique | Valeur |
|----------|--------|
| Erreurs TypeScript | **0** |
| Tests Vitest | **596 passés, 0 échoué** |
| Tables Drizzle | **37** (toutes alignées avec la DB) |
| Tables DB totales | **57** (dont 20 sans schéma Drizzle, par design) |
| Fichiers modifiés | 5 (`schema.ts`, `kpiData.ts`, `jobQueue.ts`, `kpiData.test.ts`, DB `captures` créée) |

## 5. Recommandations

1. **Ajouter les schémas Drizzle** pour les 20 tables restantes au fur et à mesure de leur intégration dans le code TypeScript, en remplacement du SQL brut.
2. **Vérification CI** : ajouter un script de validation automatique qui compare les colonnes DB avec le schéma Drizzle à chaque PR, pour prévenir toute dérive future.
3. **Convention de nommage** : maintenir strictement le pattern `snake_case` pour les noms de colonnes SQL dans les nouvelles tables. Les tables héritées (`users`, `jobs`, `reports`, `captures`, `ai_analyses`, `probe_alert_state`) conservent le `camelCase` en DB pour éviter des migrations destructives.
4. **Migration `captures`** : la table a été créée manuellement via SQL. Envisager de l'inclure dans les migrations Drizzle lors du prochain `db:push` propre.
