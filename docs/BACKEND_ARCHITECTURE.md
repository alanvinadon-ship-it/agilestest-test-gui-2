# Architecture Backend — AgilesTest v0.2

> Ce document décrit l'architecture backend complète de la plateforme AgilesTest après la migration du stockage localStorage vers une base de données relationnelle MySQL/TiDB avec des procédures tRPC typées de bout en bout.

**Date de mise à jour :** 26 février 2026  
**Version :** 0.2.0  
**Auteur :** Manus AI

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Pile technologique](#2-pile-technologique)
3. [Schéma de base de données](#3-schéma-de-base-de-données)
4. [Routeurs tRPC](#4-routeurs-trpc)
5. [Helpers de base de données](#5-helpers-de-base-de-données)
6. [Migration frontend](#6-migration-frontend)
7. [Authentification](#7-authentification)
8. [Tests](#8-tests)
9. [Conventions et bonnes pratiques](#9-conventions-et-bonnes-pratiques)

---

## 1. Vue d'ensemble

La plateforme AgilesTest est une console de test cloud conçue pour les opérateurs télécoms (pilote Orange CIV). Elle couvre l'ensemble du cycle de test : création de projets, définition de profils et scénarios, gestion de jeux de données, exécution de tests automatisés, collecte de captures réseau (PCAP/logs), gestion de sondes distribuées, campagnes de drive test terrain, et administration RBAC.

L'architecture suit le pattern **Build Loop** du template tRPC :

```
drizzle/schema.ts  →  server/db/*.ts  →  server/routers/*.ts  →  client/hooks/use*Queries.ts
     (tables)          (helpers DB)       (procédures tRPC)        (hooks React)
```

Toutes les données transitent par des procédures tRPC typées avec validation Zod. Le frontend consomme ces procédures via des hooks `@trpc/react-query`, garantissant un typage de bout en bout sans couche REST intermédiaire.

---

## 2. Pile technologique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Base de données | MySQL 8 / TiDB | Stockage persistant, 42 tables |
| ORM | Drizzle ORM 0.44 | Schéma TypeScript, migrations, requêtes typées |
| API | tRPC 11 + Zod | 141 procédures typées, validation des entrées |
| Serveur | Express 4 + tsx watch | Serveur HTTP, middleware OAuth, proxy Vite |
| Sérialisation | SuperJSON | Préservation des types Date, Map, Set |
| Frontend | React 19 + TanStack Query 5 | Hooks tRPC, cache, invalidation optimiste |
| Tests | Vitest 2.1 | 32 tests unitaires, appels tRPC directs |

---

## 3. Schéma de base de données

Le schéma Drizzle (`drizzle/schema.ts`, 920 lignes) définit **42 tables** organisées en 10 domaines fonctionnels. Chaque table utilise un identifiant auto-incrémenté `id` comme clé primaire et un `uid` VARCHAR(36) comme identifiant métier unique (UUID v4).

### 3.1 Domaine Utilisateurs et RBAC

Ces tables gèrent l'identité des utilisateurs, les rôles, les permissions et les invitations.

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `users` | Comptes utilisateurs (OAuth + invitation) | openId, email, role (user/admin), status, passwordHash |
| `roles` | Rôles RBAC (système ou personnalisés) | name, scope (GLOBAL/PROJECT), isSystem |
| `permissions` | Permissions granulaires par module | module, action (ex: "projects.delete") |
| `role_permissions` | Association rôle ↔ permission (N:N) | roleId, permissionId |
| `user_roles` | Association utilisateur ↔ rôle (N:N) | userId, roleId |
| `invites` | Invitations par email avec token | email, role, token, status, expiresAt |
| `project_memberships` | Accès utilisateur par projet | projectId, userId, projectRole |
| `audit_logs` | Journal d'audit horodaté | actorId, action, entityType, entityId, metadata |

### 3.2 Domaine Projets

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `projects` | Projets de test (IMS, 5GC, API…) | name, domain, status (ACTIVE/ARCHIVED/DRAFT), createdBy |

### 3.3 Domaine Profils et Scénarios

Les profils définissent les paramètres de connexion et le protocole de test. Les scénarios décrivent les étapes de test avec leurs assertions.

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `test_profiles` | Profils de connexion | projectId, protocol, testType (VABF/VSR/VABE), targetHost, parameters (JSON) |
| `test_scenarios` | Scénarios de test | scenarioCode, projectId, profileId, status (DRAFT/FINAL/DEPRECATED), steps (JSON), kpiThresholds (JSON) |
| `generated_scripts` | Scripts générés par IA | scenarioId, language, framework, code, status |

### 3.4 Domaine Datasets

Le système de datasets utilise un modèle à trois niveaux : les **types** (gabarits avec schéma de champs), les **instances** (valeurs concrètes par environnement), et les **bundles** (regroupements d'instances pour une exécution).

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `dataset_types` | Gabarits de jeux de données | datasetTypeId, domain, schemaFields (JSON), tags (JSON) |
| `datasets` | Jeux de données bruts | projectId, format (CSV/JSON/YAML), rowCount, storageUrl |
| `dataset_instances` | Instances par environnement | datasetTypeId, env (DEV/PREPROD/PILOT_ORANGE/PROD), valuesJson (JSON) |
| `dataset_bundles` | Bundles d'instances | projectId, env, status, tags (JSON) |
| `bundle_items` | Association bundle ↔ instance (N:N) | bundleId, datasetId |
| `dataset_secrets` | Marquage des champs sensibles | datasetId, keyPath, isSecret |

### 3.5 Domaine Exécutions

Ce domaine couvre le cycle de vie complet d'une exécution de test, depuis le lancement jusqu'à l'analyse des incidents.

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `executions` | Exécutions de test | projectId, scenarioId, status (PENDING→RUNNING→PASSED/FAILED), durationMs |
| `runner_jobs` | Jobs envoyés aux runners | executionId, runnerId, status, metrics (JSON), artifactManifest (JSON) |
| `artifacts` | Artefacts de test (logs, captures…) | executionId, type, storagePath, sizeBytes, checksum |
| `incidents` | Incidents détectés | executionId, severity (CRITICAL/MAJOR/MINOR/INFO), stepName, expectedResult, actualResult |
| `analyses` | Analyses IA des incidents | incidentId, hypotheses (JSON), rootCause, confidenceScore |

### 3.6 Domaine Captures réseau

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `capture_jobs` | Jobs de capture (PCAP/logs) | executionId, captureType, targetType (K8S/SSH/PROBE), status |
| `capture_sources` | Sources de capture | captureId, namespace, podSelector, host, logPaths (JSON) |
| `capture_artifacts` | Artefacts de capture | executionId, type, storageUrl, sizeBytes |
| `capture_policies` | Politiques de capture | projectId, captureMode (RUNNER/PROBE), triggerOn (JSON), probeId |
| `capture_sessions` | Sessions de capture | policyId, probeId, status, pcapPath, packetCount |

### 3.7 Domaine Sondes

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `probes` | Sondes de collecte distribuées | site, zone, type (LINUX_EDGE/K8S_CLUSTER/NETWORK_TAP), status, healthStatus |
| `probe_policies` | Politiques de sonde | probeId, maxCaptureDurationSec, pcapInterfacesAllowlist (JSON), redactionEnabled |

### 3.8 Domaine Drive Test

Le drive test gère les campagnes de mesure terrain avec collecte de KPI géolocalisés.

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `drive_campaigns` | Campagnes de mesure | projectId, networkType, area, status (DRAFT→ACTIVE→COMPLETED) |
| `drive_routes` | Itinéraires de mesure | campaignId, routeGeojson (JSON), checkpointsGeojson (JSON) |
| `test_devices` | Terminaux de test | projectId, type, model, osVersion, diagCapable |
| `drive_probe_configs` | Configurations de sondes terrain | projectId, location (JSON: lat/lon/label), captureType, retentionDays |
| `drive_jobs` | Jobs de mesure terrain | campaignId, routeId, deviceId, status, progressPct |
| `kpi_samples` | Échantillons KPI géolocalisés | driveJobId, lat, lon, kpiName, value, unit, cellId, technology |
| `drive_run_summaries` | Résumés de run | driveJobId, kpiAverages (JSON), thresholdViolations (JSON), overallPass |
| `drive_imports` | Historique d'imports | campaignId, sourceFormat (CSV/JSON/GPX/GEOJSON/IPERF3), samplesImported |

### 3.9 Domaine Notifications

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `notification_settings` | Configuration par canal (SMS/EMAIL) | channel, provider, enabled, config (JSON) |
| `notification_templates` | Modèles de notification | templateId, channel, subject, bodyText, bodyHtml, variablesSchema (JSON) |
| `notification_rules` | Règles de déclenchement | eventType, channelsEnabled (JSON), templateSmsId, templateEmailId, throttlePolicy (JSON) |
| `notification_delivery_logs` | Journal d'envoi | channel, recipient, status (SENT/FAILED/SKIPPED/THROTTLED), errorMessage |

### 3.10 Index de performance

Chaque table dispose d'index ciblés sur les colonnes fréquemment filtrées. Les index sont définis dans le troisième argument de `mysqlTable()`. Voici les principaux patterns :

- **Index sur clé étrangère** : `idx_profiles_project` sur `projectId` pour les jointures projet → enfants
- **Index sur statut** : `idx_exec_status` pour le filtrage par état (PENDING, RUNNING, etc.)
- **Index composé unique** : `idx_perm_module_action` sur (module, action) pour éviter les doublons de permissions
- **Index temporel** : `idx_al_ts` sur `timestamp` pour les requêtes d'audit chronologiques

---

## 4. Routeurs tRPC

Le fichier `server/routers.ts` assemble **11 sous-routeurs** totalisant **141 procédures** protégées par authentification (sauf 4 procédures publiques pour les notifications email).

### 4.1 Assemblage des routeurs

```typescript
// server/routers.ts
export const appRouter = router({
  auth: authRouter,          // Authentification (logout, me)
  system: systemRouter,      // Système (notifyOwner)
  projects: projectsRouter,  // 5 endpoints
  profiles: profilesRouter,  // 5 endpoints
  scenarios: scenariosRouter, // 5 endpoints
  executions: executionsRouter, // 16 endpoints
  datasets: datasetsRouter,  // 20 endpoints
  captures: capturesRouter,  // 12 endpoints
  probes: probesRouter,      // 12 endpoints
  drivetest: drivetestRouter, // 24 endpoints
  admin: adminRouter,        // 25 endpoints
  notifications: notificationsRouter, // 4 endpoints (public)
  notifSettings: notifSettingsRouter, // 13 endpoints
});
```

### 4.2 Référence des endpoints par routeur

#### `projects` — Gestion des projets (5 endpoints)

| Endpoint | Type | Description |
|----------|------|-------------|
| `list` | query | Liste tous les projets |
| `getByUid` | query | Récupère un projet par UID |
| `create` | mutation | Crée un nouveau projet |
| `update` | mutation | Met à jour un projet existant |
| `delete` | mutation | Supprime un projet |

#### `profiles` — Profils de test (5 endpoints)

| Endpoint | Type | Description |
|----------|------|-------------|
| `list` | query | Liste les profils (filtre par projectId) |
| `getByUid` | query | Récupère un profil par UID |
| `create` | mutation | Crée un profil avec validation testType |
| `update` | mutation | Met à jour un profil |
| `delete` | mutation | Supprime un profil |

#### `scenarios` — Scénarios de test (5 endpoints)

| Endpoint | Type | Description |
|----------|------|-------------|
| `list` | query | Liste les scénarios (filtre par projectId) |
| `getByUid` | query | Récupère un scénario par UID |
| `create` | mutation | Crée un scénario avec steps et kpiThresholds |
| `update` | mutation | Met à jour un scénario (status, steps, etc.) |
| `delete` | mutation | Supprime un scénario |

#### `executions` — Exécutions et analyse (16 endpoints)

| Endpoint | Type | Description |
|----------|------|-------------|
| `list` | query | Liste les exécutions (filtre par projectId, status) |
| `getByUid` | query | Récupère une exécution par UID |
| `create` | mutation | Lance une nouvelle exécution |
| `updateStatus` | mutation | Met à jour le statut (RUNNING, PASSED, FAILED…) |
| `delete` | mutation | Supprime une exécution |
| `listJobs` | query | Liste les runner jobs d'une exécution |
| `createJob` | mutation | Crée un runner job |
| `updateJob` | mutation | Met à jour un runner job (metrics, artifacts) |
| `listArtifacts` | query | Liste les artefacts d'une exécution |
| `createArtifact` | mutation | Enregistre un artefact |
| `listIncidents` | query | Liste les incidents (filtre par projectId) |
| `listIncidentsByExecution` | query | Liste les incidents d'une exécution |
| `getIncidentByUid` | query | Récupère un incident par UID |
| `createIncident` | mutation | Crée un incident |
| `getAnalysisByIncident` | query | Récupère l'analyse IA d'un incident |
| `createAnalysis` | mutation | Crée une analyse IA |

#### `datasets` — Jeux de données (20 endpoints)

| Endpoint | Type | Description |
|----------|------|-------------|
| `listTypes` | query | Liste les types de datasets (filtre par domain) |
| `getTypeByUid` | query | Récupère un type par UID |
| `createType` | mutation | Crée un type avec schemaFields |
| `listDatasets` | query | Liste les datasets (filtre par projectId) |
| `getDatasetByUid` | query | Récupère un dataset par UID |
| `createDataset` | mutation | Crée un dataset |
| `deleteDataset` | mutation | Supprime un dataset |
| `listInstances` | query | Liste les instances (filtre par projectId, env) |
| `getInstanceByUid` | query | Récupère une instance par UID |
| `createInstance` | mutation | Crée une instance avec valuesJson |
| `updateInstance` | mutation | Met à jour une instance |
| `deleteInstance` | mutation | Supprime une instance |
| `listBundles` | query | Liste les bundles (filtre par projectId) |
| `getBundleByUid` | query | Récupère un bundle par UID |
| `createBundle` | mutation | Crée un bundle |
| `deleteBundle` | mutation | Supprime un bundle |
| `listBundleItems` | query | Liste les items d'un bundle |
| `addBundleItem` | mutation | Ajoute un item à un bundle |
| `listSecrets` | query | Liste les secrets d'un dataset |
| `setSecret` | mutation | Marque un champ comme secret |

#### `captures` — Captures réseau (12 endpoints)

| Endpoint | Type | Description |
|----------|------|-------------|
| `listJobs` | query | Liste les jobs de capture (filtre par projectId) |
| `getJobByUid` | query | Récupère un job par UID |
| `createJob` | mutation | Crée un job de capture |
| `updateJob` | mutation | Met à jour un job |
| `listSources` | query | Liste les sources d'une capture |
| `createSource` | mutation | Crée une source de capture |
| `deleteSource` | mutation | Supprime une source |
| `listArtifacts` | query | Liste les artefacts de capture |
| `createArtifact` | mutation | Enregistre un artefact |
| `listSessions` | query | Liste les sessions (filtre par policyId) |
| `listSessionsByExecution` | query | Liste les sessions d'une exécution |
| `createSession` | mutation | Crée une session de capture |

#### `probes` — Sondes distribuées (12 endpoints)

| Endpoint | Type | Description |
|----------|------|-------------|
| `list` | query | Liste les sondes (filtre par site) |
| `getByUid` | query | Récupère une sonde par UID |
| `create` | mutation | Crée une sonde |
| `update` | mutation | Met à jour une sonde (heartbeat, health…) |
| `delete` | mutation | Supprime une sonde |
| `listPolicies` | query | Liste les politiques d'une sonde |
| `createPolicy` | mutation | Crée une politique de sonde |
| `deletePolicy` | mutation | Supprime une politique |
| `listCapturePolicies` | query | Liste les politiques de capture (filtre par projectId) |
| `createCapturePolicy` | mutation | Crée une politique de capture |
| `updateCapturePolicy` | mutation | Met à jour une politique |
| `deleteCapturePolicy` | mutation | Supprime une politique |

#### `drivetest` — Drive test terrain (24 endpoints)

| Endpoint | Type | Description |
|----------|------|-------------|
| `listCampaigns` | query | Liste les campagnes (filtre par projectId) |
| `getCampaign` | query | Récupère une campagne par UID |
| `createCampaign` | mutation | Crée une campagne |
| `updateCampaign` | mutation | Met à jour une campagne |
| `deleteCampaign` | mutation | Supprime une campagne |
| `listRoutes` | query | Liste les routes d'une campagne |
| `createRoute` | mutation | Crée une route avec GeoJSON |
| `deleteRoute` | mutation | Supprime une route |
| `listDevices` | query | Liste les terminaux (filtre par projectId) |
| `createDevice` | mutation | Crée un terminal |
| `deleteDevice` | mutation | Supprime un terminal |
| `listProbeConfigs` | query | Liste les configs de sondes terrain |
| `createProbeConfig` | mutation | Crée une config de sonde |
| `deleteProbeConfig` | mutation | Supprime une config |
| `listJobs` | query | Liste les jobs de drive (filtre par campaignId) |
| `getJob` | query | Récupère un job par UID |
| `createJob` | mutation | Crée un job de drive |
| `updateJob` | mutation | Met à jour un job |
| `listKpiSamples` | query | Liste les échantillons KPI |
| `insertKpiSamples` | mutation | Insère des échantillons KPI en batch |
| `getRunSummary` | query | Récupère le résumé d'un run |
| `upsertRunSummary` | mutation | Crée ou met à jour un résumé |
| `listImports` | query | Liste les imports d'une campagne |
| `createImport` | mutation | Enregistre un import |

#### `admin` — Administration et RBAC (25 endpoints)

| Endpoint | Type | Description |
|----------|------|-------------|
| `listInvites` | query | Liste les invitations |
| `getInviteByToken` | query | Récupère une invitation par token |
| `createInvite` | mutation | Crée une invitation |
| `updateInviteStatus` | mutation | Met à jour le statut d'une invitation |
| `revokeInvite` | mutation | Révoque une invitation |
| `listProjectMemberships` | query | Liste les membres d'un projet |
| `listUserMemberships` | query | Liste les projets d'un utilisateur |
| `createMembership` | mutation | Ajoute un membre à un projet |
| `updateMembership` | mutation | Met à jour le rôle d'un membre |
| `deleteMembership` | mutation | Retire un membre |
| `listRoles` | query | Liste les rôles RBAC |
| `getRole` | query | Récupère un rôle par UID |
| `createRole` | mutation | Crée un rôle |
| `updateRole` | mutation | Met à jour un rôle |
| `deleteRole` | mutation | Supprime un rôle |
| `listPermissions` | query | Liste les permissions |
| `createPermission` | mutation | Crée une permission |
| `getRolePermissions` | query | Liste les permissions d'un rôle |
| `addPermissionToRole` | mutation | Ajoute une permission à un rôle |
| `removePermissionFromRole` | mutation | Retire une permission |
| `getUserRoles` | query | Liste les rôles d'un utilisateur |
| `addRoleToUser` | mutation | Ajoute un rôle à un utilisateur |
| `removeRoleFromUser` | mutation | Retire un rôle |
| `listAuditLogs` | query | Liste les logs d'audit (filtre par action, entity) |
| `createAuditLog` | mutation | Crée une entrée d'audit |

#### `notifications` — Envoi d'emails (4 endpoints publics)

| Endpoint | Type | Description |
|----------|------|-------------|
| `verifySmtp` | mutation | Vérifie la connexion SMTP |
| `testEmail` | mutation | Envoie un email de test |
| `sendEmail` | mutation | Envoie un email via SMTP |
| `sendInviteEmail` | mutation | Envoie un email d'invitation |

#### `notifSettings` — Configuration notifications (13 endpoints)

| Endpoint | Type | Description |
|----------|------|-------------|
| `getSettings` | query | Récupère les paramètres d'un canal |
| `listSettings` | query | Liste tous les paramètres |
| `upsertSettings` | mutation | Crée ou met à jour les paramètres |
| `listTemplates` | query | Liste les modèles |
| `getTemplate` | query | Récupère un modèle |
| `upsertTemplate` | mutation | Crée ou met à jour un modèle |
| `deleteTemplate` | mutation | Supprime un modèle |
| `listRules` | query | Liste les règles |
| `getRule` | query | Récupère une règle |
| `upsertRule` | mutation | Crée ou met à jour une règle |
| `deleteRule` | mutation | Supprime une règle |
| `listDeliveryLogs` | query | Liste les logs d'envoi |
| `createDeliveryLog` | mutation | Crée un log d'envoi |

---

## 5. Helpers de base de données

Chaque module dispose d'un fichier helper dans `server/db/` qui encapsule les requêtes Drizzle. Ces helpers retournent des résultats bruts (rows Drizzle) sans transformation, conformément au pattern recommandé.

| Fichier | Tables gérées | Fonctions principales |
|---------|---------------|----------------------|
| `projects.ts` | projects | listProjects, getProject, createProject, updateProject, deleteProject |
| `profiles.ts` | test_profiles | listProfiles, getProfile, createProfile, updateProfile, deleteProfile |
| `scenarios.ts` | test_scenarios | listScenarios, getScenario, createScenario, updateScenario, deleteScenario |
| `executions.ts` | executions, runner_jobs, artifacts, incidents, analyses | CRUD pour chaque table + requêtes croisées |
| `datasets.ts` | dataset_types, datasets, dataset_instances, dataset_bundles, bundle_items, dataset_secrets | CRUD complet + gestion des bundles |
| `captures.ts` | capture_jobs, capture_sources, capture_artifacts, capture_sessions | CRUD + filtrage par policy/execution |
| `probes.ts` | probes, probe_policies, capture_policies | CRUD + gestion des politiques |
| `drivetest.ts` | drive_campaigns, drive_routes, test_devices, drive_probe_configs, drive_jobs, kpi_samples, drive_run_summaries, drive_imports | CRUD complet + insertion batch KPI |
| `admin.ts` | invites, project_memberships, roles, permissions, role_permissions, user_roles, audit_logs | RBAC complet + audit |
| `notifications.ts` | notification_settings, notification_templates, notification_rules, notification_delivery_logs | Configuration + logs d'envoi |

### Pattern de helper typique

```typescript
// server/db/projects.ts
import { db } from "../_core/db";
import { projects } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function listProjects() {
  return db.select().from(projects).orderBy(projects.createdAt);
}

export async function getProject(uid: string) {
  const [row] = await db.select().from(projects).where(eq(projects.uid, uid));
  return row ?? null;
}

export async function createProject(data: {
  name: string;
  description?: string;
  domain: string;
  createdBy?: string;
}) {
  const uid = uuidv4();
  await db.insert(projects).values({ uid, ...data });
  return getProject(uid);
}
```

---

## 6. Migration frontend

### 6.1 Stratégie de migration

La migration du frontend a suivi une approche en trois couches pour minimiser les changements dans les pages existantes :

1. **Couche hooks tRPC** (9 hooks) : Nouveaux hooks React utilisant `trpc.*.useQuery/useMutation` avec invalidation automatique du cache.

2. **Couche compatibilité** (2 modules) : Les modules `repositoryApiTrpc.ts` et `localStoreTrpc.ts` exposent la même interface que les anciens modules mais appellent tRPC en interne. Cela a permis de migrer les 18 fichiers en changeant uniquement les imports.

3. **Adapter pattern** : Pour les datasets, un `datasetTrpcAdapter.ts` implémente l'interface `DatasetStorageAdapter` existante, permettant une migration transparente via le `DatasetStorageContext`.

### 6.2 Hooks tRPC créés

| Hook | Module | Fonctions exposées |
|------|--------|-------------------|
| `useProjectQueries` | projects | useProjects, useProject, useCreateProject, useUpdateProject, useDeleteProject |
| `useProfileQueries` | profiles | useProfiles, useProfile, useCreateProfile, useUpdateProfile, useDeleteProfile |
| `useScenarioQueries` | scenarios | useScenarios, useScenario, useCreateScenario, useUpdateScenario, useDeleteScenario |
| `useExecutionQueries` | executions | useExecutions, useExecution, useCreateExecution, useUpdateExecution, useDeleteExecution |
| `useCaptureQueries` | captures | useCaptureJobs, useCaptureSources, useCreateCaptureJob, useCreateCaptureSource |
| `useProbeQueries` | probes | useProbes, useProbe, useCreateProbe, useUpdateProbe, useDeleteProbe, useProbeHealth |
| `useDatasetTypeQueries` | datasets | useDatasetTypes, useDatasetType, useCreateDatasetType |
| `useCapturePolicyQueries` | captures | useCapturePolicies, useCreateCapturePolicy, useUpdateCapturePolicy, useDeleteCapturePolicy |
| `useDriveTestQueries` | drivetest | useDriveCampaigns, useDriveRoutes, useDriveDevices, useDriveJobs, useKpiSamples |

### 6.3 Modules de compatibilité

Le module `localStoreTrpc.ts` expose des objets nommés identiquement aux collections de l'ancien `localStore` :

```typescript
// Avant (localStorage)
import { localProjects, localScenarios } from '../api/localStore';
const projects = localProjects.list();

// Après (tRPC via module de compatibilité)
import { localProjects, localScenarios } from '../api/localStoreTrpc';
const projects = await localProjects.list(); // Retourne une Promise
```

Le module `repositoryApiTrpc.ts` expose les mêmes fonctions que `repositoryApi` :

```typescript
// Avant (REST + fallback localStorage)
import { listProjects, createProject } from '../api/repositoryApi';

// Après (tRPC)
import { listProjects, createProject } from '../api/repositoryApiTrpc';
```

### 6.4 Fichiers migrés

Au total, **18 fichiers** ont été migrés :

| Fichier | Ancien import | Nouveau import |
|---------|---------------|----------------|
| ScenariosPage.tsx | localStore, repositoryApi | localStoreTrpc, repositoryApiTrpc |
| ProfilesPage.tsx | repositoryApi | repositoryApiTrpc |
| ExecutionsPage.tsx | localStore, repositoryApi | localStoreTrpc, repositoryApiTrpc |
| ExecutionDetailPage.tsx | localStore, collectorApi | localStoreTrpc |
| CapturesPage.tsx | localStore, collectorApi | localStoreTrpc |
| DriveCampaignsPage.tsx | localStore | localStoreTrpc |
| BundlesPage.tsx | localStore | localStoreTrpc |
| DatasetsPage.tsx | localStore | localStoreTrpc |
| DatasetTypesPage.tsx | localStore | localStoreTrpc |
| ProjectSettingsPage.tsx | localStore | localStoreTrpc |
| AdminProjectAccessPage.tsx | localStore | localStoreTrpc |
| DriveIncidentReportPage.tsx | localStore | localStoreTrpc |
| DriveReportingPage.tsx | localStore | localStoreTrpc |
| GeneratePromptModal.tsx | localStore | localStoreTrpc |
| ScenarioDatasetSection.tsx | localStore | localStoreTrpc |
| ImportResultsModal.tsx | localStore | localStoreTrpc |
| SuggestScenariosModal.tsx | (indirect) | async bulkImportSuggestions |
| scenarioSuggestionEngine.ts | localStore | localStoreTrpc |

### 6.5 Changement important : synchrone → asynchrone

L'ancien `localStore` retournait des résultats **synchrones** (lecture directe du localStorage). Les modules tRPC retournent des **Promises**. Les fonctions de chargement dans les pages ont été converties en `async/await` :

```typescript
// Avant (synchrone)
const campaigns = localDriveCampaigns.list(projectId);

// Après (asynchrone)
const campaigns = await localDriveCampaigns.list(projectId);
```

### 6.6 Unification du QueryClient

Un problème de **double QueryClient** a été détecté et corrigé. Le `main.tsx` fournissait un QueryClient pour tRPC, tandis que `App.tsx` en créait un second pour ses propres hooks. Cela causait des incohérences de cache. La solution a consisté à supprimer le QueryClientProvider de `App.tsx` et à utiliser uniquement celui de `main.tsx`.

---

## 7. Authentification

Le système d'authentification utilise **deux mécanismes** en parallèle :

1. **Manus OAuth** (production) : Le flux OAuth standard via `server/_core/oauth.ts` avec cookie de session JWT. Les procédures `protectedProcedure` vérifient automatiquement le contexte `ctx.user`.

2. **AuthContext localStorage** (développement/fallback) : Un contexte React `AuthContext` qui gère l'authentification via localStorage pour le développement local et les comptes créés par invitation.

Les procédures tRPC utilisent `protectedProcedure` qui injecte `ctx.user` dans le contexte. Les 4 endpoints de notifications sont `publicProcedure` car ils doivent être accessibles sans authentification pour les tests SMTP.

---

## 8. Tests

Les tests Vitest couvrent les procédures tRPC critiques via des appels directs au `createCaller` :

```
server/routers.test.ts    → 21 tests (CRUD projets, profils, scénarios, exécutions, captures, sondes, datasets)
server/auth.logout.test.ts → 1 test (déconnexion)
server/emailService.test.ts → 10 tests (service email Nodemailer)
─────────────────────────────
Total : 32 tests, 100% pass
```

### Pattern de test

```typescript
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

const caller = appRouter.createCaller({
  user: { id: 1, openId: "test-user", name: "Test", role: "admin" },
} as any);

describe("projects", () => {
  it("creates and lists projects", async () => {
    const created = await caller.projects.create({
      name: "Test Project",
      domain: "IMS",
    });
    expect(created).toBeDefined();
    expect(created.uid).toBeTruthy();

    const list = await caller.projects.list();
    expect(list.length).toBeGreaterThan(0);
  });
});
```

---

## 9. Conventions et bonnes pratiques

### Identifiants

Chaque entité métier possède un `uid` (UUID v4) généré côté serveur. L'`id` auto-incrémenté est réservé à l'usage interne de la base de données. Les clés étrangères utilisent le `uid` (pas l'`id`).

### Validation des entrées

Toutes les entrées sont validées par des schémas Zod dans les routeurs tRPC. Les types enum sont strictement définis (ex: `z.enum(["VABF", "VSR", "VABE"])`) pour éviter les valeurs invalides.

### Gestion des erreurs

Les erreurs tRPC sont typées et propagées automatiquement au frontend. Les procédures protégées lèvent une `TRPCError` avec le code `UNAUTHORIZED` si l'utilisateur n'est pas authentifié.

### Timestamps

Toutes les tables utilisent des timestamps UTC gérés par MySQL (`defaultNow()`, `onUpdateNow()`). Le frontend convertit en heure locale pour l'affichage.

### JSON typé

Les colonnes JSON utilisent le typage Drizzle `$type<T>()` pour garantir la cohérence des structures stockées (ex: `steps`, `kpiThresholds`, `artifactManifest`).
