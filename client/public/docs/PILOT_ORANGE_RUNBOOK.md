# Runbook Pilote Orange — AgilesTest V1

> **Document opérationnel** destiné aux équipes Orange CIV pour l'exécution autonome du pilote de validation de la plateforme AgilesTest V1.
>
> **Version** : 1.0 — Février 2026
> **Durée estimée** : 3 heures (4 parcours)
> **Audience** : Responsable QA, Testeurs, Ingénieurs Réseau Orange CIV

---

## Table des matières

1. [Contexte du pilote](#1-contexte-du-pilote)
2. [Préparation J-7 / J-2 / Jour J](#2-préparation)
3. [Comptes et RBAC](#3-comptes-et-rbac)
4. [Parcours 1 — WEB VABF (30 min)](#4-parcours-1--web-vabf)
5. [Parcours 2 — API VABF + mini-VABE (30–45 min)](#5-parcours-2--api-vabf--mini-vabe)
6. [Parcours 3 — Drive Test (45 min)](#6-parcours-3--drive-test)
7. [Parcours 4 — Incident → Repair → Rerun (20 min)](#7-parcours-4--incident--repair--rerun)
8. [Observabilité et diagnostic](#8-observabilité-et-diagnostic)
9. [Critères GO/NOGO](#9-critères-gonogo)
10. [Annexes](#10-annexes)

---

## 1. Contexte du pilote

### 1.1 Objectif

Le pilote Orange V1 vise à valider que la plateforme AgilesTest permet aux équipes Orange CIV de **piloter les tests d'acceptance (VABF/VSR) et de performance (VABE)** de manière autonome, avec une boucle complète allant de la création de scénarios jusqu'à l'analyse des résultats et la réparation automatisée des scripts.

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
| **Drive Test** | Campagnes, routes GeoJSON, devices, probes, KPI reporting, import résultats (CSV/JSON/GPX/GeoJSON/iperf3) | Intégration directe G-NetTrack |
| **Capture réseau** | Politique de capture (NONE/RUNNER_TCPDUMP/PROBE_SPAN_TAP), résolution cascade, sessions probe, artefacts PCAP | Analyse PCAP intégrée (Wireshark) |
| **RBAC** | 45+ permissions, 6 rôles système (ADMIN, MANAGER, VIEWER, PROJECT_ADMIN, PROJECT_EDITOR, PROJECT_VIEWER), rôles custom, invitations | SSO SAML/OIDC |
| **Documentation** | 5 guides intégrés (User, Admin, Ops, Troubleshooting, Capture Policy) | Wiki collaboratif |

### 1.3 Architecture technique

La plateforme se compose de trois couches :

| Couche | Composant | Technologie |
|--------|-----------|-------------|
| **Frontend** | Console Web | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| **Runner Agent** | Exécution des tests | Docker + Playwright + tcpdump + Node.js |
| **Stockage** | Artefacts | MinIO/S3 compatible |
| **Données MVP** | Persistance locale | LocalStorage (adaptateur API pour production) |

### 1.4 Environnements cibles

| Environnement | Code | Usage pilote |
|---------------|------|--------------|
| Développement | `DEV` | Tests unitaires, debug |
| Pré-production | `PREPROD` | Validation intégration |
| **Pilote Orange** | `PILOT_ORANGE` | **Environnement du pilote** |
| Production | `PROD` | Hors périmètre pilote |

---

## 2. Préparation

### 2.1 J-7 : Préparation infrastructure

L'équipe d'exploitation doit s'assurer que l'infrastructure est prête une semaine avant le pilote.

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

### 2.2 J-2 : Validation technique

Deux jours avant le pilote, l'équipe technique effectue les vérifications suivantes.

**Checklist J-2 :**

L'application AgilesTest doit être accessible à l'URL prévue. La connexion avec le compte ADMIN doit fonctionner. La navigation dans toutes les sections (Projets, Profils, Scénarios, Datasets, Bundles, Scripts, Exécutions, Drive Test, Documentation) doit être fluide et sans erreur. Si le runner Docker est déployé, un job de test doit être lancé et complété avec succès. L'upload d'artefacts vers MinIO doit être vérifié.

**Préparation des données :**

Le projet pilote `Orange-WEB` doit être pré-créé par le compte ADMIN. Les dataset types nécessaires doivent être vérifiés dans la page `/dataset-types`. Un bundle de test minimal doit être créé et validé pour l'environnement `PILOT_ORANGE`.

### 2.3 Jour J : Briefing et lancement

Le jour du pilote, un briefing de 15 minutes est recommandé pour présenter le déroulement des 4 parcours aux participants.

**Ordre des parcours :**

| # | Parcours | Durée | Profil principal | Objectif |
|---|----------|-------|-----------------|----------|
| 1 | WEB VABF | 30 min | MANAGER | Parcours complet : profil → scénarios → datasets → scripts → run |
| 2 | API VABF + mini-VABE | 30–45 min | MANAGER | Tests API + charge minimale |
| 3 | Drive Test | 45 min | MANAGER | Campagne terrain, import résultats, KPI |
| 4 | Incident → Repair → Rerun | 20 min | MANAGER + ADMIN | Boucle de réparation IA |

**Matériel nécessaire par participant :**

Chaque participant doit disposer d'un navigateur Chrome ou Firefox récent, d'un accès réseau à la plateforme, et des identifiants de son profil (ADMIN, MANAGER ou VIEWER).

---

## 3. Comptes et RBAC

### 3.1 Profils du pilote

Le pilote utilise trois profils correspondant aux rôles système de la plateforme :

| Profil | Rôle système | Email | Mot de passe | Responsabilité pilote |
|--------|-------------|-------|-------------|----------------------|
| **ADMIN** | `Administrateur` | `admin@agilestest.io` | `admin123` | Setup initial, gestion rôles, invitations, override capture, audit |
| **MANAGER** | `Manager` | `manager@orange.ci` | `manager123` | Création profils/scénarios/datasets/scripts, exécution, repair |
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
| **Administration** | Utilisateurs / Rôles / Audit | **oui** | non | non |

### 3.3 Procédure de vérification RBAC

Pour chaque profil, les testeurs doivent vérifier que :

**Profil ADMIN** — Se connecter avec `admin@agilestest.io`. Vérifier que la section **Administration** est visible dans la barre latérale (Utilisateurs, Accès Projet, Rôles, Matrice RBAC, Audit). Créer une invitation pour un nouvel utilisateur. Vérifier l'accès à la matrice RBAC dans `/admin/rbac`. Consulter le journal d'audit dans `/admin/audit`.

**Profil MANAGER** — Se connecter avec `manager@orange.ci`. Vérifier que la section Administration est **absente** de la barre latérale. Vérifier la possibilité de créer des profils, scénarios, datasets, bundles et scripts. Vérifier la possibilité de lancer des exécutions. Vérifier l'impossibilité de supprimer des ressources (boutons grisés ou absents).

**Profil VIEWER** — Se connecter avec `viewer@orange.ci`. Vérifier que tous les boutons de création/modification/suppression sont **absents ou désactivés**. Vérifier la possibilité de consulter toutes les pages en lecture seule. Tenter une action d'écriture et vérifier l'affichage de l'erreur 403.

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
| Description | `Pilote V1 — Tests VABF Web pour Orange CIV` |
| Domaine | `WEB` |

4. Valider la création
5. **Vérification** : Le projet apparaît dans la liste et est sélectionné comme projet actif (indicateur dans la barre latérale)

### 4.2 Créer un profil WEB

1. Naviguer vers `/profiles`
2. Cliquer sur **Nouveau profil**
3. Remplir les champs :

| Champ | Valeur |
|-------|--------|
| Nom | `WEB-E2E-VABF` |
| Domaine | `WEB` |
| Type de test | `VABF` |
| Type de profil | `UI_E2E` |
| Runner type | `PLAYWRIGHT` |

4. Valider la création
5. **Vérification** : Le profil apparaît avec le badge `VABF` en vert et le domaine `WEB`

### 4.3 Suggérer des scénarios IA (scope Standard)

1. Naviguer vers `/scenarios`
2. Cliquer sur **Suggérer des scénarios (IA)**
3. Dans le modal de suggestion :
   - Sélectionner le profil `WEB-E2E-VABF`
   - Choisir le scope **Standard**
   - Cliquer sur **Générer les suggestions**
4. **Vérification** : La liste affiche les templates WEB VABF suivants (entre autres) :

| Template ID | Titre | Priorité |
|-------------|-------|----------|
| `WEB_VABF_LOGIN` | Authentification utilisateur | P0 |
| `WEB_VABF_LOGIN_FAIL` | Échec d'authentification | P0 |
| `WEB_VABF_NAVIGATION` | Navigation entre pages | P1 |
| `WEB_VABF_FORM_SUBMIT` | Soumission de formulaire | P1 |
| `WEB_VABF_FORM_VALIDATION` | Validation de formulaire | P1 |
| `WEB_VABF_SEARCH` | Recherche | P1 |
| `WEB_VABF_RESPONSIVE` | Responsive design | P2 |
| `WEB_VABF_LOGOUT` | Déconnexion | P1 |

5. Sélectionner **WEB_VABF_LOGIN** et **WEB_VABF_FORM_SUBMIT** (cocher les cases)
6. Cliquer sur **Importer les scénarios sélectionnés**
7. **Vérification** : Les 2 scénarios apparaissent dans la liste avec le statut `Draft`

### 4.4 Finaliser les scénarios

1. Cliquer sur le scénario **Authentification utilisateur**
2. Cliquer sur **Éditer**
3. Vérifier les étapes pré-remplies (NAVIGATE, INPUT, CLICK, ASSERT)
4. Ajouter les dataset types requis : `users`
5. Passer le statut à **Final** (bouton Finaliser)
6. **Vérification** : Le badge passe de `Draft` à `Final`
7. Répéter pour le scénario **Soumission de formulaire** avec le dataset type `form_data`

### 4.5 Créer les datasets instances + bundle DEV

1. Naviguer vers `/datasets`
2. Cliquer sur **Nouvelle instance**
3. Créer l'instance `users` :

| Champ | Valeur |
|-------|--------|
| Type de dataset | `users` |
| Environnement | `PILOT_ORANGE` |
| Données | `{"login": "testeur@orange.ci", "password": "Test2026!", "invalid_login": "fake@test.com", "invalid_password": "wrong"}` |

4. Créer l'instance `form_data` :

| Champ | Valeur |
|-------|--------|
| Type de dataset | `form_data` |
| Environnement | `PILOT_ORANGE` |
| Données | `{"nom": "Koné", "prenom": "Amadou", "email": "a.kone@orange.ci", "telephone": "+225 07 00 00 00"}` |

5. Naviguer vers `/bundles`
6. Cliquer sur **Nouveau bundle**
7. Remplir :

| Champ | Valeur |
|-------|--------|
| Nom | `Bundle-WEB-PILOT` |
| Environnement | `PILOT_ORANGE` |
| Instances | Sélectionner `users` + `form_data` |

8. Valider et activer le bundle
9. **Vérification** : Le bundle apparaît avec le badge `ACTIVE` et 2 instances liées

### 4.6 Générer les scripts IA (Plan + Gen) et activer

1. Naviguer vers `/scenarios`
2. Sélectionner le scénario **Authentification utilisateur** (statut Final)
3. Cliquer sur **Générer script IA**
4. Dans le modal de génération :
   - Vérifier le contexte pré-rempli (projet, profil, scénario, bundle)
   - Cliquer sur **Étape 1 : Plan** → Le système génère un plan de test
   - Vérifier le plan affiché (fichiers, framework, stratégie)
   - Cliquer sur **Étape 2 : Générer** → Le système génère le code Playwright
5. **Vérification** : Le script apparaît dans `/scripts` avec le statut `DRAFT` et la version `v1`
6. Cliquer sur **Activer** pour passer le script en `ACTIVE`
7. **Vérification** : Le badge passe à `ACTIVE` — ce script sera utilisé par défaut lors des exécutions

### 4.7 Lancer l'exécution et obtenir les artefacts

1. Naviguer vers `/executions` (Run Center)
2. Cliquer sur **Nouvelle exécution**
3. Remplir les paramètres :

| Champ | Valeur |
|-------|--------|
| Scénario | Authentification utilisateur |
| Script | (auto-sélectionné : script ACTIVE) |
| Bundle | Bundle-WEB-PILOT |
| Environnement | PILOT_ORANGE |
| Runner | runner-docker-01 (si disponible) |

4. Vérifier la section **Capture Réseau** : le mode effectif est affiché (hérité du projet)
5. Cliquer sur **Lancer**
6. **Vérification** : L'exécution apparaît avec le statut `PENDING` puis `RUNNING`
7. Attendre la fin de l'exécution (ou simulée en mode local)
8. Cliquer sur l'exécution pour voir le détail (`/executions/:id`)
9. **Vérifications sur la page de détail** :
   - Statut final (PASSED ou FAILED)
   - Informations script/bundle/env/runner affichées
   - Section **Artefacts** : présence de LOG, SCREENSHOT, TRACE (selon la politique d'upload)
   - Section **Capture Réseau** : mode, source, rétention, nombre de PCAP
   - Si MinIO est configuré : les artefacts affichent l'icône MinIO/S3 avec les liens de téléchargement

> **Preuve à collecter** : Capture d'écran de la page de détail d'exécution montrant le statut, les artefacts et la section capture.

---

## 5. Parcours 2 — API VABF + mini-VABE (30–45 min)

> **Profil** : MANAGER
> **Objectif** : Tester les scénarios API (REST) et effectuer un test de charge minimal.

### 5.1 Créer un profil API

1. Naviguer vers `/profiles`
2. Cliquer sur **Nouveau profil**
3. Remplir les champs :

| Champ | Valeur |
|-------|--------|
| Nom | `API-REST-VABF` |
| Domaine | `API` |
| Type de test | `VABF` |
| Type de profil | `REST` |
| Runner type | `NODE_SCRIPT` |

4. Valider la création

### 5.2 Suggérer et importer les scénarios API

1. Naviguer vers `/scenarios`
2. Cliquer sur **Suggérer des scénarios (IA)**
3. Sélectionner le profil `API-REST-VABF`, scope **Standard**
4. Les templates suivants sont proposés :

| Template ID | Titre | Priorité |
|-------------|-------|----------|
| `API_VABF_HEALTH` | Health check API | P0 |
| `API_VABF_AUTH` | Authentification API | P0 |
| `API_VABF_CRUD` | Opérations CRUD | P0 |
| `API_VABF_PAGINATION` | Pagination | P1 |
| `API_VABF_VALIDATION` | Validation des entrées | P1 |
| `API_VABF_ERROR_CODES` | Codes d'erreur HTTP | P1 |

5. Sélectionner **API_VABF_CRUD** et **API_VABF_ERROR_CODES**
6. Importer et finaliser les 2 scénarios

### 5.3 Créer les datasets API

1. Naviguer vers `/datasets`
2. Créer l'instance `api_endpoints` :

| Champ | Valeur |
|-------|--------|
| Type | `api_endpoints` |
| Environnement | `PILOT_ORANGE` |
| Données | `{"base_url": "https://api-pilot.orange.ci/v1", "auth_token": "Bearer xxx", "timeout_ms": 5000}` |

3. Ajouter au bundle existant ou créer un nouveau bundle `Bundle-API-PILOT`

### 5.4 Générer et exécuter les scripts API

1. Pour chaque scénario API finalisé, générer le script IA (Plan + Gen)
2. Activer les scripts générés
3. Lancer les exécutions depuis le Run Center
4. **Vérifications** :
   - Les scripts générés utilisent le framework approprié (ex: `axios` + `jest` ou `playwright` API testing)
   - Les artefacts incluent les logs de requêtes/réponses HTTP
   - Les codes d'erreur sont correctement validés (400, 401, 404, 500)

### 5.5 Mini-VABE : test de charge minimal

Le test de charge minimal vise à valider la capacité de la plateforme à orchestrer des tests de performance, même à petite échelle.

1. Créer un nouveau profil :

| Champ | Valeur |
|-------|--------|
| Nom | `API-LOAD-VABE` |
| Domaine | `API` |
| Type de test | `VABE` |
| Type de profil | `REST` |
| Runner type | `NODE_SCRIPT` |

2. Suggérer les scénarios VABE (scope Minimal) :

| Template ID | Titre | Priorité |
|-------------|-------|----------|
| `API_VABE_LOAD_BASELINE` | Baseline de charge | P0 |
| `API_VABE_STRESS` | Test de stress | P1 |

3. Importer et finaliser `API_VABE_LOAD_BASELINE`
4. Configurer le dataset avec les paramètres de charge :

```json
{
  "target_url": "https://api-pilot.orange.ci/v1/health",
  "concurrent_users": 10,
  "duration_seconds": 60,
  "ramp_up_seconds": 10,
  "expected_p95_ms": 500
}
```

5. Générer le script IA et lancer l'exécution
6. **Vérifications** :
   - Le script de charge est généré avec les paramètres du dataset
   - Les métriques de performance sont collectées (latence p50/p95/p99, throughput, erreurs)
   - Les artefacts incluent un rapport de performance

> **Preuve à collecter** : Capture d'écran du Run Center montrant les exécutions API (PASSED/FAILED) et les métriques de charge.

---

## 6. Parcours 3 — Drive Test (45 min)

> **Profil** : MANAGER
> **Objectif** : Créer une campagne de drive test, importer des résultats terrain, analyser les KPI et exporter un rapport.

### 6.1 Créer une campagne Drive Test

1. Naviguer vers `/drive/campaigns`
2. Cliquer sur **Nouvelle campagne**
3. Remplir les champs :

| Champ | Valeur |
|-------|--------|
| Nom | `Campagne-Abidjan-Centre` |
| Description | `Drive test couverture 4G/5G centre-ville Abidjan` |
| Statut | `PLANNED` |
| Technologie | `4G_LTE` (ou `5G_NR` selon le réseau cible) |

4. Valider la création
5. **Vérification** : La campagne apparaît dans l'onglet **Campagnes** avec le statut `PLANNED`

### 6.2 Configurer la route

1. Cliquer sur la campagne créée pour accéder au détail
2. Dans l'onglet **Routes**, cliquer sur **Ajouter une route**
3. Remplir les champs :

| Champ | Valeur |
|-------|--------|
| Nom | `Route-Plateau-Cocody` |
| Description | `Parcours Plateau → Cocody via Boulevard Lagunaire` |
| Distance estimée | `12 km` |
| Durée estimée | `45 min` |

4. Si disponible, importer un fichier GeoJSON du parcours
5. **Vérification** : La route apparaît dans la liste avec les informations saisies

### 6.3 Configurer les devices et probes

1. Dans l'onglet **Devices**, ajouter un appareil de test :

| Champ | Valeur |
|-------|--------|
| Nom | `Samsung-S24-Test` |
| Type | `SMARTPHONE` |
| OS | `Android 14` |
| IMEI | `352XXXXXXXXX` |
| Opérateur | `Orange CI` |

2. Dans l'onglet **Probes** (si applicable), vérifier la configuration des sondes réseau

### 6.4 Configurer la politique de capture (optionnel)

1. Dans l'onglet **Capture** de la campagne
2. Sélectionner le mode de capture :
   - **Mode A (Runner tcpdump)** : pour capturer le trafic depuis le runner Docker
   - **Mode B (Probe SPAN/TAP)** : pour capturer via une sonde réseau distante
   - **NONE** : pas de capture réseau
3. Configurer les paramètres selon le mode choisi (interface, filtre BPF, rétention)
4. **Vérification** : La politique de capture est affichée avec le badge du mode sélectionné

### 6.5 Importer les résultats terrain

Cette étape simule l'import de résultats collectés sur le terrain avec des outils comme G-NetTrack, iperf3 ou des exports GPS.

1. Naviguer vers `/drive/campaigns`
2. Sélectionner la campagne `Campagne-Abidjan-Centre`
3. Cliquer sur **Importer des résultats**
4. Le modal **ImportResultsModal** s'ouvre avec les options suivantes :

| Format | Extension | Contenu |
|--------|-----------|---------|
| CSV | `.csv` | Mesures radio (RSRP, SINR, throughput) |
| JSON | `.json` | Résultats structurés (KPI, metadata) |
| GPX | `.gpx` | Traces GPS du parcours |
| GeoJSON | `.geojson` | Route avec points de mesure géolocalisés |
| iperf3 | `.json` | Résultats de test de débit (iperf3 --json) |

5. Sélectionner un fichier de test (ou utiliser les données simulées)
6. Vérifier le parsing automatique et la prévisualisation des données
7. Confirmer l'import
8. **Vérification** : Les résultats apparaissent dans la campagne avec les KPI parsés

### 6.6 Analyser le reporting KPI

1. Naviguer vers `/drive/reporting`
2. Sélectionner la campagne `Campagne-Abidjan-Centre`
3. **Vérifications** :

| KPI | Seuil acceptable (4G) | Seuil bon | Seuil excellent |
|-----|----------------------|-----------|-----------------|
| RSRP | > -110 dBm | > -100 dBm | > -85 dBm |
| SINR | > 0 dB | > 10 dB | > 20 dB |
| DL Throughput | > 5 Mbps | > 20 Mbps | > 50 Mbps |
| UL Throughput | > 2 Mbps | > 10 Mbps | > 25 Mbps |
| Latence | < 80 ms | < 50 ms | < 30 ms |

4. Vérifier que les graphiques et tableaux de KPI sont affichés
5. Cliquer sur **Exporter CSV** pour télécharger le rapport
6. **Vérification** : Le fichier CSV contient les colonnes attendues (timestamp, lat, lon, kpi_name, value, unit)

### 6.7 Lancer un run Drive (si runner disponible)

Si le runner Docker est déployé et configuré pour le mode Drive Test :

1. Passer la campagne en statut `RUNNING`
2. Lancer un DriveJob depuis le détail de la campagne
3. Suivre l'exécution dans le Run Center
4. Vérifier les artefacts collectés (KPI_SERIES, GEOJSON_ROUTE, DEVICE_LOGS, IPERF_RESULTS)

> **Preuve à collecter** : Capture d'écran du reporting KPI avec les graphiques et le fichier CSV exporté.

---

## 7. Parcours 4 — Incident → Repair → Rerun (20 min)

> **Profil** : MANAGER (repair) + ADMIN (override si nécessaire)
> **Objectif** : Démontrer la boucle complète de réparation automatisée : échec → analyse IA → patch → nouvelle version → réexécution réussie.

### 7.1 Provoquer un échec intentionnel

Pour démontrer la boucle de repair, il faut d'abord provoquer un échec contrôlé. Deux méthodes sont possibles :

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
4. Sauvegarder (le script actif utilisera toujours l'ancienne version)

### 7.2 Lancer l'exécution et observer l'échec

1. Naviguer vers `/executions` (Run Center)
2. Lancer une nouvelle exécution du scénario **Authentification utilisateur** avec le bundle modifié
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

1. Sur la page de détail de l'exécution FAILED, localiser la section **Repair from Failure**
2. Cliquer sur **Lancer le repair IA**
3. Observer le processus d'analyse (indicateur de chargement)
4. **Vérifications après analyse** :

| Élément | Attendu |
|---------|---------|
| **Cause racine** | Description textuelle de la cause identifiée |
| **Confiance** | Score de confiance du repair (ex: 82%) |
| **Correction suggérée** | Description de la correction proposée |
| **Patches** | Diff avant/après pour chaque fichier modifié |
| **Avertissements** | Notes sur les limitations du repair |

5. Examiner le **diff viewer** :
   - Lignes rouges = code original supprimé
   - Lignes vertes = code patché ajouté
   - Explication du patch pour chaque modification

### 7.5 Sauvegarder et activer la nouvelle version

Deux options sont disponibles :

**Option 1 — Save as new version (prudent) :**

1. Cliquer sur **Save as new version**
2. **Vérification** : Un nouveau script `v2` est créé avec le statut `DRAFT`
3. Naviguer vers `/scripts` pour vérifier la nouvelle version
4. Activer manuellement le script `v2`
5. Relancer l'exécution depuis le Run Center

**Option 2 — Activate & Rerun (rapide) :**

1. Cliquer sur **Activate & Rerun**
2. **Vérification** : Le script `v2` est automatiquement créé, activé et une nouvelle exécution est lancée
3. Un toast de confirmation s'affiche : "Script v2 activé + exécution relancée"

### 7.6 Vérifier le succès

1. Attendre la fin de la nouvelle exécution
2. **Vérification** : Le statut passe à `PASSED` (vert)
3. Sur la page de détail :
   - Le badge "Repair de [execution_id]" est affiché (lien vers l'exécution d'origine)
   - Les artefacts de succès sont présents
   - La section Incidents est vide ou ne contient que des INFO

> **Important** : Si le repair échoue (statut FAILED à nouveau), restaurer le dataset original et relancer. Le repair IA est simulé en V1 et peut ne pas couvrir tous les cas d'erreur.

> **Preuve à collecter** : Captures d'écran du diff viewer (avant/après), du toast "Activate & Rerun", et de l'exécution PASSED après repair.

---

## 8. Observabilité et diagnostic

### 8.1 Où trouver le trace_id

Chaque opération dans AgilesTest génère un identifiant de trace unique (`trace_id`) qui permet de suivre le parcours complet d'une requête à travers les différentes couches du système.

| Emplacement | Comment le trouver |
|-------------|-------------------|
| **Page de détail d'exécution** | Section « Informations techniques », champ `trace_id` |
| **Logs du runner** | Chaque ligne de log contient le `trace_id` en préfixe : `[trace_id=abc123] ...` |
| **Artefacts MinIO** | Le manifest JSON inclut le champ `trace_id` dans les métadonnées |
| **Journal d'audit** | Colonne `trace_id` dans `/admin/audit` (profil ADMIN requis) |
| **Erreurs toast** | Les messages d'erreur affichent le `trace_id` pour faciliter le support |

En cas de problème, communiquer le `trace_id` à l'équipe de support permet un diagnostic rapide sans ambiguïté.

### 8.2 Erreurs 403 — RBAC

Les erreurs 403 (Forbidden) indiquent un manque de permission pour l'action tentée. La plateforme affiche une page d'erreur dédiée (`ErrorState403`) avec les informations suivantes :

| Information | Description |
|-------------|-------------|
| **Permission requise** | Le code de la permission manquante (ex: `scenarios.create`) |
| **Rôle actuel** | Le rôle de l'utilisateur connecté |
| **Action recommandée** | Contacter l'administrateur pour obtenir la permission |

**Diagnostic rapide :**

Pour vérifier les permissions d'un utilisateur, l'administrateur peut naviguer vers `/admin/rbac` et consulter la matrice des permissions. La matrice affiche en colonnes les rôles et en lignes les permissions, avec des indicateurs visuels (vert = autorisé, rouge = refusé).

**Cas fréquents pendant le pilote :**

Le profil VIEWER qui tente de créer un scénario recevra une erreur 403 avec la permission `scenarios.create`. Le profil MANAGER qui tente de supprimer un projet recevra une erreur 403 avec la permission `projects.delete`. Ces comportements sont **attendus** et valident le bon fonctionnement du RBAC.

### 8.3 Erreurs MinIO / upload d'artefacts

Les erreurs liées à MinIO/S3 peuvent survenir lors de l'upload des artefacts après une exécution.

| Erreur | Cause probable | Résolution |
|--------|---------------|------------|
| `ECONNREFUSED` | MinIO non démarré | Vérifier `docker ps` pour le conteneur MinIO |
| `NoSuchBucket` | Bucket non créé | Créer le bucket : `mc mb minio/agilestest-artifacts` |
| `AccessDenied` | Credentials incorrects | Vérifier `MINIO_ACCESS_KEY` et `MINIO_SECRET_KEY` dans la config runner |
| `RequestTimeTooSkewed` | Horloge désynchronisée | Synchroniser NTP entre le runner et MinIO |
| `SlowDown` | Trop de requêtes simultanées | Augmenter les limites MinIO ou réduire le parallélisme |

**Vérification de la connectivité MinIO :**

Depuis le serveur hébergeant le runner, exécuter :
```bash
curl -s http://minio:9000/minio/health/live
# Réponse attendue : HTTP 200
```

### 8.4 Erreurs fréquentes du runner

| Erreur | Cause | Résolution |
|--------|-------|------------|
| `RUNNER_OFFLINE` | Runner non connecté à l'orchestrateur | Vérifier `ORCHESTRATION_URL` et la connectivité réseau |
| `SCRIPT_NOT_FOUND` | Aucun script actif pour le scénario | Activer un script dans `/scripts` |
| `BUNDLE_MISSING` | Bundle non résolu pour l'environnement | Vérifier le bundle dans `/bundles` |
| `TIMEOUT` | Exécution dépassant le délai | Augmenter le timeout dans la configuration du profil |
| `CAPTURE_FAILED` | tcpdump non installé ou capabilities manquantes | Vérifier le Dockerfile du runner (tcpdump + NET_ADMIN) |

---

## 9. Critères GO/NOGO

### 9.1 Grille d'évaluation

Les critères GO/NOGO sont évalués à la fin du pilote pour déterminer si la plateforme est prête pour un déploiement élargi.

| # | Critère | Poids | Seuil GO | Méthode de mesure |
|---|---------|-------|----------|-------------------|
| C1 | **Compréhension incident sans assistance** | 25% | ≥ 80% des participants comprennent la cause d'un échec en lisant le rapport d'incident | Questionnaire post-pilote |
| C2 | **Temps gagné vs baseline** | 20% | ≥ 30% de réduction du temps de création de scripts vs écriture manuelle | Chronométrage Parcours 1 vs baseline |
| C3 | **Stabilité des exécutions** | 20% | ≥ 90% de taux de succès sur N runs identiques (N ≥ 5) | Comptage PASSED/FAILED sur runs répétés |
| C4 | **Adoption déclarative** | 15% | ≥ 70% des participants déclarent "je l'utiliserais au quotidien" | Questionnaire Likert 1-5 (score ≥ 4) |
| C5 | **Couverture fonctionnelle** | 10% | 4/4 parcours complétés sans blocage critique | Checklist de parcours |
| C6 | **RBAC opérationnel** | 10% | 100% des restrictions de permission vérifiées | Matrice RBAC testée |

### 9.2 Calcul du score global

Le score global est calculé comme la moyenne pondérée des critères :

```
Score = (C1 × 0.25) + (C2 × 0.20) + (C3 × 0.20) + (C4 × 0.15) + (C5 × 0.10) + (C6 × 0.10)
```

| Résultat | Score | Décision |
|----------|-------|----------|
| **GO** | ≥ 75% | Déploiement élargi validé |
| **GO conditionnel** | 60–74% | Déploiement avec réserves et plan d'action |
| **NOGO** | < 60% | Pilote à refaire après corrections |

### 9.3 Critères bloquants (NOGO immédiat)

Indépendamment du score global, les situations suivantes entraînent un NOGO immédiat :

| Critère bloquant | Description |
|-----------------|-------------|
| Perte de données | Toute perte de données utilisateur (scénarios, datasets, résultats) |
| Faille de sécurité | Accès non autorisé à des ressources protégées (bypass RBAC) |
| Indisponibilité | Plateforme indisponible plus de 15 min pendant le pilote |
| Corruption d'artefacts | Artefacts MinIO corrompus ou inaccessibles |

---

## 10. Annexes

### 10.1 Variables d'environnement

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

### 10.2 Mapping des artefacts attendus par parcours

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
| Drive Test | PCAP | `PCAP` | Capture réseau (si configurée) |
| Repair | Log | `LOG` | Logs de l'exécution réparée |
| Repair | Screenshot | `SCREENSHOT` | Preuves visuelles post-repair |

### 10.3 Liste des permissions clés testées

Le tableau suivant liste les 45 permissions du système, regroupées par domaine fonctionnel, avec le rôle minimum requis :

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
| Admin | Voir utilisateurs | `admin.users.read` | ADMIN |
| Admin | Gérer utilisateurs | `admin.users.manage` | ADMIN |
| Admin | Voir rôles | `admin.roles.read` | ADMIN |
| Admin | Gérer rôles | `admin.roles.manage` | ADMIN |
| Admin | Gérer invitations | `admin.invites.manage` | ADMIN |
| Admin | Voir audit | `admin.audit.read` | ADMIN |
| Admin | Exporter audit | `admin.audit.export` | ADMIN |
| Admin | Gérer memberships | `admin.memberships.manage` | ADMIN |

### 10.4 URLs de navigation principales

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
| Utilisateurs | `/admin/users` | Gestion des utilisateurs |
| Accès projet | `/admin/project-access` | Memberships projet |
| Rôles | `/admin/roles` | Gestion des rôles |
| Matrice RBAC | `/admin/rbac` | Visualisation des permissions |
| Audit | `/admin/audit` | Journal d'audit |
| Documentation | `/docs` | Guides intégrés |

---

> **Fin du Runbook** — Pour les checklists détaillées, voir `PILOT_ORANGE_CHECKLIST.md`. Pour la grille GO/NOGO à remplir, voir `PILOT_ORANGE_GO_NOGO_TEMPLATE.md`.
