# Capture Policy — Guide de configuration réseau

## Vue d'ensemble

La fonctionnalité **Capture Policy** permet de capturer le trafic réseau (PCAP) pendant l'exécution des tests AgilesTest. Deux modes de capture sont disponibles, strictement séparés :

| Mode | Code | Description | Prérequis |
|------|------|-------------|-----------|
| **Mode A** | `RUNNER_TCPDUMP` | tcpdump exécuté sur le runner Docker | tcpdump installé, capabilities `NET_ADMIN` + `NET_RAW` |
| **Mode B** | `PROBE_SPAN_TAP` | Capture via une sonde réseau SPAN/TAP distante | Probe agent en ligne, port SPAN/TAP configuré |
| Aucun | `NONE` | Pas de capture réseau | — |

---

## Architecture de résolution en cascade

La politique de capture est résolue en cascade selon la hiérarchie suivante. Le premier override non-`NONE` trouvé en remontant est utilisé :

```
Run Override (admin only)
    ↓ si NONE
Scenario Override
    ↓ si NONE
Campaign Override
    ↓ si NONE
Project Default
    ↓ si non défini
Défaut système (NONE)
```

Chaque niveau peut définir un override complet (mode + configuration) ou hériter du niveau parent. La source effective est affichée dans le Run Center et dans le détail d'exécution.

---

## Configuration

### Niveau Projet (défaut)

Accédez à **Paramètres Projet** dans la barre latérale pour configurer la politique de capture par défaut du projet.

**Champs communs :**

| Champ | Description | Défaut |
|-------|-------------|--------|
| `default_mode` | Mode de capture (`NONE`, `RUNNER_TCPDUMP`, `PROBE_SPAN_TAP`) | `NONE` |
| `retention_days` | Durée de rétention des fichiers PCAP (jours) | 30 |

**Mode A — Runner tcpdump :**

| Champ | Description | Défaut |
|-------|-------------|--------|
| `iface` | Interface réseau à capturer | `eth0` |
| `bpf_filter` | Filtre BPF (ex: `tcp port 443`) | vide |
| `snaplen` | Taille maximale de capture par paquet (octets) | 65535 |
| `rotate_mb` | Taille de rotation des fichiers PCAP (Mo) | 100 |
| `max_files` | Nombre maximum de fichiers PCAP en rotation | 5 |
| `enabled` | Activer/désactiver la capture | `true` |

**Mode B — Probe SPAN/TAP :**

| Champ | Description | Défaut |
|-------|-------------|--------|
| `probe_id` | Identifiant de la sonde réseau | requis |
| `iface` | Interface SPAN/TAP sur la sonde | requis |
| `bpf_filter` | Filtre BPF | vide |
| `vlan_filter` | Filtrage par VLAN ID (optionnel) | — |
| `rotate_mb` | Taille de rotation (Mo) | 100 |
| `enabled` | Activer/désactiver | `true` |

### Niveau Campagne (override)

Dans la page **Drive Testing > Campagnes**, chaque campagne peut définir un override de capture. Cliquez sur l'onglet **Capture** de la campagne pour configurer.

### Niveau Scénario (override)

Dans la page **Scénarios**, l'éditeur de capture est accessible dans la section **Capture Policy Override** du détail d'un scénario.

### Niveau Run (admin only)

Lors du lancement d'une exécution dans le **Run Center**, les utilisateurs avec le rôle `admin` peuvent activer l'override de capture au niveau du run. Cette option est protégée par la permission `CAPTURE_ADMIN_OVERRIDE`.

---

## Validation et garde-fous

Avant le lancement d'une exécution, le système valide la politique de capture effective :

### Erreurs bloquantes (empêchent l'exécution)

| Condition | Message |
|-----------|---------|
| Mode A sans `iface` | "Interface réseau (iface) requise pour le mode Runner tcpdump" |
| Mode B sans `probe_id` | "probe_id requis pour le mode Probe SPAN/TAP" |
| Mode B sans `iface` | "Interface réseau (iface) requise pour le mode Probe SPAN/TAP" |

### Avertissements (non bloquants)

| Condition | Message |
|-----------|---------|
| Mode A avec `enabled: false` | "La configuration tcpdump runner est désactivée" |
| Mode B avec `enabled: false` | "La configuration probe SPAN/TAP est désactivée" |
| `snaplen < 64` | "snaplen < 64 peut tronquer les en-têtes de paquets" |
| `retention_days < 1` | "Les artefacts seront supprimés rapidement" |

---

## Runner Agent — Mode A (tcpdump)

### Prérequis Docker

Le runner Docker doit inclure `tcpdump` et disposer des capabilities réseau :

```yaml
# docker-compose.runner.yml
services:
  runner-agent:
    image: agilestest-runner-agent:latest
    cap_add:
      - NET_ADMIN
      - NET_RAW
    environment:
      - RUNNER_ID=runner-docker-01
      - ORCHESTRATION_URL=http://orchestration:4000
```

### Flow d'exécution

1. L'orchestrateur envoie le job avec `capture_mode: RUNNER_TCPDUMP` et la configuration `capture_config.runner_tcpdump`
2. Le runner démarre `tcpdump` en arrière-plan avant l'exécution Playwright
3. Les tests s'exécutent normalement pendant la capture
4. À la fin des tests, le runner envoie `SIGTERM` à tcpdump
5. Les fichiers PCAP sont collectés et uploadés vers MinIO/S3
6. Le manifest d'artefacts inclut les entrées PCAP avec checksums SHA-256

### Convention de nommage PCAP

```
s3://{bucket}/{project_id}/{execution_id}/pcap/capture-{job_id}-{timestamp}.pcap
```

---

## Probe Agent — Mode B (SPAN/TAP)

### Architecture

```
Runner Agent ──(API)──> Orchestration ──(API)──> Probe Agent
                                                     │
                                                     ├── tcpdump sur iface SPAN/TAP
                                                     └── Upload PCAP → MinIO
```

### Flow d'exécution

1. L'orchestrateur envoie le job avec `capture_mode: PROBE_SPAN_TAP`
2. Le runner crée une session de capture via `POST /api/v1/probes/{probe_id}/sessions`
3. Le runner démarre la capture via `POST /api/v1/probes/{probe_id}/sessions/{session_id}/start`
4. Les tests s'exécutent pendant que la probe capture le trafic
5. Le runner arrête la capture via `POST /api/v1/probes/{probe_id}/sessions/{session_id}/stop`
6. La probe upload les PCAP vers MinIO et retourne le manifest
7. Le manifest est fusionné avec les artefacts du runner

### Endpoints Probe Agent

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v1/probes/{id}/status` | Statut de la probe (ONLINE/OFFLINE) |
| `POST` | `/api/v1/probes/{id}/sessions` | Créer une session de capture |
| `POST` | `/api/v1/probes/{id}/sessions/{sid}/start` | Démarrer la capture |
| `POST` | `/api/v1/probes/{id}/sessions/{sid}/stop` | Arrêter la capture |
| `GET` | `/api/v1/probes/{id}/sessions/{sid}` | Statut et artefacts de la session |
| `POST` | `/api/v1/probes/{id}/sessions/{sid}/cancel` | Annuler la session |

---

## Artefacts PCAP dans MinIO

Les fichiers PCAP sont stockés dans MinIO avec la convention suivante :

```
agilestest-artifacts/
  └── {project_id}/
      └── {execution_id}/
          └── pcap/
              ├── capture-{job_id}-20260218-143022.pcap
              └── capture-{job_id}-20260218-143122.pcap
```

Chaque artefact PCAP dans le manifest inclut :

| Champ | Description |
|-------|-------------|
| `type` | `PCAP` |
| `filename` | Nom du fichier |
| `s3_key` | Chemin complet dans le bucket |
| `s3_uri` | URI S3 complète |
| `size_bytes` | Taille en octets |
| `mime_type` | `application/vnd.tcpdump.pcap` |
| `checksum` | SHA-256 du fichier |
| `download_url` | URL de téléchargement directe |

---

## Permissions RBAC

| Permission | Description |
|------------|-------------|
| `CAPTURE_VIEW` | Voir la politique de capture et les sessions |
| `CAPTURE_EDIT` | Modifier la politique de capture (projet/campagne/scénario) |
| `CAPTURE_ADMIN_OVERRIDE` | Override de capture au niveau run (admin uniquement) |
| `PROBES_VIEW` | Voir les sondes réseau |
| `PROBES_MANAGE` | Gérer les sondes (ajouter/supprimer/configurer) |

---

## Interface utilisateur

### Run Center

Le Run Center affiche la politique de capture effective pour chaque exécution :
- **Badge de mode** : NONE (gris), Mode A (bleu), Mode B (violet)
- **Source** : Indique le niveau de résolution (Projet, Campagne, Scénario, Override admin)
- **Validation** : Erreurs bloquantes en rouge, avertissements en orange
- **Override admin** : Bouton visible uniquement pour les administrateurs

### Détail d'exécution

La page de détail d'exécution affiche une section **Capture Réseau** avec :
- Mode effectif et source de résolution
- Durée de rétention configurée
- Nombre de fichiers PCAP collectés
- Sessions de capture probe (Mode B) avec statut
- Liens de téléchargement des fichiers PCAP

---

## Troubleshooting

### Mode A — tcpdump ne démarre pas

1. Vérifier que `tcpdump` est installé dans l'image Docker
2. Vérifier les capabilities : `cap_add: [NET_ADMIN, NET_RAW]`
3. Vérifier que l'interface `iface` existe dans le conteneur : `ip link show`
4. Consulter les logs du runner : `docker logs runner-agent | grep CAPTURE`

### Mode B — Probe non joignable

1. Vérifier le statut de la probe : `GET /api/v1/probes/{id}/status`
2. Vérifier la connectivité réseau entre l'orchestrateur et la probe
3. Vérifier que le port SPAN/TAP est actif sur le switch
4. Consulter les logs de la probe : `journalctl -u agilestest-probe`

### PCAP non uploadé vers MinIO

1. Vérifier la configuration MinIO : endpoint, credentials, bucket
2. Vérifier l'espace disque disponible sur MinIO
3. Vérifier les permissions du bucket : `mc admin policy info minio readwrite`
4. Consulter le manifest d'artefacts dans le détail du job


---

## Durcissement Probe (PROBE-HARDEN-1)

> Pour la documentation complète du durcissement probe, voir [PROBE_HARDENING.md](./PROBE_HARDENING.md).

### Reason Codes

Le Mode B utilise désormais des **reason codes standardisés** pour diagnostiquer les échecs de capture :

| Code | Sévérité | Description |
|------|----------|-------------|
| `PROBE_OFFLINE` | critical | Sonde hors ligne ou injoignable |
| `IFACE_NOT_FOUND` | critical | Interface réseau introuvable |
| `NO_PACKETS` | warning | Aucun paquet capturé après timeout |
| `CAPTURE_FAILED` | error | Échec de tcpdump |
| `UPLOAD_FAILED` | error | Échec upload PCAP vers MinIO |
| `AUTH_FAILED` | critical | Token invalide ou expiré |
| `TIMEOUT` | warning | Session dépassant la durée maximale |
| `QUOTA_EXCEEDED` | warning | Quota de sessions concurrentes atteint |
| `CONFIG_INVALID` | critical | Configuration probe invalide |

### Quotas de capture

| Quota | Défaut | Description |
|-------|--------|-------------|
| `max_concurrent_sessions` | 3 | Sessions simultanées par sonde |
| `max_session_duration_sec` | 3600 | Durée max (1h) |
| `max_total_size_mb` | 5000 | Taille max PCAP (5 GB) |
| `max_files_per_session` | 20 | Fichiers PCAP max par session |
| `no_packets_timeout_sec` | 30 | Délai détection no-packets |

### Authentification

Chaque sonde doit s'authentifier via le header `X-PROBE-TOKEN`. Le token est généré à la création et peut être régénéré depuis l'UI. Les CIDR autorisés et le TLS sont configurables par sonde.

### Test Capture (Dry Run)

Le bouton "Test capture (30s)" dans la page Sondes permet de vérifier la connectivité et la capture avant de lancer un run réel. Le résultat inclut le nombre de paquets, le volume et le reason code en cas d'échec.

### Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-02-18 | Capture Policy initiale (DRIVE-CAPTURE-POLICY-1) |
| 1.1.0 | 2026-02-18 | Durcissement probe (PROBE-HARDEN-1) : auth, heartbeat, health, reason codes, quotas, test capture |
