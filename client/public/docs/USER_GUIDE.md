# Guide Utilisateur — AgilesTest

## Glossaire

| Terme | Définition |
|-------|-----------|
| **Projet** | Unité organisationnelle regroupant profils, scénarios, datasets et exécutions. Chaque projet cible un domaine applicatif (ex : portail client, API facturation). |
| **Profil de test** | Configuration technique décrivant l'environnement cible : navigateur, résolution, OS, type de test (WEB VABF, API, MOBILE). Un profil contient les paramètres nécessaires à l'exécution. |
| **Scénario** | Cas de test fonctionnel avec un statut DRAFT ou FINAL. Un scénario DRAFT est en cours de rédaction ; un scénario FINAL est verrouillé et prêt pour la génération de scripts et l'exécution. |
| **Dataset Type** | Gabarit structurel définissant les champs attendus pour un type de données de test (ex : `user_credentials`, `payment_card`). Chaque type possède un schéma JSON avec des champs obligatoires et optionnels. |
| **Dataset Instance** | Jeu de données concret remplissant un Dataset Type pour un environnement donné (DEV, PREPROD, PILOT_ORANGE, PROD). Contient les valeurs réelles utilisées lors de l'exécution. |
| **Dataset Bundle** | Regroupement de Dataset Instances couvrant tous les types requis par un scénario. Un bundle est lié à un environnement et possède un statut (DRAFT, ACTIVE, ARCHIVED). |
| **Bundle Resolve** | Opération qui fusionne toutes les instances d'un bundle en un JSON unique, prêt à être consommé par le runner. Les secrets sont remplacés par des placeholders. |
| **Script IA** | Script de test automatisé généré par l'IA à partir du contexte (profil + scénario + bundle). Trois phases : PLAN (stratégie), GEN (code), REPAIR (correction). |
| **Script ACTIVE** | Version de script marquée comme active pour un scénario. C'est cette version qui est automatiquement sélectionnée par le Run Center lors du lancement d'une exécution. |
| **Run Center** | Interface de lancement des exécutions. Permet de sélectionner un scénario, un environnement, un bundle et un runner pour créer une exécution. |
| **Execution** | Instance d'exécution d'un scénario avec un script, un bundle et un environnement. Possède un statut (PENDING, RUNNING, PASSED, FAILED, ERROR, CANCELLED). |
| **Job Runner** | Tâche unitaire assignée à un Runner Agent Docker. Le job contient les références au script, au bundle et à la politique d'upload des artefacts. |
| **Artefact** | Fichier produit lors d'une exécution : log, screenshot, trace Playwright (.zip), vidéo, HAR. Stocké sur MinIO/S3 avec checksum SHA-256. |
| **Incident** | Anomalie détectée lors d'une exécution (assertion échouée, timeout, erreur réseau). Lié à une exécution et à un artefact. |

---

## Accès et permissions

### Membership obligatoire

L'accès à un projet dans AgilesTest nécessite une **membership active**. Sans membership, vous verrez un écran d'erreur 403 avec le message "Accès refusé — Vous n'êtes pas membre de ce projet".

Les memberships sont gérées par les administrateurs depuis **Administration → Accès Projets**. Chaque membership associe un utilisateur à un projet avec un rôle spécifique.

### Rôles et permissions

Chaque utilisateur possède un **rôle global** qui détermine ses permissions sur l'ensemble de la plateforme :

| Rôle | Lecture | Création | Modification | Suppression | Administration |
|------|---------|----------|-------------|-------------|----------------|
| **VIEWER** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **MANAGER** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ |

Les permissions sont **granulaires** : un MANAGER peut créer des scénarios et lancer des exécutions, mais ne peut pas supprimer de projets ni accéder à l'administration.

### Demander l'accès à un projet

Si vous n'avez pas accès à un projet :

1. Contactez un administrateur de la plateforme
2. L'administrateur vous ajoutera comme membre du projet via **Administration → Accès Projets**
3. Vous recevrez un rôle projet (VIEWER, TESTER, MANAGER, LEAD, ADMIN)
4. Rafraîchissez la page pour voir le projet apparaître

> **Astuce** : Si vous voyez un écran 403, notez le `trace_id` affiché et communiquez-le à l'administrateur pour faciliter le diagnostic.

### Comprendre les erreurs 403

Une erreur 403 signifie que votre rôle ne possède pas la permission requise pour l'action tentée. Les causes courantes :

| Situation | Cause probable | Solution |
|-----------|---------------|----------|
| Bouton grisé ou absent | Permission insuffisante pour cette action | Demander un rôle supérieur |
| Page "Accès refusé" | Pas de membership sur ce projet | Demander l'ajout au projet |
| Section admin invisible | Rôle non-ADMIN | Seuls les ADMIN voient la section Administration |
| "Finaliser" désactivé | Rôle VIEWER (lecture seule) | Demander le rôle MANAGER |

---

## Quickstart — Happy Path complet

Ce guide décrit le parcours complet, de la création d'un projet jusqu'à la réparation automatique d'un test échoué.

### Étape 1 — Créer un Projet

Accédez à **Projets** dans la sidebar et cliquez sur **Nouveau projet**. Renseignez le nom, le domaine applicatif et une description. Le projet devient le contexte actif pour toutes les opérations suivantes.

### Étape 2 — Créer un Profil de test

Dans **Profils de test**, créez un profil décrivant l'environnement cible. Sélectionnez le type de test (WEB VABF, API, MOBILE), le navigateur (Chromium, Firefox, WebKit), la résolution et l'OS. Ce profil sera utilisé pour la génération de scripts.

### Étape 3 — Créer ou suggérer des Scénarios

Dans **Scénarios**, vous pouvez créer manuellement un scénario ou utiliser la **suggestion IA**. La suggestion IA analyse le profil et le domaine du projet pour proposer des scénarios pertinents. Importez les suggestions qui vous conviennent.

Chaque scénario contient : un titre, une description, des étapes (steps), des critères d'acceptation, et la liste des `required_dataset_types` (types de données nécessaires).

### Étape 4 — Finaliser le Scénario

Un scénario en statut **DRAFT** peut être modifié librement. Une fois satisfait, cliquez sur **Finaliser** pour le passer en statut **FINAL**. Un scénario FINAL est verrouillé : il ne peut plus être modifié (sauf par un Admin qui peut le repasser en DRAFT).

> **Important** : Seuls les scénarios FINAL peuvent être utilisés pour la génération de scripts et l'exécution.

### Étape 5 — Créer des Dataset Instances

Dans **Datasets (Instances)**, créez les jeux de données nécessaires pour chaque environnement. Pour chaque `required_dataset_type` du scénario :

1. Cliquez sur **Nouvelle instance**
2. Sélectionnez le type (ex : `user_credentials`)
3. Choisissez l'environnement cible (DEV, PREPROD, PILOT_ORANGE, PROD)
4. Remplissez les champs via le formulaire ou l'éditeur JSON
5. Activez l'instance (statut ACTIVE)

Pour les données sensibles (mots de passe, tokens), utilisez la section **Secrets** : les valeurs sont masquées dans l'UI et ne sont jamais exposées dans les prompts IA.

### Étape 6 — Créer un Bundle par environnement

Dans **Bundles**, créez un bundle pour chaque environnement cible :

1. Cliquez sur **Nouveau bundle**
2. Nommez-le (ex : "Bundle DEV - Login complet")
3. Sélectionnez l'environnement
4. Ajoutez les dataset instances correspondantes
5. Validez la compatibilité avec le scénario (le système vérifie que tous les types requis sont couverts)
6. Passez le bundle en statut **ACTIVE**

> **Règle** : Un bundle ne peut contenir qu'une seule instance par type de dataset. Le système empêche les doublons.

### Étape 7 — Générer un Script IA et l'activer

Dans le détail d'un scénario (section **Scripts IA**), deux options :

- **Générer Prompt** : affiche le prompt complet prêt à être copié dans un LLM externe
- **Générer Script** : lance la génération automatique (simulée en MVP)

Le script généré apparaît dans **Scripts Générés** avec un numéro de version. Pour l'utiliser en exécution, cliquez sur **Activer** pour le marquer comme ACTIVE.

> **Note** : La génération de scripts est actuellement **simulée** (MVP). Le prompt est réel et peut être utilisé avec un LLM externe.

### Étape 8 — Lancer une exécution (Run Center)

Dans **Exécutions** (Run Center) :

1. Sélectionnez le scénario
2. Le script ACTIVE est automatiquement sélectionné (modifiable par Admin/Manager)
3. Choisissez l'environnement cible
4. Sélectionnez le bundle compatible
5. Choisissez le runner (si disponible)
6. Cliquez sur **Lancer l'exécution**

Le système crée une exécution et un job PENDING. Le Runner Agent Docker récupère le job, exécute le script Playwright, et uploade les artefacts vers MinIO/S3.

> **Blocage** : Si aucun script ACTIVE n'existe pour le scénario, le bouton de lancement est désactivé.

### Étape 9 — Consulter le détail d'exécution

Cliquez sur une exécution pour voir :

- **Statut** : PENDING → RUNNING → PASSED/FAILED/ERROR
- **Contexte** : durée, environnement, script (framework + version), bundle, runner
- **Runner Job** : statut du job, runner assigné, politique d'upload, métriques (passed/failed/skipped)
- **Artefacts** : logs, screenshots (avec preview), traces, vidéos — avec indicateur de stockage (local ou MinIO/S3) et checksum SHA-256
- **Incidents** : liste des anomalies détectées

### Étape 10 — Repair from failure (si FAILED)

Si l'exécution est en statut **FAILED**, un panneau **Repair from failure** apparaît :

1. Le système collecte les artefacts d'échec (logs, screenshots, incidents)
2. Cliquez sur **Lancer le repair IA**
3. L'IA analyse les erreurs et propose un patch (diff viewer)
4. Consultez les fichiers modifiés et la justification (rationale)
5. Deux options :
   - **Save as new version** : crée une nouvelle version du script
   - **Activate & Rerun** : active la nouvelle version ET relance immédiatement l'exécution

> **Note** : Le repair IA est actuellement **simulé** (MVP). Les patches proposés sont des exemples.

---

## Page Scripts Générés

La page **Scripts Générés** (`/scripts`) liste tous les scripts créés par l'IA :

| Colonne | Description |
|---------|-------------|
| Scénario | Scénario source du script |
| Framework | Framework de test utilisé (Playwright, Cypress, etc.) |
| Version | Numéro de version incrémental |
| Statut | DRAFT, ACTIVE, ARCHIVED, REPAIR |
| Fichiers | Nombre de fichiers dans le package |
| Date | Date de création |

**Actions disponibles** :
- **Voir** : affiche le contenu des fichiers avec coloration syntaxique
- **Activer** : marque le script comme ACTIVE (désactive la version précédente)
- **Supprimer** : supprime le script (Admin uniquement)

**Bonnes pratiques pour les scripts** :
- Ne pas utiliser de sélecteurs CSS hardcodés (préférer `data-testid`)
- Utiliser les clés du dataset pour les données dynamiques (ex : `dataset.user_credentials.email`)
- Chaque script doit être autonome et reproductible

---

## Artefacts d'exécution

Les artefacts sont les fichiers produits lors d'une exécution de test. Ils sont stockés sur MinIO/S3 et accessibles depuis le détail d'exécution.

| Type | Extension | Description |
|------|-----------|-------------|
| LOG | `.log`, `.txt` | Logs d'exécution Playwright (stdout/stderr) |
| SCREENSHOT | `.png`, `.jpg` | Captures d'écran (échec ou systématique) |
| TRACE | `.zip` | Trace Playwright complète (replay détaillé) |
| VIDEO | `.mp4`, `.webm` | Enregistrement vidéo de l'exécution |
| HAR | `.har` | HTTP Archive (requêtes réseau capturées) |

Chaque artefact possède un **checksum SHA-256** calculé avant l'upload, garantissant l'intégrité des données. Le checksum est affiché sous le nom de fichier dans le tableau des artefacts.

Les screenshots disposent d'un bouton **Preview** pour un affichage rapide dans un nouvel onglet. Tous les artefacts peuvent être téléchargés via le bouton **Download**.
