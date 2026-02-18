# Guide Administration — AgilesTest

## Contrôle d'accès (RBAC)

AgilesTest implémente un contrôle d'accès basé sur les rôles (RBAC) à deux niveaux : **rôles globaux** (plateforme) et **rôles projet** (par projet). Les permissions sont appliquées par module.

### Rôles globaux

| Rôle | Description | Accès admin |
|------|-------------|-------------|
| **Admin** | Accès complet à toute la plateforme, y compris l'administration | Oui |
| **Manager** | Création, modification et exécution sur tous les projets | Non |
| **Viewer** | Lecture seule sur tous les projets | Non |

### Rôles projet

| Rôle | Description |
|------|-------------|
| **Admin Projet** | Gestion complète du projet, y compris suppression de ressources |
| **Éditeur** | Création, modification et exécution dans le projet |
| **Lecteur Projet** | Lecture seule dans le projet |

### Résolution des permissions

La permission effective est l'**union** du rôle global et du rôle projet. Le rôle le plus permissif l'emporte. Par exemple, un Viewer global avec le rôle Éditeur sur un projet peut éditer les ressources de ce projet uniquement.

### Matrice des permissions (rôles globaux)

| Module | Viewer | Manager | Admin |
|--------|--------|---------|-------|
| **Projets** | READ | READ, CREATE, UPDATE | READ, CREATE, UPDATE, DELETE |
| **Profils de test** | READ | READ, CREATE, UPDATE | READ, CREATE, UPDATE, DELETE |
| **Scénarios** | READ | READ, CREATE, UPDATE, ACTIVATE | READ, CREATE, UPDATE, DELETE, ACTIVATE |
| **Datasets** | READ | READ, CREATE, UPDATE, ACTIVATE | READ, CREATE, UPDATE, DELETE, ACTIVATE |
| **Bundles** | READ | READ, CREATE, UPDATE, ACTIVATE | READ, CREATE, UPDATE, DELETE, ACTIVATE |
| **Scripts IA** | READ | READ, CREATE, ACTIVATE | READ, CREATE, DELETE, ACTIVATE |
| **Exécutions** | READ | READ, RUN | READ, RUN, DELETE |
| **Repair** | READ | READ, REPAIR | READ, REPAIR, ACTIVATE |
| **Administration** | — | — | READ, CREATE, UPDATE, DELETE |

> La matrice complète est consultable dans l'interface via **Administration > Matrice RBAC**, avec un toggle entre rôles globaux et rôles projet.

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

Les filtres disponibles sont : recherche par nom/email, filtre par rôle, filtre par statut (Actif/Désactivé).

### Accès Projets (/admin/project-access)

Cette page permet de gérer les membres de chaque projet :

- **Sélectionner** un projet dans la liste déroulante
- **Ajouter** un membre avec recherche typeahead (par nom ou email)
- **Modifier** le rôle projet d'un membre existant
- **Retirer** un membre du projet (avec protection : impossible de retirer le dernier Admin Projet)

Chaque membre affiche son rôle global et son rôle projet côte à côte pour une visibilité complète.

### Matrice RBAC (/admin/rbac)

Cette page est **informative** (lecture seule). Elle affiche la matrice complète des permissions par module, avec un toggle entre rôles globaux et rôles projet. Chaque permission est colorée par type (READ, CREATE, UPDATE, DELETE, RUN, ACTIVATE, REPAIR).

### Journal d'audit (/admin/audit)

Cette page affiche l'historique des actions d'administration :

- Création, modification, désactivation, réactivation d'utilisateurs
- Ajout, modification, retrait de memberships
- Réinitialisation de mots de passe

Chaque entrée contient : horodatage, action, cible, acteur, trace ID et metadata détaillée (expandable). Les filtres disponibles sont : type d'entité (utilisateur/membership), recherche par acteur, nombre d'entrées.

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

Seul un **Admin** peut repasser un scénario FINAL en DRAFT. Cette action est journalisée et doit être justifiée (ex : correction d'une erreur dans les étapes).

### Règles d'activation des scripts

Un seul script peut être ACTIVE par scénario à un instant donné. L'activation d'une nouvelle version désactive automatiquement la version précédente. Le Run Center sélectionne toujours le script ACTIVE.

Un **Manager** ou **Admin** peut changer la version active. Un **Viewer** ne peut que consulter les scripts.

### Règles d'activation des bundles

Un bundle ACTIVE est celui utilisé par défaut pour un environnement donné. Plusieurs bundles peuvent être ACTIVE simultanément (un par environnement). Le Run Center filtre les bundles compatibles avec le scénario et l'environnement sélectionnés.

---

## Gestion des Secrets

### DatasetSecretKey

Les `DatasetSecretKey` permettent de stocker des valeurs sensibles (mots de passe, tokens, clés API) associées à une dataset instance. Les secrets sont identifiés par une clé unique et liés à un environnement.

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
