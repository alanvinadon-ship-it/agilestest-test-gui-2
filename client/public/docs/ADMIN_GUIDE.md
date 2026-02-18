# Guide Administration — AgilesTest

## Contrôle d'accès (RBAC)

AgilesTest implémente un contrôle d'accès basé sur les rôles (RBAC) avec trois niveaux : **Viewer**, **Manager** et **Admin**. Les permissions sont appliquées par module.

### Matrice des permissions

| Module | Viewer | Manager | Admin |
|--------|--------|---------|-------|
| **Projets** | Lecture | Création, modification | Suppression, transfert |
| **Profils de test** | Lecture | Création, modification | Suppression |
| **Scénarios** | Lecture | Création, modification, finalisation | Suppression, repasser en DRAFT |
| **Dataset Instances** | Lecture | Création, modification, activation | Suppression, override |
| **Dataset Bundles** | Lecture | Création, modification, activation | Suppression, override |
| **Dataset Secrets** | Lecture (masqué) | Création, modification | Suppression |
| **Scripts IA** | Lecture, copie prompt | Génération, activation | Suppression |
| **Exécutions** | Lecture | Lancement, rerun | Annulation, suppression |
| **Repair** | Lecture du diff | Lancement repair, save version | Activate & Rerun |

### Comptes par défaut (démo)

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

### Quand utiliser chaque mode

Le mode **local** (par défaut) est adapté aux démonstrations, au développement et aux situations où aucun backend n'est disponible. Les données sont stockées dans le `localStorage` du navigateur et ne sont pas partagées entre utilisateurs.

Le mode **api** est recommandé pour la production. Il nécessite que le Repository API soit opérationnel et accessible. Les données sont persistées en base de données et partagées entre tous les utilisateurs du projet.

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
