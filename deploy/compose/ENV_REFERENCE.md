# ENV_REFERENCE — Référence des variables d'environnement

> **Version** : 1.0.0 — Mission PACKAGING-DUAL-1

---

## Variables globales

| Variable | Défaut | Obligatoire | Description |
|----------|--------|:-----------:|-------------|
| `TAG` | `latest` | Non | Tag des images Docker |
| `REGISTRY` | _(vide)_ | Non | Préfixe registry (ex: `registry.orange.ci/`) |
| `DOMAIN` | `agilestest.orange.ci` | Non | Domaine public de l'application |

## Reverse Proxy

| Variable | Défaut | Obligatoire | Description |
|----------|--------|:-----------:|-------------|
| `PROXY_HTTP_PORT` | `80` | Non | Port HTTP exposé sur l'hôte |
| `PROXY_HTTPS_PORT` | `443` | Non | Port HTTPS exposé sur l'hôte |

## Frontend

| Variable | Défaut | Obligatoire | Description |
|----------|--------|:-----------:|-------------|
| `VITE_APP_TITLE` | `AgilesTest` | Non | Titre affiché dans l'interface |
| `VITE_API_BASE_URL` | _(vide)_ | Non | URL de base de l'API (ex: `/api`) |
| `VITE_DATASET_STORAGE_MODE` | `local` | Non | Mode de stockage des datasets (`local` ou `minio`) |

## Orchestration API

| Variable | Défaut | Obligatoire | Description |
|----------|--------|:-----------:|-------------|
| `JWT_SECRET` | _(aucun)_ | **Oui** | Secret pour la signature des tokens JWT. Générer avec `openssl rand -base64 32` |

## MinIO

| Variable | Défaut | Obligatoire | Description |
|----------|--------|:-----------:|-------------|
| `MINIO_ROOT_USER` | `minioadmin` | **Oui** | Utilisateur root MinIO |
| `MINIO_ROOT_PASSWORD` | _(aucun)_ | **Oui** | Mot de passe root MinIO. Minimum 8 caractères |
| `MINIO_BUCKET` | `agilestest-artifacts` | Non | Nom du bucket pour les artefacts |

## Runner Agent

| Variable | Défaut | Obligatoire | Description |
|----------|--------|:-----------:|-------------|
| `RUNNER_ID` | `runner-prod-01` | Non | Identifiant unique du runner |
| `POLL_INTERVAL_MS` | `5000` | Non | Intervalle de polling en millisecondes |
| `PROBE_TOKEN` | _(vide)_ | Non | Token d'authentification pour les sondes probe |

## SMS Orange (optionnel)

| Variable | Défaut | Obligatoire | Description |
|----------|--------|:-----------:|-------------|
| `ORANGE_SMS_BASE_URL` | _(vide)_ | Non | URL de l'API SMS Orange |
| `ORANGE_SMS_TOKEN_URL` | _(vide)_ | Non | URL du endpoint OAuth2 token |
| `ORANGE_SMS_CLIENT_ID` | _(vide)_ | Non | Client ID OAuth2 Orange |
| `ORANGE_SMS_CLIENT_SECRET` | _(vide)_ | Non | Client Secret OAuth2 Orange |
| `ORANGE_SMS_SENDER_ID` | `AgilesTest` | Non | Nom d'expéditeur SMS |

## SMTP (optionnel)

| Variable | Défaut | Obligatoire | Description |
|----------|--------|:-----------:|-------------|
| `SMTP_HOST` | _(vide)_ | Non | Serveur SMTP |
| `SMTP_PORT` | `587` | Non | Port SMTP |
| `SMTP_SECURITY` | `STARTTLS` | Non | Mode de sécurité (`STARTTLS`, `TLS`, `NONE`) |
| `SMTP_USERNAME` | _(vide)_ | Non | Identifiant SMTP |
| `SMTP_PASSWORD` | _(vide)_ | Non | Mot de passe SMTP |
| `SMTP_FROM_EMAIL` | `noreply@agilestest.io` | Non | Adresse d'expédition |
| `SMTP_FROM_NAME` | `AgilesTest` | Non | Nom d'affichage |

---

## Sécurité des secrets

Les variables marquées **Oui** dans la colonne "Obligatoire" contiennent des secrets sensibles. En production, ces valeurs doivent être générées de manière aléatoire et stockées de manière sécurisée. Ne jamais committer le fichier `.env` dans un dépôt Git. Utiliser un gestionnaire de secrets (Vault, SealedSecrets) pour les environnements Kubernetes.
