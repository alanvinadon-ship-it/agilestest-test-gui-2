# Templates de scénarios — Publication communautaire

## Vue d'ensemble

Le système de templates permet de **publier un scénario de test** comme template communautaire réutilisable. Tout utilisateur authentifié peut parcourir les templates publiés, les forker dans ses projets, les noter et les commenter.

## Format JSON du snapshot

Chaque template publié contient un champ `template_json` qui stocke un snapshot versionné complet du scénario et de son profil associé au moment de la publication.

```json
{
  "schemaVersion": 1,
  "scenario": {
    "name": "Enregistrement SIP IMS",
    "description": "Test d'enregistrement SIP sur plateforme IMS",
    "testType": "VABF",
    "steps": [
      { "order": 1, "action": "REGISTER", "method": "SIP", "description": "Envoi REGISTER" }
    ],
    "requiredDatasetTypes": ["SIP_CREDENTIALS"],
    "artifactPolicy": { "capturePackets": true },
    "kpiThresholds": { "responseTime": 500 }
  },
  "profile": {
    "name": "Profil SIP IMS",
    "protocol": "SIP",
    "domain": "IMS",
    "profileType": "STANDARD",
    "parameters": { "transport": "UDP", "port": 5060 }
  },
  "exportedAt": "2026-02-27T10:00:00.000Z"
}
```

Le champ `schemaVersion` permet de gérer les évolutions futures du format sans casser la compatibilité ascendante.

## Versioning

Le champ `version` (entier, défaut 1) sur la table `scenario_templates` est incrémenté à chaque republication. Le `template_json` est recréé à chaque publication, ce qui constitue un snapshot immuable de la version courante.

## Modèle de données

| Colonne | Type | Description |
|---------|------|-------------|
| `uid` | VARCHAR(36) PK | Identifiant UUID unique |
| `org_id` | VARCHAR(36) | Identifiant de l'organisation du créateur |
| `scenario_uid` | VARCHAR(36) | UID du scénario source |
| `name` | VARCHAR(255) | Nom du template |
| `description` | TEXT | Description détaillée |
| `tags_json` | JSON | Tableau de tags (ex: `["IMS", "SIP", "registration"]`) |
| `version` | INT | Numéro de version (incrémenté à chaque republication) |
| `template_json` | JSON | Snapshot JSON complet versionné (voir format ci-dessus) |
| `visibility` | ENUM | `PUBLIC` ou `UNLISTED` |
| `status` | ENUM | `PUBLISHED` ou `UNPUBLISHED` |
| `created_by` | VARCHAR(64) | OpenID de l'auteur |
| `domain` | VARCHAR(50) | Domaine technique (IMS, 5GC, API_REST, etc.) |
| `test_type` | VARCHAR(20) | Type de test (VABF, VSR, VABE) |
| `avg_rating` | DECIMAL(3,2) | Note moyenne (calculée) |
| `rating_count` | INT | Nombre de votes |
| `usage_count` | INT | Nombre de forks/imports |
| `created_at` | TIMESTAMP | Date de création |
| `updated_at` | TIMESTAMP | Date de dernière modification |

### Index

| Index | Colonnes | Usage |
|-------|----------|-------|
| `idx_status_created` | `(status, created_at DESC)` | Listing des templates publiés |
| `idx_org_created` | `(org_id, created_at DESC)` | Templates par organisation |

## Contrôle d'accès (RBAC)

| Action | Rôles autorisés | Condition |
|--------|----------------|-----------|
| `publish` | Tout utilisateur authentifié | Doit être membre du projet contenant le scénario |
| `unpublish` | Auteur ou Admin | `createdBy` ou `publishedByOpenId` doit correspondre, ou rôle `admin` |
| `listPublic` | Tout utilisateur authentifié | Filtre automatique `status = PUBLISHED` |
| `get` | Tout utilisateur authentifié | Retourne les détails, ratings et commentaires |
| `forkToProject` | Tout utilisateur authentifié | Doit avoir un projet sélectionné |
| `rate` | Tout utilisateur authentifié | Upsert : une seule note par utilisateur par template |
| `addComment` | Tout utilisateur authentifié | — |
| `deleteComment` | Auteur du commentaire | `userOpenId` doit correspondre |

## Endpoints tRPC

### `scenarioTemplates.publish`

Publie un scénario comme template communautaire.

**Input :**
```typescript
{
  scenarioUid: string;      // UID du scénario source
  name: string;             // Nom du template
  description: string;      // Description
  tags: string[];           // Tags
  visibility: "PUBLIC" | "UNLISTED";
}
```

**Output :** `{ templateUid: string }`

### `scenarioTemplates.unpublish`

Dépublie un template (auteur ou admin uniquement).

**Input :** `{ templateUid: string }`

**Output :** `{ ok: true }`

### `scenarioTemplates.listPublic`

Liste les templates communautaires publiés avec pagination.

**Input :**
```typescript
{
  page?: number;          // Défaut: 1
  pageSize?: number;      // Défaut: 20, max: 100
  search?: string;        // Recherche texte (nom + description)
  tags?: string[];        // Filtre par tags (AND)
  domain?: string;        // Filtre par domaine
  testType?: string;      // Filtre par type de test
}
```

**Output :** `{ items: Template[], total: number, page: number, pageSize: number }`

### `scenarioTemplates.get`

Récupère un template avec ses ratings et commentaires.

**Input :** `{ templateUid: string }`

**Output :** Template complet avec `ratings[]` et `comments[]`

### `scenarioTemplates.forkToProject`

Crée un nouveau scénario dans un projet à partir d'un template publié.

**Input :**
```typescript
{
  templateUid: string;       // UID du template source
  projectUid: string;        // UID du projet cible
  scenarioName?: string;     // Nom personnalisé (optionnel)
  createProfile?: boolean;   // Créer aussi le profil associé (défaut: true)
}
```

**Output :** `{ scenarioUid: string, scenarioName: string, profileUid: string | null, templateDomain: string }`

### `scenarioTemplates.rate`

Note un template (1-5, upsert par utilisateur).

**Input :** `{ templateUid: string, rating: number }`

### `scenarioTemplates.addComment` / `deleteComment`

Ajoute ou supprime un commentaire sur un template.

## Interface utilisateur

### Publication (ScenariosPage)

Un bouton **"Publier"** est disponible dans le menu d'actions de chaque scénario. Il ouvre une modal permettant de saisir le nom, la description, les tags et la visibilité avant publication.

### Exploration (ScenarioTemplatesPage)

La page Templates dispose de deux onglets :

- **Tous les templates** : templates built-in et communautaires publiés, groupés par domaine
- **Communauté** : uniquement les templates publiés par les utilisateurs, avec pagination

Chaque template peut être déplié pour voir les détails (étapes, datasets requis, KPI), noter, commenter, et forker/importer.

### Dépublication

Un bouton **"Dépublier"** apparaît dans la vue détaillée pour l'auteur du template ou un administrateur.
