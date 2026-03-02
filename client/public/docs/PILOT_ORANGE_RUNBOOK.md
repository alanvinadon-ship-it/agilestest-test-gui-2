# Runbook Pilote Orange — AgilesTest V1

> **Document opérationnel** destiné aux équipes Orange CIV pour l'exécution autonome du pilote de validation de la plateforme AgilesTest V1.
>
> **Version** : 2.0 — Février 2026
> **Durée estimée** : 4 heures (5 parcours + RBAC + notifications)
> **Audience** : Responsable QA, Testeurs, Ingénieurs Réseau Orange CIV

---

### Changelog V2

| Ajout / Modification | Section | Raison |
|----------------------|---------|--------|
| **Choix du packaging** (Compose vs K8s) | §1.5, §2 | Deux modes de déploiement disponibles |
| **Capture Policy A/B** (tcpdump + probe) | §6.4, §6bis | Probe SPAN/TAP durci pour Core mobile |
| **Drive Test opérateur-grade** | §6 | Segmentation 50m, breach classifier, auto-incidents, repair multi-couches |
| **Notifications** (SMS/Email/Templates/Rules) | §6ter | Validation canaux + delivery logs |
| **Repair enrichi** (Drive + Web/API) | §7 | Evidence chips, rerun plan, export HTML |
| **RBAC étendu** (notifications + expected 403) | §3 | 8 permissions notifications + tests négatifs |
| **Prérequis infra** (sizing CPU/RAM/disque) | §1.5 | Dimensionnement pour Compose et K8s |
| **Liens DocsPage** | Partout | Renvois vers `/docs/<slug>` |

---

## Table des matières

1. [Contexte du pilote](#1-contexte-du-pilote)
2. [Préparation J-15 / J-7 / J-2 / Jour J](#2-préparation)
3. [Comptes et RBAC](#3-comptes-et-rbac)
4. [Parcours 1 — WEB VABF (30 min)](#4-parcours-1--web-vabf)
5. [Parcours 2 — API VABF + mini-VABE (30–45 min)](#5-parcours-2--api-vabf--mini-vabe)
6. [Parcours 3 — Drive Test opérateur-grade (60 min)](#6-parcours-3--drive-test-opérateur-grade)
7. [Parcours 4 — Incident → Repair → Rerun (30 min)](#7-parcours-4--incident--repair--rerun)
8. [Parcours 5 — Validation Notifications (15 min)](#8-parcours-5--validation-notifications)
9. [Observabilité et diagnostic](#9-observabilité-et-diagnostic)
10. [Critères GO/NOGO](#10-critères-gonogo)
11. [Annexes](#11-annexes)

---

## 1. Contexte du pilote

### 1.1 Objectif

Le pilote Orange V1 vise à valider que la plateforme AgilesTest permet aux équipes Orange CIV de **piloter les tests d'acceptance (VABF/VSR) et de performance (VABE)** de manière autonome, avec une boucle complète allant de la création de scénarios jusqu'à l'analyse des résultats et la réparation automatisée des scripts. La V2 du runbook intègre le **Drive Test opérateur-grade** (segmentation, auto-incidents, repair multi-couches), la **capture réseau A/B** (tcpdump + probe SPAN/TAP durci) et les **notifications** (SMS Orange + Email SMTP).

### 1.2 Périmètre exact V1

La V1 couvre les fonctionnalités suivantes, organisées par domaine :

| Domaine | Fonctionnalités V1 | Hors périmètre V1 |
|---------|--------------------|--------------------|
| **Gestion de projet** | Création projet, sélection projet actif, paramètres projet | Multi-tenant SaaS, facturation |
| **Profils de test** | 9 domaines (WEB, API, MOBILE, DESKTOP, TELECOM_IMS, TELECOM_RAN, TELECOM_EPC, TELECOM_5GC, DRIVE_TEST), 3 types de test (VABF/VSR/VABE) | Profils composites multi-domaines |
| **Scénarios** | CRUD, suggestion IA (31 templates, 3 scopes), workflow Draft→Final→Deprecated, dataset types requis | Éditeur visuel drag-and-drop |
| **Datasets** | Instances par environnement (DEV/PREPROD/PILOT_ORANGE/PROD), bundles, secrets masqués, validation scénario↔bundle | Synchronisation externe (Vault, AWS Secrets Manager) |
| **Scripts IA** | Génération (PLAN→GEN), versioning, activation, téléchargement | Fine-tuning du modèle IA |
| **Exécutions** | Run Center, sélection script actif, suivi temps réel, artefacts MinIO/S3 | Exécution distribuée multi-runner |
| **Repair IA** | Analyse d'échec, patches automatiques, diff viewer, Activate & Rerun | Repair multi-fichiers complexe |
| **Drive Test** | Campagnes, routes GeoJSON, devices, probes, KPI reporting, import résultats, **segmentation 50m**, **breach classifier 15 KPI**, **auto-incidents P0/P1/P2**, **DriveIncidentReportPage**, **evidence chips**, **rerun plan** | Intégration directe G-NetTrack |
| **Capture réseau** | Politique de capture (NONE/RUNNER_TCPDUMP/PROBE_SPAN_TAP), résolution cascade, sessions probe, artefacts PCAP, **probe durci** (health, heartbeat, auth token, reason codes, quotas, test capture 30s) | Analyse PCAP intégrée (Wireshark) |
| **Notifications** | **SMS Orange** (OAuth2/API Key, stub), **Email SMTP** (TLS/STARTTLS), **8 templates système**, **7 règles événements**, **delivery logs**, **throttle** | Push notifications mobiles |
| **RBAC** | **53+ permissions** (45 base + 8 notifications), 6 rôles système, rôles custom, invitations | SSO SAML/OIDC |
| **Packaging** | **Docker Compose** (VM Linux) + **Kubernetes GitOps** (Helm + overlays + ArgoCD) | Terraform, Ansible |
| **Documentation** | **17 guides intégrés** (User, Admin, Ops, Troubleshooting, Capture Policy, Probe Hardening, Drive Correlation, Drive Repair, Runbook, Checklist, GO/NOGO, Notifications, Install Compose, Install K8s, DR Runbook, Parité, Smoke Tests) | Wiki collaboratif |

### 1.3 Architecture technique

La plateforme se compose de trois couches :

| Couche | Composant | Technologie |
|--------|-----------|-------------|
| **Frontend** | Console Web | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| **Runner Agent** | Exécution des tests + tcpdump | Docker + Playwright + tcpdump + Node.js |
| **Orchestration** | Coordination des jobs | Node.js + Express (stub MVP) |
| **Stockage** | Artefacts | MinIO/S3 compatible |
| **Données MVP** | Persistance locale | LocalStorage (adaptateur API pour production) |

### 1.4 Environnements cibles

| Environnement | Code | Usage pilote |
|---------------|------|--------------|
| Développement | `DEV` | Tests unitaires, debug |
| Pré-production | `PREPROD` | Validation intégration |
| **Pilote Orange** | `PILOT_ORANGE` | **Environnement du pilote** |
| Production | `PROD` | Hors périmètre pilote |

### 1.5 Choix du packaging et prérequis infra

> Voir aussi : [Install Docker Compose](/docs/install-compose) | [Install Kubernetes](/docs/install-k8s) | [Parité Compose ↔ K8s](/docs/parity-checklist)

Deux modes de déploiement sont disponibles. Le choix dépend du contexte du pilote :

| Critère | Docker Compose (VM) | Kubernetes GitOps |
|---------|:-------------------:|:-----------------:|
| **Cas d'usage** | Pilote rapide, équipe réduite | Cible DSI, multi-environnements |
| **Complexité setup** | Faible (1 VM, 1 commande) | Moyenne (cluster K8s requis) |
| **Scaling** | Manuel | HPA automatique |
| **Rollback** | Tag précédent + `docker compose up` | `helm rollback` |
| **Secrets** | `.env` (chmod 600) | SealedSecrets (chiffré) |
| **TLS** | Nginx + certificats fournis | cert-manager ou Secret |
| **Observabilité** | Logs Docker | Prometheus/Grafana/Loki |
| **Recommandation pilote** | **Oui — choix par défaut** | Si cluster K8s déjà disponible |

**Prérequis infrastructure :**

| Ressource | Compose (VM unique) | K8s (cluster) |
|-----------|:-------------------:|:-------------:|
| **CPU** | 4 vCPU minimum, 8 recommandé | 2 vCPU par node × 3 nodes |
| **RAM** | 8 Go minimum, 16 Go recommandé | 4 Go par node × 3 nodes |
| **Disque** | 50 Go (OS + images + MinIO) | 20 Go par node + PVC MinIO 50 Go |
| **Réseau** | Port 443 (HTTPS) ouvert | Ingress Controller + LoadBalancer |
| **Docker** | Docker Engine 24+ | containerd via K8s |
| **OS** | Ubuntu 22.04 LTS / RHEL 8+ | — |
| **K8s** | — | 1.27+ (EKS, AKS, GKE ou on-prem) |

**Sizing MinIO :**

| Paramètre | Valeur pilote | Valeur production |
|-----------|:-------------:|:-----------------:|
| Stockage | 20 Go | 200 Go+ |
| Rétention PCAP | 30 jours | 90 jours |
| Rétention artefacts | 90 jours | 365 jours |
| Rotation | 100 Mo / fichier | 100 Mo / fichier |

---

## 2. Préparation

### 2.1 J-15 : Choix du packaging et provisioning

L'équipe d'exploitation choisit le mode de déploiement et provisionne l'infrastructure.

**Option 1 — Docker Compose (recommandé pour le pilote) :**

```bash
# Sur la VM provisionnée
cd deploy/compose
cp env.example .env
# Éditer .env avec les valeurs Orange (domaine, secrets MinIO, etc.)
./scripts/init.sh
docker compose -f docker-compose.prod.yml up -d
./scripts/smoke_test.sh
```

Le script `init.sh` crée le bucket MinIO, le compte admin et optionnellement un projet de démonstration. Le script `smoke_test.sh` vérifie que tous les services sont opérationnels (16 tests).

**Option 2 — Kubernetes GitOps :**

```bash
# Depuis un poste avec kubectl + helm configurés
cd deploy/k8s-gitops
helm install agilestest charts/agilestest \
  -n agilestest-pilot-orange \
  -f gitops/overlays/pilot_orange/values-pilot-orange.yaml \
  --create-namespace
# Vérifier
helm test agilestest -n agilestest-pilot-orange
```

Si ArgoCD est disponible, appliquer le manifest `gitops/argocd/application.yaml` pour un déploiement GitOps continu.

> Voir aussi : [Smoke Tests](/docs/smoke-tests) pour les étapes détaillées et résultats attendus.

### 2.2 J-7 : Préparation infrastructure et données

L'équipe d'exploitation s'assure que l'infrastructure est prête une semaine avant le pilote.

**Infrastructure réseau et serveurs :**

L'accès à la plateforme AgilesTest doit être validé depuis les postes des testeurs Orange. Le serveur hébergeant l'application doit être accessible sur le port HTTPS configuré. Si le runner Docker est utilisé, le serveur Docker doit être opérationnel avec les images pré-construites. Le bucket MinIO `agilestest-artifacts` doit être créé et accessible.

**Comptes et accès :**

Trois comptes doivent être créés à l'avance, correspondant aux trois profils du pilote (voir section 3). Les invitations doivent être envoyées et acceptées avant J-2.

**Données de test :**

Les jeux de données suivants doivent être préparés pour l'environnement `PILOT_ORANGE` :

| Dataset | Type | Contenu attendu |
|---------|------|-----------------|
| `users` | Identifiants | Login/password valides + invalides pour l'application cible |
| `form_data` | Formulaires | Données de formulaire (nom, email, téléphone, adresse) |
| `api_endpoints` | Configuration | URLs des APIs à tester (base_url, auth_token) |
| `search_data` | Recherche | Termes de recherche et résultats attendus |
| `cell_config` | Télécom | Configuration cellulaire (cell_id, frequency, bandwidth) |
| `kpi_thresholds` | Seuils | Seuils RSRP/SINR/throughput pour GO/NOGO |

**Probe réseau (si mode B activé) :**

Si le mode PROBE_SPAN_TAP est prévu pour le parcours Drive Test Core mobile :

| Prérequis probe | Vérification |
|-----------------|-------------|
| Probe agent déployé et accessible | `curl http://<probe>:8080/probe/health` → HTTP 200 |
| Token X-PROBE-TOKEN configuré | Vérifier dans la page Probes (`/probes`) |
| Allowlist CIDR configurée | IP du serveur AgilesTest dans la liste |
| Interface miroir (SPAN/TAP) connectée | `ip link show <iface>` → UP |
| Test capture 30s réussi | Bouton "Test capture" dans `/probes` → packets > 0 |

### 2.3 J-2 : Validation technique

Deux jours avant le pilote, l'équipe technique effectue les vérifications suivantes.

**Checklist J-2 :**

L'application AgilesTest doit être accessible à l'URL prévue. La connexion avec le compte ADMIN doit fonctionner. La navigation dans toutes les sections (Projets, Profils, Scénarios, Datasets, Bundles, Scripts, Exécutions, Drive Test, Probes, Notifications, Documentation) doit être fluide et sans erreur. Si le runner Docker est déployé, un job de test doit être lancé et complété avec succès. L'upload d'artefacts vers MinIO doit être vérifié.

**Validation notifications (ADMIN) :**

Naviguer vers `/admin/notifications`. Configurer au minimum le canal Email SMTP (onglet Email). Envoyer un email de test. Vérifier la réception. Activer les 2 règles minimum : `EXECUTION_FAILED` (Email) et `DRIVE_KPI_THRESHOLD_BREACH` (Email). Configurer le throttle recommandé pour le pilote : 10 notifications/heure, déduplication 30 minutes.

**Dry run obligatoire :**

Effectuer un dry run complet avec un fail contrôlé (modifier un dataset pour provoquer un échec). Vérifier que le repair IA fonctionne. Restaurer le dataset original. Ce dry run valide la boucle complète avant le jour J.

**Préparation des données :**

Le projet pilote `Orange-WEB` doit être pré-créé par le compte ADMIN. Les dataset types nécessaires doivent être vérifiés dans la page `/dataset-types`. Un bundle de test minimal doit être créé et validé pour l'environnement `PILOT_ORANGE`.

### 2.4 Jour J : Briefing et lancement

Le jour du pilote, un briefing de 15 minutes est recommandé pour présenter le déroulement des 5 parcours aux participants.

**Ordre des parcours :**

| # | Parcours | Durée | Profil principal | Objectif |
|---|----------|-------|-----------------|----------|
| 1 | WEB VABF | 30 min | MANAGER | Parcours complet : profil → scénarios → datasets → scripts → run |
| 2 | API VABF + mini-VABE | 30–45 min | MANAGER | Tests API + charge minimale |
| 3 | Drive Test opérateur-grade | 60 min | MANAGER | Campagne, import, segmentation, auto-incidents, repair Drive, capture A/B |
| 4 | Incident → Repair → Rerun | 30 min | MANAGER + ADMIN | Boucle repair Web/API + Drive multi-couches |
| 5 | Validation Notifications | 15 min | ADMIN | SMS/Email, templates, rules, delivery logs |

**Matériel nécessaire par participant :**

Chaque participant doit disposer d'un navigateur Chrome ou Firefox récent, d'un accès réseau à la plateforme, et des identifiants de son profil (ADMIN, MANAGER ou VIEWER).

---

## 3. Comptes et RBAC

### 3.1 Profils du pilote

Le pilote utilise trois profils correspondant aux rôles système de la plateforme :

| Profil | Rôle système | Email | Mot de passe | Responsabilité pilote |
|--------|-------------|-------|-------------|----------------------|
| **ADMIN** | `Administrateur` | `admin@agilestest.io` | `admin123` | Setup initial, gestion rôles, invitations, override capture, audit, **notifications settings** |
| **MANAGER** | `Manager` | `manager@orange.ci` | `manager123` | Création profils/scénarios/datasets/scripts, exécution, repair, **drive incidents** |
| **VIEWER** | `Lecteur` | `viewer@orange.ci` | `viewer123` | Consultation résultats, exports, vérification restrictions |

### 3.2 Matrice des permissions par profil

Le tableau suivant résume les permissions clés testées pendant le pilote, par groupe fonctionnel :

| Groupe | Permission | ADMIN | MANAGER | VIEWER |
|--------|-----------|:-----:|:-------:|:------:|
| **Projets** | Lire | **oui** | **oui** | **oui** |
| | Créer / Modifier | **oui** | **oui** | non |
| | Supprimer | **oui** | non | non |
| **Profils** | Lire | **oui** | **oui** | **oui** |
| | Créer / Modifier | **oui** | **oui** | non |
| | Supprimer | **oui** | non | non |
| **Scénarios** | Lire | **oui** | **oui** | **oui** |
| | Créer / Modifier / Activer | **oui** | **oui** | non |
| | Supprimer | **oui** | non | non |
| **Datasets** | Lire | **oui** | **oui** | **oui** |
| | Créer / Modifier / Activer | **oui** | **oui** | non |
| | Voir secrets | **oui** | non | non |
| | Exporter | **oui** | **oui** | non |
| **Bundles** | Lire / Résoudre | **oui** | **oui** | **oui** |
| | Créer / Modifier / Activer | **oui** | **oui** | non |
| **Scripts IA** | Lire | **oui** | **oui** | **oui** |
| | Générer / Activer / Télécharger | **oui** | **oui** | non |
| **Exécutions** | Lire | **oui** | **oui** | **oui** |
| | Lancer / Relancer | **oui** | **oui** | non |
| | Annuler / Supprimer | **oui** | non | non |
| **Repair IA** | Lire | **oui** | **oui** | **oui** |
| | Lancer / Activer version | **oui** | **oui** | non |
| **Drive Test** | Lire campagnes / Reporting | **oui** | **oui** | **oui** |
| | Créer / Modifier campagnes | **oui** | **oui** | non |
| **Notifications** | Lire settings | **oui** | non | non |
| | Modifier settings / templates | **oui** | non | non |
| | Lire rules / delivery logs | **oui** | non | non |
| | Modifier rules | **oui** | non | non |
| **Administration** | Utilisateurs / Rôles / Audit | **oui** | non | non |

### 3.3 Procédure de vérification RBAC

Pour chaque profil, les testeurs doivent vérifier les accès autorisés **et** les refus attendus (tests négatifs).

**Profil ADMIN** — Se connecter avec `admin@agilestest.io`. Vérifier que la section **Administration** est visible dans la barre latérale (Utilisateurs, Accès Projet, Rôles, Matrice RBAC, Audit, **Notifications**). Créer une invitation pour un nouvel utilisateur. Vérifier l'accès à la matrice RBAC dans `/admin/rbac`. Consulter le journal d'audit dans `/admin/audit`. Accéder aux paramètres de notifications dans `/admin/notifications`.

**Profil MANAGER** — Se connecter avec `manager@orange.ci`. Vérifier que la section Administration est **absente** de la barre latérale. Vérifier la possibilité de créer des profils, scénarios, datasets, bundles et scripts. Vérifier la possibilité de lancer des exécutions. Vérifier l'impossibilité de supprimer des ressources (boutons grisés ou absents). **Tenter d'accéder à `/admin/notifications` → erreur 403 attendue** (noter le `trace_id`).

**Profil VIEWER** — Se connecter avec `viewer@orange.ci`. Vérifier que tous les boutons de création/modification/suppression sont **absents ou désactivés**. Vérifier la possibilité de consulter toutes les pages en lecture seule. **Tenter les actions suivantes et vérifier l'erreur 403** :

| Action tentée | Permission requise | Résultat attendu | trace_id |
|---------------|-------------------|------------------|----------|
| Créer un scénario | `scenarios.create` | 403 Forbidden | ________ |
| Lancer une exécution | `executions.run` | Bouton absent | — |
| Accéder à `/admin/audit` | `admin.audit.read` | 403 Forbidden | ________ |
| Accéder à `/admin/notifications` | `notifications.settings.read` | 403 Forbidden | ________ |

> **Où lire le trace_id** : Le toast d'erreur affiche le `trace_id`. Il est également visible dans le journal d'audit (`/admin/audit`, colonne `trace_id`) et dans les logs du runner (préfixe `[trace_id=...]`).

---

## 4. Parcours 1 — WEB VABF (30 min)

> **Profil** : MANAGER
> **Objectif** : Parcours complet de bout en bout — création projet, profil, scénarios, datasets, scripts IA, exécution et collecte d'artefacts.

### 4.1 Créer le projet « Orange-WEB »

1. Naviguer vers `/projects`
2. Cliquer sur **Nouveau projet**
3. Remplir les champs :

| Champ | Valeur |
|-------|--------|
| Nom | `Orange-WEB` |
| Description | `Pilote Orange — Tests WEB VABF` |
| Environnement | `PILOT_ORANGE` |

4. Sauvegarder
5. **Vérification** : Le projet apparaît dans la liste et peut être sélectionné comme projet actif

### 4.2 Sélectionner le projet actif

1. Cliquer sur le sélecteur de projet dans la barre latérale
2. Choisir `Orange-WEB`
3. **Vérification** : L'indicateur dans la barre latérale affiche `Orange-WEB`

### 4.3 Créer un profil WEB

1. Naviguer vers `/profiles`
2. Cliquer sur **Nouveau profil**
3. Remplir les champs :

| Champ | Valeur |
|-------|--------|
| Nom | `WEB-E2E-VABF` |
| Domaine | `WEB` |
| Type de test | `VABF` |
| Sous-type | `UI_E2E` |
| URL cible | `https://app-cible.orange.ci` |

4. Sauvegarder
5. **Vérification** : Le profil affiche le badge `VABF` et le domaine `WEB`

### 4.4 Suggérer des scénarios IA

1. Naviguer vers `/scenarios`
2. Cliquer sur **Suggérer des scénarios IA**
3. Sélectionner le profil `WEB-E2E-VABF`
4. Choisir le scope **Standard**
5. **Vérification** : Au moins 6 templates WEB VABF sont proposés (Login, Form Submit, Navigation, Search, CRUD, Error Handling)

### 4.5 Importer et finaliser 2 scénarios

1. Sélectionner **Authentification utilisateur** et **Soumission de formulaire**
2. Cliquer sur **Importer la sélection**
3. **Vérification** : 2 scénarios en statut `Draft`
4. Pour chaque scénario, cliquer sur **Finaliser** pour passer en statut `Final`

### 4.6 Créer les datasets et le bundle

1. Naviguer vers `/datasets`
2. Créer une instance `users` pour l'environnement `PILOT_ORANGE` avec les identifiants de test
3. Créer une instance `form_data` pour l'environnement `PILOT_ORANGE`
4. Naviguer vers `/bundles`
5. Créer un bundle `Bundle-WEB-PILOT` incluant les 2 instances
6. Activer le bundle
7. **Vérification** : Le bundle affiche le badge `ACTIVE` avec 2 instances liées

### 4.7 Générer les scripts IA

1. Naviguer vers `/scripts`
2. Sélectionner le scénario **Authentification utilisateur**
3. Cliquer sur **Générer** → Étape **Plan** : un plan de test est affiché
4. Cliquer sur **Générer** → Étape **Gen** : le code Playwright est généré
5. Examiner le code généré (vérifier la structure, les imports, les assertions)
6. Cliquer sur **Activer** → le script passe en statut `ACTIVE`
7. Répéter pour le scénario **Soumission de formulaire**

### 4.8 Lancer l'exécution

1. Naviguer vers `/executions` (Run Center)
2. Cliquer sur **Nouvelle exécution**
3. Sélectionner le scénario, le script actif et le bundle
4. Lancer l'exécution
5. **Vérification** : Le statut passe de `PENDING` à `RUNNING` puis à `PASSED` ou `FAILED`
6. Cliquer sur l'exécution pour voir le détail
7. Vérifier les artefacts (LOG, SCREENSHOT, TRACE, VIDEO, HAR)
8. Vérifier la section **Capture Réseau** (mode effectif affiché)

> **Preuve à collecter** : Capture d'écran du Run Center avec l'exécution terminée et la liste des artefacts.

---

## 5. Parcours 2 — API VABF + mini-VABE (30–45 min)

> **Profil** : MANAGER
> **Objectif** : Tests API REST + validation d'erreurs + charge minimale.

### 5.1 Créer le profil API

1. Naviguer vers `/profiles`
2. Créer un profil `API-REST-VABF` (domaine `API`, type `VABF`, sous-type `REST`)
3. Configurer l'URL de base de l'API cible

### 5.2 Scénarios API

1. Suggérer des scénarios IA pour le profil API (scope Standard)
2. Importer les scénarios **CRUD Operations** et **Error Codes Validation**
3. Finaliser les 2 scénarios
4. Créer le dataset `api_endpoints` pour `PILOT_ORANGE`
5. Compléter le bundle API et l'activer

### 5.3 Génération et exécution

1. Générer les scripts IA pour les 2 scénarios (Plan + Gen)
2. Activer les scripts
3. Lancer les exécutions depuis le Run Center
4. Vérifier les résultats (PASSED/FAILED) et les artefacts (LOG, SUMMARY_JSON)

### 5.4 Mini-VABE (charge minimale)

1. Créer un profil `API-LOAD-VABE` (domaine `API`, type `VABE`, sous-type `REST`)
2. Importer un scénario de charge (LOAD_BASELINE)
3. Configurer le dataset de charge (nombre de requêtes, durée, concurrence)
4. Générer et lancer le script de charge
5. **Vérification** : Les métriques de performance sont affichées (latence p50/p95/p99, throughput, error rate)

> **Preuve à collecter** : Capture d'écran des résultats API et des métriques de charge.

---

## 6. Parcours 3 — Drive Test opérateur-grade (60 min)

> **Profil** : MANAGER
> **Objectif** : Campagne terrain complète avec segmentation 50m, breach classifier, auto-incidents, repair Drive multi-couches et capture réseau A/B.
> Voir aussi : [Drive Correlation](/docs/drive-correlation) | [Drive Repair Real](/docs/drive-repair-real) | [Capture Policy](/docs/capture-policy) | [Probe Hardening](/docs/probe-hardening)

### 6.1 Créer la campagne

1. Naviguer vers `/drive/campaigns`
2. Cliquer sur **Nouvelle campagne**
3. Remplir :

| Champ | Valeur |
|-------|--------|
| Nom | `Campagne-Abidjan-Centre` |
| Type | `4G_COVERAGE` |
| Statut | `PLANNED` |
| Description | `Couverture 4G Plateau-Cocody` |

4. Sauvegarder

### 6.2 Ajouter route et device

1. Ajouter une route `Route-Plateau-Cocody` (coordonnées GPS ou import GeoJSON)
2. Ajouter un device `Samsung-S24-Test` (modèle, IMEI, network_type `4G`)
3. **Vérification** : Route et device visibles dans le détail de la campagne

### 6.3 Configurer la capture réseau

Deux modes sont disponibles. Le choix dépend du profil du testeur :

**Mode A — RUNNER_TCPDUMP (QA/Dev) :**

Ce mode lance tcpdump directement sur le runner Docker. Il est adapté aux tests en environnement contrôlé.

| Prérequis | Vérification |
|-----------|-------------|
| tcpdump installé dans le runner | `docker exec runner which tcpdump` → `/usr/bin/tcpdump` |
| Capability NET_RAW | Dockerfile contient `cap_add: NET_RAW` (Compose) ou `securityContext.capabilities` (K8s) |
| Interface réseau | `iface` configurée (ex: `eth0`) |

Configuration dans `/settings` (onglet Capture par défaut) :

| Champ | Valeur recommandée |
|-------|-------------------|
| Mode | `RUNNER_TCPDUMP` |
| Interface | `eth0` |
| BPF filter | `tcp port 80 or tcp port 443` |
| Snaplen | `65535` |
| Rotation | `100` Mo |
| Max files | `10` |

**Mode B — PROBE_SPAN_TAP (Core mobile) :**

Ce mode utilise une sonde réseau externe connectée à un port miroir (SPAN/TAP). Il est adapté aux tests sur le réseau mobile réel.

> Voir aussi : [Probe Hardening](/docs/probe-hardening)

| Prérequis | Vérification |
|-----------|-------------|
| Probe agent déployé | `GET /probe/health` → `{"status":"healthy"}` |
| Token X-PROBE-TOKEN | Configuré dans la page Probes (`/probes`) |
| Allowlist CIDR | IP du serveur AgilesTest autorisée |
| TLS (recommandé) | Certificat configuré sur la probe |
| Interface miroir | `ip link show <iface>` → UP |

Configuration dans `/settings` (onglet Capture par défaut) :

| Champ | Valeur recommandée |
|-------|-------------------|
| Mode | `PROBE_SPAN_TAP` |
| Probe ID | Sélectionner la probe dans la liste |
| Interface | Interface miroir (ex: `ens192`) |
| VLAN filter | Optionnel (ex: `100,200`) |
| BPF filter | `tcp port 80 or tcp port 443` |
| Rotation | `100` Mo |

**Test de capture (obligatoire avant le parcours) :**

1. Naviguer vers `/probes`
2. Vérifier le badge de statut : **Online** (vert) avec `last_seen` < 60s
3. Cliquer sur **Test capture (30s)**
4. **Vérification** : Le test affiche `packets captured > 0` et la taille du PCAP
5. Si `packets = 0` → vérifier l'interface miroir et les filtres BPF

**Que faire en cas d'erreur probe :**

| Reason code | Signification | Action |
|-------------|---------------|--------|
| `PROBE_OFFLINE` | Probe non joignable | Vérifier réseau, token, allowlist CIDR |
| `IFACE_NOT_FOUND` | Interface miroir inexistante | Vérifier `ip link show` sur la probe |
| `NO_PACKETS` | Aucun paquet capturé en 30s | Vérifier que le trafic passe sur l'interface miroir |
| `CAPTURE_FAILED` | tcpdump a crashé | Vérifier les logs probe, espace disque |
| `UPLOAD_FAILED` | Upload MinIO échoué | Vérifier connectivité MinIO depuis la probe |
| `AUTH_FAILED` | Token invalide | Régénérer le token dans `/probes` |
| `QUOTA_EXCEEDED` | Quota sessions dépassé | Attendre la fin des sessions en cours |

### 6.4 Importer les résultats terrain

1. Sélectionner la campagne `Campagne-Abidjan-Centre`
2. Cliquer sur **Importer des résultats**
3. Le modal **ImportResultsModal** s'ouvre avec les formats supportés :

| Format | Extension | Contenu |
|--------|-----------|---------|
| CSV | `.csv` | Mesures radio (RSRP, SINR, throughput) |
| JSON | `.json` | Résultats structurés (KPI, metadata) |
| GPX | `.gpx` | Traces GPS du parcours |
| GeoJSON | `.geojson` | Route avec points de mesure géolocalisés |
| iperf3 | `.json` | Résultats de test de débit (iperf3 --json) |

4. Importer un fichier de test (ou utiliser les données simulées)
5. Vérifier le parsing et la prévisualisation
6. Confirmer l'import
7. **Vérification** : Les résultats apparaissent avec le summary recalculé automatiquement

### 6.5 Analyser le reporting — Segmentation et breach classifier

> Voir aussi : [Drive Correlation](/docs/drive-correlation)

1. Naviguer vers `/drive/reporting`
2. Sélectionner la campagne
3. **Vérifications nouvelles V2** :

| Élément | Attendu |
|---------|---------|
| **Barre de segments colorés** | Segments de 50m colorés : vert (OK), orange (WARN), rouge (CRIT) |
| **Filtre KPI** | Sélecteur : RSRP, SINR, DL Throughput, UL Throughput, Latence, + 10 autres |
| **Slider window** | Choix 5s / 10s / 30s pour l'agrégation temporelle |
| **Compteur segments** | Nombre total + % OK / WARN / CRIT |
| **Section Auto-incidents** | Liste des incidents P0/P1/P2 générés automatiquement |

4. **Seuils de breach** (référence) :

| KPI | Seuil WARN | Seuil CRIT | Unité |
|-----|:----------:|:----------:|:-----:|
| RSRP | < -100 dBm | < -110 dBm | dBm |
| SINR | < 10 dB | < 0 dB | dB |
| DL Throughput | < 20 Mbps | < 5 Mbps | Mbps |
| UL Throughput | < 10 Mbps | < 2 Mbps | Mbps |
| Latence | > 50 ms | > 80 ms | ms |

### 6.6 Drill-down sur un segment

1. Cliquer sur un segment **rouge (CRIT)** dans la barre de segments
2. **Vérifications dans le panneau latéral** :

| Élément | Attendu |
|---------|---------|
| Stats KPI segment | min / avg / max pour le KPI sélectionné |
| Time window | Horodatage début/fin du segment |
| Top violations | Liste des points en breach avec timestamp |
| Bouton "Voir incident" | Si auto-incident généré → lien vers l'incident |
| Bouton "Créer incident" | Si auto-incidents désactivés → création manuelle |
| **Artefacts liés** | Liste des PCAP/logs dans la fenêtre temporelle ± delta |
| Source artefact | Badge `RUNNER` ou `PROBE` |
| Bouton "Ouvrir PCAP" | Téléchargement du fichier PCAP avec taille affichée |

### 6.7 Auto-incidents Drive

1. Vérifier que le toggle **Auto-générer incidents** est activé (par défaut ON pour `PILOT_ORANGE`)
2. Après l'import des résultats, les incidents sont générés automatiquement :

| Sévérité | Condition | Exemple |
|----------|-----------|---------|
| **P0** (Critical) | Segment CRIT | RSRP < -110 dBm sur 3 segments consécutifs |
| **P1** (Major) | Segment WARN persistant | SINR < 10 dB sur > 50% des segments |
| **P2** (Minor) | Segment WARN isolé | Latence > 50 ms sur 1 segment |

3. **Vérification déduplication** : Si un incident similaire existe déjà (même KPI + même segment + window overlap), il n'est pas recréé
4. **Vérification fusion** : Les segments CRIT contigus sont fusionnés en un seul incident

### 6.8 DriveIncidentReportPage — Repair Drive opérateur-grade

> Voir aussi : [Drive Repair Real](/docs/drive-repair-real)

1. Depuis la section auto-incidents, cliquer sur **Analyser & Repair** sur un incident P0
2. La page `/drive/incidents/:id/report` s'ouvre
3. **Vérifications** :

| Section | Contenu attendu |
|---------|----------------|
| **Observations** | Faits constatés (KPI, timestamps, segments) — jamais inventés |
| **Hypothèses par couche** | Radio / Core / QoS / App — chacune avec confiance et preuves |
| **Evidence chips** | Cliquables : segment → stats, timestamp → timeline, artifact → download |
| **Causes racines classées** | Top 3 avec probabilité et couche |
| **Recommandations** | Catégorisées (RADIO/CORE/QOS/APP/CAPTURE/DATASET) avec effort/risque/impact |
| **Plan de rerun** | Segments ciblés, time window, capture mode requis, datasets, commandes |
| **Glossaire** | Termes techniques auto-générés |

4. Cliquer sur **Generate Rerun Job**
5. **Vérification** : Un DriveJob est pré-rempli avec les segments ciblés, la time window et la capture policy override (si nécessaire)

> **Note** : Le rerun job est créé mais non exécuté automatiquement. Il apparaît dans le détail de la campagne pour validation manuelle.

### 6.9 Scénario "Core mobile" (mode B recommandé)

Pour démontrer le parcours complet avec la probe SPAN/TAP :

1. Configurer la capture en mode B (`PROBE_SPAN_TAP`) dans les paramètres projet
2. Importer des résultats avec des KPI en breach (RSRP < -110 dBm)
3. Vérifier qu'un auto-incident P0 est généré
4. Ouvrir le rapport d'incident → vérifier les hypothèses couche Radio
5. Vérifier que les artefacts PCAP sont listés avec la source `PROBE`
6. Cliquer sur **Generate Rerun Job** → vérifier que le mode de capture est `PROBE_SPAN_TAP`

**Vérification de la capture probe :**

1. Naviguer vers `/probes`
2. Vérifier le badge **Online** et les métriques (CPU, disque, sessions actives)
3. Vérifier que la session de capture est en statut `DONE` avec `packets > 0`
4. Vérifier l'ArtifactTimeIndex : les PCAP sont corrélés aux segments de la route

> **Preuve à collecter** : Capture d'écran du rapport d'incident avec les hypothèses par couche, les evidence chips et le plan de rerun.

---

## 7. Parcours 4 — Incident → Repair → Rerun (30 min)

> **Profil** : MANAGER (repair) + ADMIN (override si nécessaire)
> **Objectif** : Démontrer la boucle complète de réparation automatisée pour les tests Web/API et la boucle Drive multi-couches.

### 7.1 Repair Web/API — Provoquer un échec intentionnel

**Méthode A — Modifier le dataset (recommandée) :**

1. Naviguer vers `/datasets`
2. Modifier l'instance `users` de l'environnement `PILOT_ORANGE`
3. Remplacer le `login` par une valeur invalide :

```json
{
  "login": "utilisateur_inexistant@fake.com",
  "password": "mauvais_mot_de_passe"
}
```

4. Sauvegarder

**Méthode B — Modifier le sélecteur dans le scénario :**

1. Naviguer vers `/scenarios`
2. Éditer le scénario **Authentification utilisateur**
3. Modifier une étape pour utiliser un sélecteur CSS inexistant (ex: `#bouton-inexistant`)
4. Sauvegarder

### 7.2 Lancer l'exécution et observer l'échec

1. Naviguer vers `/executions` (Run Center)
2. Lancer une nouvelle exécution du scénario modifié
3. Attendre la fin de l'exécution
4. **Vérification** : Le statut passe à `FAILED` (rouge)
5. Cliquer sur l'exécution pour voir le détail

### 7.3 Consulter le rapport d'incident

Sur la page de détail de l'exécution (`/executions/:id`) :

1. **Vérifier la section Incidents** :
   - Sévérité affichée (CRITICAL, MAJOR, MINOR)
   - Description de l'erreur (ex: "Element not found", "Authentication failed")
   - Horodatage de l'incident
2. **Vérifier les artefacts d'échec** :
   - Screenshot au moment de l'erreur
   - Logs d'exécution avec la stack trace
   - Trace Playwright (si configurée)

### 7.4 Lancer le Repair IA

1. Localiser la section **Repair from Failure**
2. Cliquer sur **Lancer le repair IA**
3. Observer le processus d'analyse
4. **Vérifications après analyse** :

| Élément | Attendu |
|---------|---------|
| **Cause racine** | Description textuelle de la cause identifiée |
| **Confiance** | Score de confiance du repair (ex: 82%) |
| **Correction suggérée** | Description de la correction proposée |
| **Patches** | Diff avant/après pour chaque fichier modifié |
| **Avertissements** | Notes sur les limitations du repair |

5. Examiner le **diff viewer** : lignes rouges = code supprimé, lignes vertes = code ajouté

### 7.5 Sauvegarder et activer la nouvelle version

**Option 1 — Save as new version (prudent) :**

1. Cliquer sur **Save as new version**
2. Un nouveau script `v2` est créé avec le statut `DRAFT`
3. Activer manuellement le script `v2`
4. Relancer l'exécution

**Option 2 — Activate & Rerun (rapide) :**

1. Cliquer sur **Activate & Rerun**
2. Le script `v2` est automatiquement créé, activé et une nouvelle exécution est lancée
3. Un toast de confirmation s'affiche

### 7.6 Vérifier le succès

1. Attendre la fin de la nouvelle exécution
2. **Vérification** : Le statut passe à `PASSED` (vert)
3. Le badge "Repair de [execution_id]" est affiché
4. Les artefacts de succès sont présents

### 7.7 Repair Drive — Boucle multi-couches

Cette section complète le parcours 3 (§6.8) en démontrant la boucle complète :

1. Depuis `/drive/reporting`, identifier un incident P0 auto-généré
2. Cliquer sur **Analyser & Repair**
3. Sur la page DriveIncidentReportPage :
   - Vérifier les hypothèses par couche (Radio, Core, QoS, App)
   - Cliquer sur les **evidence chips** pour naviguer vers les preuves
   - Examiner les **recommandations** catégorisées
4. Cliquer sur **Generate Rerun Job**
5. Vérifier que le job est pré-rempli avec :
   - Les segments ciblés du plan de rerun
   - La time window recommandée
   - La capture policy override (si nécessaire)
6. Valider le job de rerun

> **Important** : Si le repair échoue, restaurer le dataset original et relancer. Le repair IA est simulé en V1 et peut ne pas couvrir tous les cas d'erreur.

> **Preuve à collecter** : Captures d'écran du diff viewer, du toast "Activate & Rerun", de l'exécution PASSED après repair, et du rapport d'incident Drive avec les hypothèses par couche.

---

## 8. Parcours 5 — Validation Notifications (15 min)

> **Profil** : ADMIN uniquement
> **Objectif** : Valider la configuration des canaux de notification, les templates, les règles et les delivery logs.
> Voir aussi : [Admin Notifications](/docs/admin-notifications)

### 8.1 Accéder aux paramètres de notifications

1. Se connecter avec le compte ADMIN
2. Naviguer vers `/admin/notifications`
3. **Vérification** : La page affiche 5 onglets (SMS Orange, Email SMTP, Templates, Règles, Delivery Logs)

### 8.2 Configurer le canal Email SMTP

1. Cliquer sur l'onglet **Email SMTP**
2. Remplir les champs :

| Champ | Valeur pilote |
|-------|--------------|
| Hôte SMTP | `smtp.orange.ci` (ou serveur interne) |
| Port | `587` |
| Sécurité | `STARTTLS` |
| Utilisateur | `noreply@agilestest.orange.ci` |
| Mot de passe | `********` |
| Expéditeur | `AgilesTest <noreply@agilestest.orange.ci>` |

3. Cliquer sur **Enregistrer**
4. Cliquer sur **Envoyer un email de test**
5. Saisir l'adresse email du testeur
6. **Vérification** : L'email de test est reçu dans la boîte de réception

### 8.3 Configurer le canal SMS Orange (optionnel)

Si l'API SMS Orange est disponible pour le pilote :

1. Cliquer sur l'onglet **SMS Orange**
2. Choisir le mode d'authentification (OAuth2 ou API Key)
3. Remplir les champs (client_id, client_secret ou api_key, sender_name)
4. Cliquer sur **Envoyer un SMS de test**
5. **Vérification** : Le SMS est reçu sur le numéro de test

> **Note** : Si l'API SMS n'est pas disponible, le mode **Stub** est activé par défaut. Les SMS sont simulés et apparaissent dans les Delivery Logs avec le statut `DELIVERED (stub)`.

### 8.4 Vérifier les templates

1. Cliquer sur l'onglet **Templates**
2. **Vérification** : 8 templates système sont présents :

| Template | Canal | Variables |
|----------|-------|-----------|
| `execution_failed` | Email + SMS | `{{project_name}}`, `{{scenario_name}}`, `{{error_message}}` |
| `execution_passed` | Email | `{{project_name}}`, `{{scenario_name}}`, `{{duration}}` |
| `drive_kpi_breach` | Email + SMS | `{{campaign_name}}`, `{{kpi_name}}`, `{{severity}}` |
| `probe_offline` | Email + SMS | `{{probe_name}}`, `{{last_seen}}` |
| `user_invited` | Email | `{{inviter_name}}`, `{{project_name}}`, `{{invite_link}}` |
| `repair_completed` | Email | `{{scenario_name}}`, `{{confidence}}`, `{{patches_count}}` |
| `capture_failed` | Email | `{{session_id}}`, `{{reason_code}}`, `{{probe_name}}` |
| `system_alert` | Email | `{{alert_type}}`, `{{message}}`, `{{trace_id}}` |

3. Cliquer sur un template pour voir la **prévisualisation** avec les variables interpolées
4. Optionnel : Créer un template custom pour le pilote

### 8.5 Configurer les règles

1. Cliquer sur l'onglet **Règles**
2. Activer les règles suivantes pour le pilote :

| Événement | Canal | Destinataires | Throttle |
|-----------|-------|---------------|----------|
| `EXECUTION_FAILED` | Email | `manager@orange.ci` | 10/heure, dédup 30 min |
| `DRIVE_KPI_THRESHOLD_BREACH` | Email | `manager@orange.ci`, `admin@agilestest.io` | 5/heure, dédup 60 min |
| `PROBE_OFFLINE` | Email + SMS | `admin@agilestest.io` | 1/heure |

3. Cliquer sur **Test** pour chaque règle → vérifier la notification de test
4. **Vérification** : Les règles affichent le badge `ACTIVE`

### 8.6 Vérifier les Delivery Logs

1. Cliquer sur l'onglet **Delivery Logs**
2. **Vérification** : Les notifications de test apparaissent avec :

| Colonne | Contenu attendu |
|---------|----------------|
| Horodatage | Date/heure de l'envoi |
| Canal | `EMAIL` ou `SMS` |
| Template | Nom du template utilisé |
| Destinataire | Adresse email ou numéro |
| Statut | `DELIVERED` ou `DELIVERED (stub)` |
| Durée | Temps d'envoi en ms |

3. Cliquer sur une entrée pour voir le **drill-down** (contenu rendu, headers, trace_id)
4. Tester le filtre par canal et par statut
5. Cliquer sur **Exporter CSV** pour télécharger les logs

> **Preuve à collecter** : Capture d'écran des delivery logs avec au moins 3 notifications envoyées.

---

## 9. Observabilité et diagnostic

### 9.1 Où trouver le trace_id

Chaque opération génère un identifiant de trace unique (`trace_id`) pour le diagnostic.

| Emplacement | Comment le trouver |
|-------------|-------------------|
| **Page de détail d'exécution** | Section « Informations techniques », champ `trace_id` |
| **Logs du runner** | Préfixe `[trace_id=abc123]` dans chaque ligne |
| **Artefacts MinIO** | Champ `trace_id` dans le manifest JSON |
| **Journal d'audit** | Colonne `trace_id` dans `/admin/audit` |
| **Erreurs toast** | Le message d'erreur affiche le `trace_id` |
| **Delivery logs** | Colonne `trace_id` dans `/admin/notifications` (onglet Delivery Logs) |
| **Probe sessions** | Champ `trace_id` dans le détail de la session de capture |

### 9.2 Erreurs 403 — RBAC

Les erreurs 403 (Forbidden) indiquent un manque de permission. La plateforme affiche une page d'erreur dédiée avec la permission requise, le rôle actuel et l'action recommandée.

**Cas attendus pendant le pilote :**

| Profil | Action tentée | Permission manquante | Comportement attendu |
|--------|---------------|---------------------|---------------------|
| VIEWER | Créer un scénario | `scenarios.create` | Bouton absent ou 403 |
| VIEWER | Lancer une exécution | `executions.run` | Bouton absent |
| VIEWER | Accéder à `/admin/audit` | `admin.audit.read` | 403 Forbidden |
| MANAGER | Supprimer un projet | `projects.delete` | Bouton absent |
| MANAGER | Accéder à `/admin/notifications` | `notifications.settings.read` | 403 Forbidden |
| MANAGER | Voir secrets dataset | `datasets.secrets.read` | Secrets masqués |

### 9.3 Erreurs MinIO / upload d'artefacts

| Erreur | Cause probable | Résolution |
|--------|---------------|------------|
| `ECONNREFUSED` | MinIO non démarré | `docker ps` (Compose) ou `kubectl get pods` (K8s) |
| `NoSuchBucket` | Bucket non créé | `mc mb minio/agilestest-artifacts` |
| `AccessDenied` | Credentials incorrects | Vérifier `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` |
| `RequestTimeTooSkewed` | Horloge désynchronisée | Synchroniser NTP |
| `SlowDown` | Trop de requêtes | Augmenter limites MinIO ou réduire parallélisme |

**Vérification de la connectivité MinIO :**

```bash
# Docker Compose
curl -s http://minio:9000/minio/health/live

# Kubernetes
kubectl exec -it deploy/minio -n agilestest -- curl -s http://localhost:9000/minio/health/live
```

### 9.4 Erreurs fréquentes du runner

| Erreur | Cause | Résolution |
|--------|-------|------------|
| `RUNNER_OFFLINE` | Runner non connecté | Vérifier `ORCHESTRATION_URL` et réseau |
| `SCRIPT_NOT_FOUND` | Aucun script actif | Activer un script dans `/scripts` |
| `BUNDLE_MISSING` | Bundle non résolu | Vérifier le bundle dans `/bundles` |
| `TIMEOUT` | Dépassement du délai | Augmenter le timeout dans le profil |
| `CAPTURE_FAILED` | tcpdump manquant | Vérifier Dockerfile (tcpdump + NET_ADMIN) |

### 9.5 Erreurs probe réseau (mode B)

| Reason code | Signification | Diagnostic | Résolution |
|-------------|---------------|-----------|------------|
| `PROBE_OFFLINE` | Probe non joignable | `GET /probe/health` timeout | Vérifier réseau, firewall, token |
| `IFACE_NOT_FOUND` | Interface miroir absente | `ip link show` sur la probe | Connecter le câble SPAN/TAP |
| `NO_PACKETS` | Aucun paquet en 30s | Vérifier trafic sur l'interface | Ajuster BPF filter ou VLAN |
| `CAPTURE_FAILED` | tcpdump crash | Logs probe | Vérifier espace disque, permissions |
| `UPLOAD_FAILED` | Upload MinIO échoué | Connectivité probe → MinIO | Vérifier endpoint et credentials |
| `AUTH_FAILED` | Token invalide | Vérifier X-PROBE-TOKEN | Régénérer dans `/probes` |
| `QUOTA_EXCEEDED` | Quota sessions dépassé | Vérifier sessions actives | Attendre ou augmenter quota |
| `TIMEOUT` | Capture dépassant la durée max | Vérifier `max_duration_seconds` | Augmenter la limite |
| `DISK_FULL` | Espace disque insuffisant | `df -h` sur la probe | Libérer de l'espace |

### 9.6 Erreurs notifications

| Erreur | Canal | Cause | Résolution |
|--------|-------|-------|------------|
| `SMTP_AUTH_FAILED` | Email | Credentials SMTP incorrects | Vérifier utilisateur/mot de passe |
| `SMTP_TIMEOUT` | Email | Serveur SMTP injoignable | Vérifier hôte/port/firewall |
| `SMS_AUTH_FAILED` | SMS | Token OAuth2 expiré | Rafraîchir le token |
| `SMS_QUOTA_EXCEEDED` | SMS | Quota SMS Orange atteint | Contacter Orange pour augmenter |
| `THROTTLED` | Tous | Throttle activé | Attendre la fenêtre suivante |
| `TEMPLATE_NOT_FOUND` | Tous | Template supprimé | Recréer ou réassigner |

---

## 10. Critères GO/NOGO

### 10.1 Grille d'évaluation

| # | Critère | Poids | Seuil GO | Méthode de mesure |
|---|---------|-------|----------|-------------------|
| C1 | **Compréhension incident sans assistance** | 20% | ≥ 80% des participants comprennent la cause | Questionnaire post-pilote |
| C2 | **Temps gagné vs baseline** | 15% | ≥ 30% de réduction du temps de création | Chronométrage Parcours 1 vs baseline |
| C3 | **Stabilité des exécutions** | 15% | ≥ 90% de taux de succès sur N ≥ 5 runs | Comptage PASSED/FAILED |
| C4 | **Adoption déclarative** | 15% | ≥ 70% déclarent "je l'utiliserais" | Questionnaire Likert (score ≥ 4) |
| C5 | **Couverture fonctionnelle** | 10% | 5/5 parcours complétés sans blocage | Checklist de parcours |
| C6 | **RBAC opérationnel** | 10% | 100% des restrictions vérifiées | Matrice RBAC testée |
| C7 | **Drive Test opérateur-grade** | 10% | Segmentation + auto-incidents + repair visible | Capture d'écran rapport |
| C8 | **Notifications opérationnelles** | 5% | ≥ 1 canal configuré + delivery logs | Capture d'écran delivery logs |

### 10.2 Calcul du score global

```
Score = (C1 × 0.20) + (C2 × 0.15) + (C3 × 0.15) + (C4 × 0.15) + (C5 × 0.10) + (C6 × 0.10) + (C7 × 0.10) + (C8 × 0.05)
```

| Résultat | Score | Décision |
|----------|-------|----------|
| **GO** | ≥ 75% | Déploiement élargi validé |
| **GO conditionnel** | 60–74% | Déploiement avec réserves et plan d'action |
| **NOGO** | < 60% | Pilote à refaire après corrections |

### 10.3 Critères bloquants (NOGO immédiat)

| Critère bloquant | Description |
|-----------------|-------------|
| Perte de données | Toute perte de données utilisateur |
| Faille de sécurité | Accès non autorisé (bypass RBAC) |
| Indisponibilité | Plateforme indisponible > 15 min |
| Corruption d'artefacts | Artefacts MinIO corrompus ou inaccessibles |
| Perte de capture réseau | PCAP corrompus ou sessions probe non récupérables |

---

## 11. Annexes

### 11.1 Variables d'environnement

**Frontend (Vite) :**

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL de base de l'API backend | `https://api.agilestest.io` |
| `VITE_OAUTH_PORTAL_URL` | URL du portail OAuth | `https://auth.agilestest.io` |
| `VITE_APP_ID` | Identifiant de l'application | `agilestest-pilot` |
| `VITE_APP_TITLE` | Titre affiché | `AgilesTest — Test Console` |
| `VITE_APP_LOGO` | URL du logo | `/logo.svg` |

**Runner Agent (Docker) :**

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `RUNNER_ID` | Identifiant unique du runner | `runner-docker-01` |
| `ORCHESTRATION_URL` | URL de l'orchestrateur | `http://orchestration:4000` |
| `MINIO_ENDPOINT` | Endpoint MinIO | `minio` |
| `MINIO_PORT` | Port MinIO | `9000` |
| `MINIO_ACCESS_KEY` | Clé d'accès MinIO | `minioadmin` |
| `MINIO_SECRET_KEY` | Clé secrète MinIO | `minioadmin` |
| `MINIO_BUCKET` | Bucket des artefacts | `agilestest-artifacts` |
| `MINIO_USE_SSL` | Utiliser SSL | `false` |
| `POLL_INTERVAL_MS` | Intervalle de polling (ms) | `5000` |

**Probe Agent :**

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `PROBE_ID` | Identifiant unique de la probe | `probe-span-01` |
| `PROBE_TOKEN` | Token d'authentification | (généré) |
| `PROBE_IFACE` | Interface de capture | `ens192` |
| `MINIO_ENDPOINT` | Endpoint MinIO | `minio` |
| `HEARTBEAT_INTERVAL_MS` | Intervalle heartbeat | `30000` |
| `MAX_CONCURRENT_SESSIONS` | Sessions simultanées max | `3` |
| `MAX_CAPTURE_DURATION_S` | Durée max capture (s) | `3600` |

**Notifications :**

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `SMTP_HOST` | Hôte SMTP | — |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Utilisateur SMTP | — |
| `SMTP_PASS` | Mot de passe SMTP | — |
| `SMS_ORANGE_CLIENT_ID` | Client ID OAuth2 Orange | — |
| `SMS_ORANGE_CLIENT_SECRET` | Client Secret OAuth2 | — |
| `SMS_ORANGE_SENDER` | Nom expéditeur SMS | `AgilesTest` |

### 11.2 Mapping des artefacts attendus par parcours

| Parcours | Type d'artefact | Code | Description |
|----------|----------------|------|-------------|
| WEB VABF | Log d'exécution | `LOG` | Logs Playwright complets |
| WEB VABF | Capture d'écran | `SCREENSHOT` | Screenshots à chaque étape |
| WEB VABF | Trace | `TRACE` | Trace Playwright (timeline) |
| WEB VABF | Vidéo | `VIDEO` | Enregistrement vidéo du test |
| WEB VABF | HAR | `HAR` | Archive HTTP (requêtes réseau) |
| API VABF | Log | `LOG` | Logs des requêtes/réponses |
| API VABF | Résumé JSON | `SUMMARY_JSON` | Métriques agrégées |
| Drive Test | Série KPI | `KPI_SERIES` | Mesures radio (RSRP, SINR, etc.) |
| Drive Test | Route GeoJSON | `GEOJSON_ROUTE` | Tracé GPS du parcours |
| Drive Test | Logs device | `DEVICE_LOGS` | Logs du terminal mobile |
| Drive Test | Résultats iperf | `IPERF_RESULTS` | Mesures de débit iperf3 |
| Drive Test | PCAP (Runner) | `PCAP` | Capture réseau source=RUNNER |
| Drive Test | PCAP (Probe) | `PCAP` | Capture réseau source=PROBE |
| Repair | Log | `LOG` | Logs de l'exécution réparée |
| Repair | Screenshot | `SCREENSHOT` | Preuves visuelles post-repair |

### 11.3 Liste des permissions clés testées (53+)

| Groupe | Permission | Code | Rôle minimum |
|--------|-----------|------|-------------|
| Projets | Lire | `projects.read` | VIEWER |
| Projets | Créer | `projects.create` | MANAGER |
| Projets | Modifier | `projects.update` | MANAGER |
| Projets | Supprimer | `projects.delete` | ADMIN |
| Profils | Lire | `profiles.read` | VIEWER |
| Profils | Créer | `profiles.create` | MANAGER |
| Profils | Modifier | `profiles.update` | MANAGER |
| Profils | Supprimer | `profiles.delete` | ADMIN |
| Scénarios | Lire | `scenarios.read` | VIEWER |
| Scénarios | Créer | `scenarios.create` | MANAGER |
| Scénarios | Modifier | `scenarios.update` | MANAGER |
| Scénarios | Supprimer | `scenarios.delete` | ADMIN |
| Scénarios | Activer | `scenarios.activate` | MANAGER |
| Datasets | Lire | `datasets.read` | VIEWER |
| Datasets | Créer | `datasets.create` | MANAGER |
| Datasets | Modifier | `datasets.update` | MANAGER |
| Datasets | Supprimer | `datasets.delete` | ADMIN |
| Datasets | Activer | `datasets.activate` | MANAGER |
| Datasets | Voir secrets | `datasets.secrets.read` | ADMIN |
| Datasets | Exporter | `datasets.export` | MANAGER |
| Bundles | Lire | `bundles.read` | VIEWER |
| Bundles | Créer | `bundles.create` | MANAGER |
| Bundles | Modifier | `bundles.update` | MANAGER |
| Bundles | Supprimer | `bundles.delete` | ADMIN |
| Bundles | Activer | `bundles.activate` | MANAGER |
| Bundles | Résoudre | `bundles.resolve` | MANAGER |
| Scripts IA | Lire | `scripts.read` | VIEWER |
| Scripts IA | Générer | `scripts.create` | MANAGER |
| Scripts IA | Activer | `scripts.activate` | MANAGER |
| Scripts IA | Supprimer | `scripts.delete` | ADMIN |
| Scripts IA | Télécharger | `scripts.download` | MANAGER |
| Exécutions | Lire | `executions.read` | VIEWER |
| Exécutions | Lancer | `executions.run` | MANAGER |
| Exécutions | Relancer | `executions.rerun` | MANAGER |
| Exécutions | Annuler | `executions.cancel` | ADMIN |
| Exécutions | Supprimer | `executions.delete` | ADMIN |
| Repair IA | Lire | `repair.read` | VIEWER |
| Repair IA | Lancer | `repair.launch` | MANAGER |
| Repair IA | Activer version | `repair.activate` | MANAGER |
| Runners | Lire | `runners.read` | VIEWER |
| Runners | Enregistrer | `runners.register` | ADMIN |
| Runners | Désactiver | `runners.disable` | ADMIN |
| Drive Test | Lire campagnes | `drive.campaigns.read` | VIEWER |
| Drive Test | Créer campagnes | `drive.campaigns.create` | MANAGER |
| Drive Test | Modifier campagnes | `drive.campaigns.update` | MANAGER |
| Drive Test | Supprimer campagnes | `drive.campaigns.delete` | ADMIN |
| Drive Test | Voir reporting | `drive.reporting.read` | VIEWER |
| **Notifications** | Lire settings | `notifications.settings.read` | ADMIN |
| **Notifications** | Modifier settings | `notifications.settings.update` | ADMIN |
| **Notifications** | Lire templates | `notifications.templates.read` | ADMIN |
| **Notifications** | Modifier templates | `notifications.templates.update` | ADMIN |
| **Notifications** | Lire rules | `notifications.rules.read` | ADMIN |
| **Notifications** | Modifier rules | `notifications.rules.update` | ADMIN |
| **Notifications** | Lire delivery logs | `notifications.delivery.read` | ADMIN |
| **Notifications** | Exporter delivery logs | `notifications.delivery.export` | ADMIN |
| Admin | Voir utilisateurs | `admin.users.read` | ADMIN |
| Admin | Gérer utilisateurs | `admin.users.manage` | ADMIN |
| Admin | Voir rôles | `admin.roles.read` | ADMIN |
| Admin | Gérer rôles | `admin.roles.manage` | ADMIN |
| Admin | Gérer invitations | `admin.invites.manage` | ADMIN |
| Admin | Voir audit | `admin.audit.read` | ADMIN |
| Admin | Exporter audit | `admin.audit.export` | ADMIN |
| Admin | Gérer memberships | `admin.memberships.manage` | ADMIN |

### 11.4 URLs de navigation principales

| Page | Route | Description |
|------|-------|-------------|
| Accueil | `/` | Dashboard principal |
| Projets | `/projects` | Liste et gestion des projets |
| Profils | `/profiles` | Profils de test |
| Scénarios | `/scenarios` | Gestion des scénarios |
| Datasets | `/datasets` | Instances de données |
| Types de datasets | `/dataset-types` | Catalogue des types |
| Bundles | `/bundles` | Bundles de données |
| Scripts IA | `/scripts` | Scripts générés |
| Run Center | `/executions` | Lancement et suivi des exécutions |
| Détail exécution | `/executions/:id` | Détail d'une exécution |
| Captures | `/captures` | Politiques de capture réseau |
| Probes | `/probes` | Sondes réseau |
| Paramètres projet | `/settings` | Configuration du projet actif |
| Campagnes Drive | `/drive/campaigns` | Campagnes de drive test |
| Reporting Drive | `/drive/reporting` | Reporting KPI drive test |
| **Incident Drive** | `/drive/incidents/:id/report` | Rapport d'incident Drive opérateur-grade |
| Utilisateurs | `/admin/users` | Gestion des utilisateurs |
| Accès projet | `/admin/project-access` | Memberships projet |
| Rôles | `/admin/roles` | Gestion des rôles |
| Matrice RBAC | `/admin/rbac` | Visualisation des permissions |
| Audit | `/admin/audit` | Journal d'audit |
| **Notifications** | `/admin/notifications` | Paramètres notifications (ADMIN) |
| Documentation | `/docs` | 17 guides intégrés |

### 11.5 Documentation intégrée

La page `/docs` donne accès à 17 guides classés par catégorie :

| Catégorie | Guide | Slug |
|-----------|-------|------|
| Utilisation | Guide utilisateur | `user-guide` |
| Utilisation | Guide administrateur | `admin-guide` |
| Utilisation | Guide opérationnel | `ops-guide` |
| Utilisation | Troubleshooting | `troubleshooting` |
| Capture réseau | Capture Policy | `capture-policy` |
| Capture réseau | Probe Hardening | `probe-hardening` |
| Drive Test | Drive Correlation | `drive-correlation` |
| Drive Test | Drive Repair Real | `drive-repair-real` |
| Notifications | Admin Notifications | `admin-notifications` |
| Pilote Orange | Runbook | `pilot-runbook` |
| Pilote Orange | Checklist | `pilot-checklist` |
| Pilote Orange | GO/NOGO Template | `pilot-go-nogo` |
| Déploiement | Install Docker Compose | `install-compose` |
| Déploiement | Install Kubernetes | `install-k8s` |
| Déploiement | DR Runbook | `dr-runbook` |
| Déploiement | Parité Checklist | `parity-checklist` |
| Déploiement | Smoke Tests | `smoke-tests` |

---

> **Fin du Runbook V2** — Pour les checklists détaillées, voir `PILOT_ORANGE_CHECKLIST.md`. Pour la grille GO/NOGO à remplir, voir `PILOT_ORANGE_GO_NOGO_TEMPLATE.md`.
