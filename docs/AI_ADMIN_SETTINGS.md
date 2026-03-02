# Configuration IA — Guide d'administration

## Vue d'ensemble

AgilesTest permet de configurer le fournisseur IA (OpenAI, Azure OpenAI, Anthropic, Custom HTTP) directement depuis l'interface d'administration. Les clés API sont chiffrées au repos (AES-256-GCM) et ne sont jamais exposées côté frontend.

## Modes de fonctionnement

### Mode DB (par défaut)

La configuration IA est stockée en base de données, chiffrée, et gérée via la page **Administration > Clés IA**. Chaque organisation peut définir son propre fournisseur et sa propre clé API.

**Prérequis** : la clé maître `AI_CONFIG_MASTER_KEY` doit être provisionnée (voir section ci-dessous).

### Mode ENV (verrouillé)

Si `AI_CONFIG_LOCKED=true`, la configuration provient exclusivement des variables d'environnement. L'interface est en lecture seule (affiche le statut, permet de tester la connexion, mais interdit toute modification).

### Priorité de résolution

```
1. AI_CONFIG_LOCKED=true → ENV uniquement
2. Config DB existante et enabled → DB (clé déchiffrée)
3. Sinon → ENV (BUILT_IN_FORGE_API_KEY / BUILT_IN_FORGE_API_URL)
```

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `AI_CONFIG_MASTER_KEY` | Oui (si mode DB) | Clé de chiffrement AES-256 en hexadécimal (64 caractères) |
| `AI_CONFIG_MASTER_KEY_FILE` | Alternative | Chemin vers un fichier contenant la clé hex (Docker secrets) |
| `AI_CONFIG_LOCKED` | Non | `true` pour verrouiller en mode ENV-only |
| `BUILT_IN_FORGE_API_KEY` | Non | Clé API fallback (mode ENV) |
| `BUILT_IN_FORGE_API_URL` | Non | URL API fallback (mode ENV) |

## Provisionnement de la clé maître (Docker)

### Étape 1 — Générer la clé

```bash
# Générer une clé AES-256 (32 bytes = 64 hex chars)
openssl rand -hex 32 > deploy/docker/secrets/ai_config_master_key.txt
```

Le fichier doit contenir exactement 64 caractères hexadécimaux, sans retour à la ligne superflu.

### Étape 2 — Vérifier le .gitignore

Le fichier `deploy/docker/secrets/*.txt` est automatiquement ignoré par git. Seul le fichier `.example` est versionné :

```
deploy/docker/secrets/*.txt        # ignoré
deploy/docker/secrets/*.txt.example # versionné (placeholder)
```

### Étape 3 — Docker Compose

Le `docker-compose.prod.yml` est déjà configuré pour injecter le secret :

```yaml
secrets:
  ai_config_master_key:
    file: ./deploy/docker/secrets/ai_config_master_key.txt

services:
  backend:
    environment:
      AI_CONFIG_MASTER_KEY_FILE: /run/secrets/ai_config_master_key
    secrets:
      - ai_config_master_key
```

### Étape 4 — Redémarrer la stack

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### Étape 5 — Vérifier

Ouvrir **Administration > Clés IA** :
- La bannière rouge "Clé de chiffrement manquante" doit avoir disparu.
- Le champ "Source active" doit indiquer `ENV` ou `DB`.
- L'enregistrement d'une clé API doit fonctionner.

### Provisionnement sans Docker (développement / VM)

Pour les environnements sans Docker, définir directement la variable d'environnement :

```bash
export AI_CONFIG_MASTER_KEY=$(openssl rand -hex 32)
```

Ou via un fichier `.env.prod` :

```
AI_CONFIG_MASTER_KEY=<64_hex_chars>
```

## Lecture du secret (readSecret)

Le backend utilise un utilitaire `readSecret(key)` qui résout les secrets selon cette priorité :

1. `<KEY>_FILE` → lit le contenu du fichier (Docker secrets pattern)
2. `<KEY>` → lit la variable d'environnement directe
3. Retourne `undefined` si aucun n'est défini

Ce mécanisme permet de supporter à la fois Docker secrets et les variables d'environnement classiques sans modification de code.

## Endpoint configStatus

L'endpoint `aiSettings.configStatus` fournit un diagnostic rapide sans exposer de données sensibles :

```typescript
// Réponse
{
  missingMasterKey: boolean,  // true si master key absente (mode DB)
  locked: boolean,            // true si AI_CONFIG_LOCKED=true
  source: "DB" | "ENV" | "DISABLED",
  hasSecret: boolean,         // true si une clé API est configurée
}
```

L'UI utilise ce endpoint pour afficher/masquer les bannières d'avertissement.

## Rotation de la clé maître

**Avertissement** : ne jamais changer la clé maître en production sans re-chiffrer les clés existantes. Toutes les clés API chiffrées avec l'ancienne clé deviendront illisibles.

Procédure de rotation :

1. Générer une nouvelle clé : `openssl rand -hex 32`
2. Déchiffrer toutes les clés API existantes avec l'ancienne clé maître
3. Mettre à jour `AI_CONFIG_MASTER_KEY` avec la nouvelle clé
4. Re-chiffrer toutes les clés API avec la nouvelle clé maître
5. Redémarrer l'application

**Script de vérification :**

```sql
-- Lister les configs avec clé chiffrée
SELECT id, org_id, secret_ciphertext FROM ai_provider_configs
WHERE secret_ciphertext IS NOT NULL;
```

Pour chaque entrée, utiliser l'API `rotateKey` ou un script serveur dédié.

## Rotation de la clé API fournisseur

Via l'interface :

1. Aller dans **Administration > Clés IA**
2. Cliquer sur **Rotation**
3. Entrer la nouvelle clé API
4. Cliquer sur **Confirmer rotation**
5. Tester la connexion

Via l'API tRPC :

```typescript
await trpc.aiSettings.rotateKey.mutate({
  orgId: "mon-org",
  apiKey: "sk-nouvelle-cle"
});
```

## Fournisseurs supportés

### OpenAI

- **Modèles** : gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, o1, o1-mini
- **Base URL** : `https://api.openai.com` (optionnel, pour proxies)

### Azure OpenAI

- **Endpoint** : URL de votre ressource Azure (ex: `https://myresource.openai.azure.com`)
- **API Version** : Version de l'API (ex: `2024-02-01`)
- **Deployment** : Nom du déploiement Azure

### Anthropic

- **Modèles** : claude-sonnet-4-20250514, claude-3-5-sonnet-20241022, claude-3-haiku-20240307
- **Base URL** : `https://api.anthropic.com` (optionnel)

### Custom HTTP

- **URL** : Endpoint complet compatible OpenAI Chat Completions API
- **Modèle** : Nom libre du modèle

## Sécurité

- Les clés API sont chiffrées avec AES-256-GCM avant stockage en DB
- Le chiffrement utilise un IV aléatoire de 96 bits + tag d'authentification de 128 bits
- La clé maître n'est jamais stockée en DB, uniquement en variable d'environnement ou Docker secret
- L'endpoint `get()` ne renvoie jamais la clé — uniquement `hasSecret: boolean`
- Les clés ne sont jamais loguées (ni côté serveur, ni côté client)
- Accès restreint aux rôles `admin` et propriétaire de l'application
- Toutes les actions sont tracées dans le journal d'audit

## Journal d'audit

Les actions suivantes sont enregistrées :

| Action | Description |
|---|---|
| `AI_CONFIG_CREATE` | Création d'une nouvelle configuration |
| `AI_CONFIG_UPDATE` | Mise à jour de la configuration |
| `AI_CONFIG_ROTATE_KEY` | Rotation de la clé API |
| `AI_CONFIG_DISABLE` | Désactivation de l'IA |
| `AI_CONFIG_TEST_OK` | Test de connexion réussi |
| `AI_CONFIG_TEST_FAIL` | Test de connexion échoué |

## Cache

La configuration résolue est mise en cache pendant 30 secondes pour éviter des déchiffrements répétés. Le cache est invalidé automatiquement lors des opérations `upsert`, `rotateKey` et `disable`.

## Troubleshooting

### "Clé de chiffrement manquante" (bannière rouge)

→ La master key n'est pas provisionnée. Suivre la section "Provisionnement de la clé maître (Docker)" ci-dessus.

### "AI encryption master key not configured"

→ Même cause. Vérifier que `AI_CONFIG_MASTER_KEY_FILE` pointe vers un fichier existant contenant 64 caractères hex, ou que `AI_CONFIG_MASTER_KEY` est définie.

### "MASTER_KEY_MISSING" lors de l'upsert

→ L'endpoint `upsert` refuse de stocker une clé API sans master key. Provisionner la master key et redémarrer.

### "AI configuration is locked"

→ `AI_CONFIG_LOCKED=true` est actif. Modifier les variables d'environnement directement ou retirer le verrou.

### "No AI API key configured"

→ Aucune clé n'est configurée ni en DB ni en ENV. Configurer via l'interface admin ou définir `BUILT_IN_FORGE_API_KEY`.

### Test de connexion échoue

1. Vérifier que la clé API est valide
2. Vérifier que le fournisseur est accessible depuis le serveur
3. Pour Azure : vérifier l'endpoint, la version API et le nom du déploiement
4. Consulter le journal d'audit pour les détails de l'erreur

### Clé corrompue après migration

Si la clé maître a changé sans re-chiffrement :
1. Restaurer l'ancienne clé maître
2. Exporter les clés API via l'ancienne clé
3. Mettre à jour la clé maître
4. Re-chiffrer avec `rotateKey`

### Vérifier le démarrage (check)

Au démarrage, le backend log un avertissement si la master key est absente :

```
[readSecret] File not found for AI_CONFIG_MASTER_KEY_FILE: /run/secrets/ai_config_master_key
```

Ce message est normal si vous utilisez le mode ENV-only (`AI_CONFIG_LOCKED=true`) ou si vous n'avez pas encore provisionné la clé.
