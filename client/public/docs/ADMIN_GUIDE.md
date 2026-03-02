# Guide d'administration

## Contrôle d'accès (RBAC)

AgilesTest implémente un contrôle d'accès basé sur les rôles (RBAC) à deux niveaux : **rôles globaux** (plateforme) et **rôles projet** (par projet). Les permissions sont définies dans un **catalogue centralisé** (`PermissionKey`) et vérifiées via la fonction `hasPermission()`.

### Catalogue de permissions (PermissionKey)

Chaque action de la plateforme est identifiée par une clé unique au format `module.action`. Le catalogue contient 45+ permissions réparties en 11 groupes :

| Groupe | Exemples de clés | Description |
|--------|-----------------|-------------|
| **Projets** | `projects.read`, `projects.create`, `projects.delete` | CRUD projets |
| **Profils** | `profiles.read`, `profiles.create` | CRUD profils de test |
| **Scénarios** | `scenarios.read`, `scenarios.activate` | CRUD + activation scénarios |
| **Datasets** | `datasets.read`, `datasets.secrets.read`, `datasets.export` | CRUD + secrets + export |
| **Bundles** | `bundles.read`, `bundles.resolve` | CRUD + résolution |
| **Scripts IA** | `scripts.read`, `scripts.create`, `scripts.activate` | Génération + activation |
| **Exécutions** | `executions.read`, `executions.run`, `executions.rerun` | Lancement + relance |
| **Repair** | `repair.read`, `repair.launch`, `repair.activate` | Réparation IA |
| **Runners** | `runners.read`, `runners.register`, `runners.disable` | Gestion runners |
| **Drive Test** | `drive.campaigns.read`, `drive.reporting.read` | Campagnes + reporting |
| **Admin** | `admin.users.manage`, `admin.roles.manage`, `admin.audit.export` | Administration |

### Rôles système (non modifiables)

| Rôle | Scope | Permissions | Accès admin |
|------|-------|-------------|-------------|
| **Admin** | GLOBAL | Toutes (override total) | Oui |
| **Manager** | GLOBAL | Tout sauf admin et suppression | Non |
| **Viewer** | GLOBAL | Lecture seule sur tous les modules | Non |
| **Admin Projet** | PROJECT | CRUD complet + suppression + secrets | Non |
| **Éditeur Projet** | PROJECT | Création, modification, exécution | Non |
| **Lecteur Projet** | PROJECT | Lecture seule dans le projet | Non |

### Rôles custom (éditables)

Les administrateurs peuvent créer des **rôles personnalisés** depuis la page **Administration > Rôles & Permissions**. Chaque rôle custom :

- A un scope (GLOBAL ou PROJECT)
- Possède un ensemble de permissions sélectionnées via multi-select par groupe
- Peut être assigné aux utilisateurs (rôle global) ou aux memberships (rôle projet)
- Est supprimable uniquement s'il n'est pas utilisé par des utilisateurs ou memberships

### Résolution des permissions

La fonction `hasPermission(user, key, {projectId})` applique la logique suivante :

1. **ADMIN global** → `true` (override total, court-circuite tout)
2. **Si `projectId` fourni** → cherche le membership du user sur ce projet, vérifie les permissions du rôle projet
3. **Sinon** → vérifie les permissions du rôle global

Le hook React `usePermission(projectId?)` expose : `can(key)`, `canAll(keys)`, `canAny(keys)`, `hasAccess(pid)`, `effectivePermissions`, `isAdmin`.

### Verrouillage d'accès projet (RequireProjectAccess)

Toutes les routes project-scoped (`/projects/:id/*`, `/profiles`, `/scenarios`, `/datasets`, `/bundles`, `/scripts`, `/executions`, `/drive/*`) sont protégées par le guard `RequireProjectAccess`. Un utilisateur sans membership sur le projet actif est redirigé vers la page projets avec un message d'erreur.

---

## Pages d'administration

Les pages d'administration sont accessibles uniquement aux utilisateurs avec le rôle **Admin** global. Elles apparaissent dans la sidebar sous la section "Administration" (en rouge).

### Utilisateurs (/admin/users)

Cette page permet de gérer les comptes utilisateurs de la plateforme :

- **Créer** un utilisateur (nom, email, rôle global, mot de passe optionnel)
- **Modifier** un utilisateur (nom, email, rôle)
- **Désactiver** un utilisateur (l'empêche de se connecter, réversible)
- **Réactiver** un utilisateur désactivé
- **Réinitialiser le mot de passe** (envoie un lien de réinitialisation)
- **Voir les projets** d'un utilisateur (drawer latéral avec ses memberships)
- **Inviter** un utilisateur par email (voir section Invitations ci-dessous)
- **Voir les invitations** en attente (drawer latéral)

Les filtres disponibles sont : recherche par nom/email, filtre par rôle, filtre par statut (Actif/Désactivé).

### Rôles & Permissions (/admin/roles)

Cette page permet de gérer les rôles de la plateforme :

- **Visualiser** les rôles système (non modifiables, marqués d'un cadenas)
- **Créer** un rôle custom (nom, description, scope GLOBAL/PROJECT, permissions)
- **Modifier** un rôle custom (sélection de permissions par groupe via multi-select)
- **Supprimer** un rôle custom (uniquement s'il n'est pas utilisé)

L'interface affiche les permissions par groupe avec des badges colorés et un compteur de permissions sélectionnées.

### Accès Projets (/admin/project-access)

Cette page permet de gérer les membres de chaque projet :

- **Sélectionner** un projet dans la liste déroulante
- **Ajouter** un membre avec recherche typeahead (par nom ou email)
- **Modifier** le rôle projet d'un membre existant (y compris les rôles custom)
- **Retirer** un membre du projet (avec protection : impossible de retirer le dernier Admin Projet)

Chaque membre affiche son rôle global et son rôle projet côte à côte pour une visibilité complète.

### Matrice RBAC (/admin/rbac)

Cette page affiche la **matrice dynamique** des permissions réelles par rôle :

- Toggle entre rôles globaux, rôles projet, ou tous
- Recherche de permissions par nom ou clé
- Affichage par groupe (Projets, Profils, Scénarios, etc.)
- Indicateur système/custom pour chaque rôle
- Résumé par rôle avec barre de progression (% de permissions)
- Les rôles custom créés depuis la page Rôles apparaissent automatiquement

### Journal d'audit (/admin/audit)

Cette page affiche l'historique complet des actions d'administration avec des **filtres enrichis** :

- **Filtre par acteur** : recherche par nom ou email
- **Filtre par type d'entité** : utilisateur, membership, invitation, rôle, accès
- **Filtre par action** : 16 types d'actions (création, modification, désactivation, invitation, etc.)
- **Filtre par date** : plage de dates (début/fin)
- **Limite** : 25 à 500 entrées

Fonctionnalités supplémentaires :

- **Statistiques** : panneau toggle avec total, distribution par action (cliquable pour filtrer), top acteurs
- **Export JSON** : télécharge les entrées filtrées en JSON
- **Export CSV** : télécharge les entrées filtrées en CSV avec headers
- **Metadata expandable** : chaque entrée affiche ses détails (acteur, trace ID, entity, metadata JSON)

---

## Invitations

### Workflow INVITED → ACTIVE

Le système d'invitations permet d'ajouter des utilisateurs par email :

1. L'admin envoie une invitation (email, rôle global, message optionnel)
2. Un token unique est généré (validité : 7 jours)
3. L'invité reçoit un email avec un lien d'activation
4. L'invité clique sur le lien et crée son compte
5. Le statut passe de INVITED à ACTIVE

### Gestion des invitations

Depuis la page Utilisateurs, l'admin peut :

- **Envoyer** une invitation (avec validation email et vérification de doublons)
- **Voir** les invitations en attente (drawer latéral)
- **Renvoyer** une invitation expirée (génère un nouveau token)
- **Révoquer** une invitation en attente

### Statuts d'invitation

| Statut | Description |
|--------|-------------|
| **PENDING** | Invitation envoyée, en attente d'acceptation |
| **ACCEPTED** | Invitation acceptée, compte créé |
| **EXPIRED** | Token expiré (> 7 jours), peut être renvoyé |
| **REVOKED** | Invitation annulée par un admin |

---

## Comptes par défaut (démo)

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| `admin@agilestest.io` | `admin123` | Admin |
| `manager@agilestest.io` | `manager123` | Manager |
| `viewer@agilestest.io` | `viewer123` | Viewer |

> **Important** : En production, ces comptes doivent être désactivés et remplacés par des comptes nominatifs avec authentification forte.

---

## Modes de stockage des Datasets

La variable d'environnement `VITE_DATASET_STORAGE_MODE` contrôle la source de persistance des dataset instances, bundles, items et secrets.

### Comparaison des modes

| Aspect | `local` | `api` |
|--------|---------|-------|
| **Persistance** | localStorage du navigateur | Base de données via Repository API |
| **Multi-utilisateur** | Non (données locales à chaque navigateur) | Oui (données partagées) |
| **Perte de données** | Si le navigateur est réinitialisé | Non (persistance serveur) |
| **Cas d'usage** | Démo, développement, tests offline | Production, équipes |
| **Configuration** | Aucune | Nécessite Repository API opérationnel |

### Configuration

Le switch se fait via la variable d'environnement :

```
VITE_DATASET_STORAGE_MODE=local   # Défaut — localStorage
VITE_DATASET_STORAGE_MODE=api     # Production — Repository API
```

Le `DatasetStorageAdapter` gère automatiquement le routage vers le bon backend. En mode `api`, un fallback vers le localStorage est activé en cas d'indisponibilité du serveur.

---

## Gouvernance

### Règles de finalisation des scénarios

Un scénario en statut **FINAL** est verrouillé : aucune modification n'est possible sur les étapes, les critères d'acceptation ou les dataset types requis. Cette règle garantit la traçabilité entre le scénario validé et les scripts générés.

Seul un utilisateur avec la permission `scenarios.activate` peut repasser un scénario FINAL en DRAFT. Cette action est journalisée et doit être justifiée.

### Règles d'activation des scripts

Un seul script peut être ACTIVE par scénario à un instant donné. L'activation d'une nouvelle version désactive automatiquement la version précédente. Le Run Center sélectionne toujours le script ACTIVE.

Un utilisateur avec `scripts.activate` peut changer la version active. Un utilisateur avec uniquement `scripts.read` ne peut que consulter les scripts.

### Règles d'activation des bundles

Un bundle ACTIVE est celui utilisé par défaut pour un environnement donné. Plusieurs bundles peuvent être ACTIVE simultanément (un par environnement). Le Run Center filtre les bundles compatibles avec le scénario et l'environnement sélectionnés.

---

## Gestion des Secrets

### DatasetSecretKey

Les `DatasetSecretKey` permettent de stocker des valeurs sensibles (mots de passe, tokens, clés API) associées à une dataset instance. Les secrets sont identifiés par une clé unique et liés à un environnement. L'accès aux secrets requiert la permission `datasets.secrets.read`.

### Masquage dans l'UI

Les valeurs des secrets sont **toujours masquées** dans l'interface utilisateur. Seuls les 4 derniers caractères sont affichés (ex : `••••••••ab12`). L'utilisateur peut temporairement révéler la valeur via un bouton "Afficher".

### Restrictions d'export

Les secrets ne sont **jamais inclus** dans les exports de données (CSV, JSON). Lors du Bundle Resolve, les secrets sont remplacés par des placeholders `{{SECRET:key_name}}` dans le JSON fusionné. L'injection réelle se fait via variables d'environnement côté Runner.

### Bonnes pratiques

- Ne jamais inclure de secrets en clair dans les prompts IA (le système les exclut automatiquement via `buildAiScriptContext`)
- Utiliser des secrets différents par environnement (DEV vs PROD)
- Renouveler régulièrement les secrets de test
- Ne pas réutiliser des secrets de production dans les environnements de test

---

## Environnements

AgilesTest supporte quatre environnements cibles, chacun avec ses conventions.

### Conventions par environnement

| Environnement | Code | Usage | Données |
|---------------|------|-------|---------|
| **DEV** | `DEV` | Développement, tests unitaires | Données fictives, services mockés |
| **PREPROD** | `PREPROD` | Validation pré-production | Données anonymisées, services réels |
| **PILOT ORANGE** | `PILOT_ORANGE` | Pilote client Orange | Données de pilote, accès restreint |
| **PROD** | `PROD` | Production | Données réelles, monitoring actif |

### Conventions de nommage des bundles

Il est recommandé de nommer les bundles selon la convention : `{Scénario} - {Environnement} - {Variante}`. Par exemple :

- "Login standard - DEV - Nominal"
- "Login standard - PREPROD - Cas erreur"
- "Paiement CB - PROD - Visa"

### Conventions de nommage des dataset instances

Les instances doivent être nommées de manière à identifier rapidement leur contenu et leur environnement :

- "Utilisateur admin - DEV"
- "Carte Visa test - PREPROD"
- "Credentials API facturation - PROD"
