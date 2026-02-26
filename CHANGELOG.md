# Changelog — AgilesTest

> Historique chronologique des évolutions, corrections et migrations de la plateforme AgilesTest.

Toutes les dates sont au format ISO 8601. Les entrées sont classées par version décroissante.

---

## v0.2.0 — 2026-02-26 — Backend complet avec base de données

Cette version majeure remplace le stockage localStorage par une base de données relationnelle MySQL/TiDB avec des procédures tRPC typées de bout en bout.

### Ajouts

**Schéma de base de données (42 tables Drizzle)**

Le schéma `drizzle/schema.ts` (920 lignes) couvre l'ensemble des domaines fonctionnels de la plateforme. Les tables sont organisées en 10 domaines : utilisateurs et RBAC (8 tables), projets (1), profils et scénarios (3), datasets (6), exécutions et analyse (5), captures réseau (5), sondes (2), drive test (8), notifications (4) et scripts IA (1). Chaque table dispose d'index ciblés sur les colonnes fréquemment filtrées pour garantir des performances optimales.

**Helpers de base de données (10 fichiers)**

Les fichiers `server/db/*.ts` encapsulent les requêtes Drizzle pour chaque module. Ils exposent des fonctions CRUD typées qui retournent des résultats bruts (rows Drizzle) sans transformation, conformément au pattern recommandé par le template.

| Fichier | Lignes | Tables gérées |
|---------|--------|---------------|
| admin.ts | 490 | invites, project_memberships, roles, permissions, role_permissions, user_roles, audit_logs |
| drivetest.ts | 400 | drive_campaigns, drive_routes, test_devices, drive_probe_configs, drive_jobs, kpi_samples, drive_run_summaries, drive_imports |
| executions.ts | 320 | executions, runner_jobs, artifacts, incidents, analyses |
| datasets.ts | 260 | dataset_types, datasets, dataset_instances, dataset_bundles, bundle_items, dataset_secrets |
| probes.ts | 220 | probes, probe_policies, capture_policies |
| notifications.ts | 330 | notification_settings, notification_templates, notification_rules, notification_delivery_logs |
| captures.ts | 195 | capture_jobs, capture_sources, capture_artifacts, capture_sessions |
| projects.ts | 107 | projects |
| scenarios.ts | 87 | test_scenarios |
| profiles.ts | 86 | test_profiles |

**Routeurs tRPC (11 sous-routeurs, 141 endpoints)**

Les routeurs `server/routers/*.ts` exposent 141 procédures tRPC protégées par authentification. Chaque routeur correspond à un domaine fonctionnel et utilise la validation Zod pour les entrées. Les 4 endpoints de notifications email sont publics pour permettre les tests SMTP sans authentification.

| Routeur | Endpoints | Domaine |
|---------|-----------|---------|
| admin | 25 | Invitations, RBAC, memberships, audit |
| drivetest | 24 | Campagnes, routes, devices, jobs, KPI |
| datasets | 20 | Types, instances, bundles, secrets |
| executions | 16 | Exécutions, jobs, artefacts, incidents, analyses |
| notifSettings | 13 | Paramètres, templates, règles, logs |
| captures | 12 | Jobs, sources, artefacts, sessions |
| probes | 12 | Sondes, politiques, capture policies |
| projects | 5 | Projets |
| profiles | 5 | Profils de test |
| scenarios | 5 | Scénarios de test |
| notifications | 4 | Envoi email (SMTP) |

**Hooks tRPC frontend (9 hooks)**

Neuf hooks React ont été créés dans `client/src/hooks/` pour consommer les procédures tRPC avec invalidation automatique du cache via TanStack Query.

**Modules de compatibilité (3 fichiers)**

Les modules `repositoryApiTrpc.ts`, `localStoreTrpc.ts` et `datasetTrpcAdapter.ts` exposent la même interface que les anciens modules localStorage/REST, permettant une migration transparente des 18 fichiers frontend.

**Client tRPC vanilla**

Un client tRPC vanilla a été ajouté dans `client/src/lib/trpc.ts` pour les appels hors contexte React hooks (adapters, services).

### Migration frontend

Au total, 18 fichiers (pages, composants, services) ont été migrés de `localStore`/`repositoryApi`/`collectorApi` vers les modules tRPC. Les fonctions synchrones ont été converties en `async/await` pour s'adapter au caractère asynchrone des appels réseau.

### Corrections

**Unification du QueryClient** — Un problème de double `QueryClient` a été détecté : `main.tsx` fournissait un QueryClient pour tRPC tandis que `App.tsx` en créait un second. Cela causait des incohérences de cache entre les hooks tRPC et les hooks react-query existants. La correction a consisté à supprimer le `QueryClientProvider` de `App.tsx` pour utiliser uniquement celui de `main.tsx`.

**Conversion synchrone → asynchrone** — Les fonctions de chargement dans `DriveCampaignsPage`, `DriveReportingPage`, `DriveIncidentReportPage`, `BundlesPage`, `DatasetsPage`, `DatasetTypesPage`, `AdminProjectAccessPage` et `scenarioSuggestionEngine` ont été converties en `async/await` pour s'adapter aux appels tRPC asynchrones.

**Types TypeScript** — Les types `UpdateProbeRequest`, `CreateProbeRequest` et `ProbeHealthData` ont été enrichis avec les champs manquants (version, total_captures, interfaces, etc.) pour correspondre au schéma de base de données.

### Tests

32 tests Vitest passent à 100% dans 3 fichiers de test. Le fichier `server/routers.test.ts` couvre 21 procédures CRUD critiques via des appels directs au `createCaller` tRPC.

---

## v0.1.7 — 2026-02-24 — Email réel et invitations

### Ajouts

Cette version a introduit l'envoi d'emails réels via SMTP Nodemailer, le flux d'invitation utilisateur complet avec envoi d'email, et la page d'acceptation d'invitation avec formulaire d'inscription.

Le service email backend (`server/emailService.ts`) utilise Nodemailer avec un transporteur SMTP configurable. Le routeur tRPC `notifications` expose 4 endpoints publics : `verifySmtp`, `testEmail`, `sendEmail` et `sendInviteEmail`.

Le flux d'invitation a été connecté au backend SMTP : le modal d'invitation envoie un email réel quand le mode Live est actif, avec un indicateur visuel du mode (Live/Stub). La page `/invite/accept` permet l'acceptation d'invitation avec validation du token, formulaire d'inscription (nom, mot de passe, indicateur de force) et activation du compte.

### Corrections

**Menu Administration absent** — Le rôle admin n'était pas reconnu à cause d'une comparaison case-sensitive. La normalisation du rôle en minuscules a résolu le problème.

**Clés React manquantes** — Des avertissements `key prop` dans `AdminRbacPage` et `AdminRolesPage` ont été corrigés en ajoutant des clés uniques aux éléments de liste.

**Persistance du login** — Le localStorage stockait `"undefined"` comme valeur de session car la réponse API n'était pas validée avant le fallback local. Une validation de la réponse a été ajoutée.

---

## v0.1.6 — 2026-02-22 — Packaging Docker et Kubernetes

### Ajouts

Cette version a introduit le packaging dual Docker Compose et Kubernetes GitOps pour le déploiement en production.

Le packaging Docker Compose (`deploy/compose/`) inclut un fichier `docker-compose.yml` avec les services applicatifs, la base de données, MinIO pour le stockage d'artefacts, et un reverse proxy Traefik. La documentation couvre l'installation (`INSTALL_COMPOSE.md`), la mise à jour (`UPGRADE_COMPOSE.md`) et la référence des variables d'environnement (`ENV_REFERENCE.md`).

Le packaging Kubernetes GitOps (`deploy/k8s-gitops/`) fournit des manifestes Kustomize avec overlays par environnement (dev, staging, production), un guide d'installation (`INSTALL_K8S_GITOPS.md`), un guide de mise à jour (`UPGRADE_GUIDE.md`) et un runbook de reprise après sinistre (`DR_RUNBOOK.md`).

---

## v0.1.5 — 2026-02-20 — Module Notifications

### Ajouts

Le module Administration > Notifications a été implémenté avec 4 onglets : SMS, Email, Templates et Rules. Chaque canal (SMS/EMAIL) dispose d'un mode Stub (simulation) et Live (envoi réel) avec toggle visuel. Les templates supportent des variables dynamiques avec prévisualisation. Les règles de notification permettent de configurer le déclenchement par type d'événement avec throttling.

---

## v0.1.4 — 2026-02-18 — Drive Test avancé

### Ajouts

Plusieurs fonctionnalités avancées de drive test ont été implémentées dans cette version.

La corrélation KPI↔route↔artefacts avec détection automatique d'incidents (`DRIVE_CORRELATION.md`) permet d'identifier les zones de dégradation réseau en croisant les échantillons KPI géolocalisés avec les itinéraires de mesure.

La boucle de réparation multi-couche (`RUN_REPAIR_LOOP.md`) fournit un diagnostic automatisé des incidents drive test avec analyse IA des causes racines et recommandations de correction.

Le durcissement des sondes mode B (`PROBE_HARDENING.md`) ajoute le heartbeat, l'authentification par token, les quotas de capture et la liste blanche d'interfaces PCAP.

---

## v0.1.3 — 2026-02-16 — Captures et politiques

### Ajouts

Le mode dual de capture (`CAPTURE_POLICY.md`) a été implémenté avec deux modes : Runner (tcpdump intégré au runner de test) et Probe (SPAN/TAP via sondes distribuées). Les politiques de capture permettent de configurer le déclenchement automatique, la durée, la taille maximale et le filtre BPF.

---

## v0.1.2 — 2026-02-14 — Pilote Orange

### Ajouts

Le runbook pilote Orange CIV (`PILOT_ORANGE_RUNBOOK.md`) fournit un guide opérationnel complet pour le déploiement et l'exploitation de la plateforme en environnement pilote. La checklist (`PILOT_ORANGE_CHECKLIST.md`) et le template GO/NOGO (`PILOT_ORANGE_GO_NOGO_TEMPLATE.md`) encadrent la validation du pilote.

---

## v0.1.1 — 2026-02-12 — Fondations

### Ajouts

La version initiale de la plateforme comprend l'interface utilisateur complète avec navigation par sidebar (DashboardLayout), les pages de gestion des projets, profils, scénarios, datasets, exécutions, captures, sondes et drive test. Le stockage utilise localStorage avec un système de fallback REST/local via `repositoryApi` et `collectorApi`.

Le modèle de données frontend (`client/src/types/index.ts`) définit les types TypeScript pour toutes les entités métier. Le système RBAC frontend (`FE_RBAC_COVERAGE.md`) couvre les rôles et permissions avec contrôle d'accès par page.
