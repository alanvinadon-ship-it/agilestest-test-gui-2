# PROBE_HARDENING.md — Durcissement Probe SPAN/TAP (Mode B)

> **Mission** : PROBE-HARDEN-1  
> **Version** : 1.0.0  
> **Date** : 2026-02-18  
> **Auteur** : AgilesTest Engineering

---

## 1. Vue d'ensemble

Le mode B de capture réseau (Probe SPAN/TAP) a été durci pour un usage industriel en environnement opérateur télécom. Ce document décrit les mécanismes de sécurité, robustesse, quotas, monitoring et diagnostics implémentés.

### Périmètre

| Composant | Fichier principal | Description |
|-----------|-------------------|-------------|
| Types durcis | `client/src/capture/types.ts` | ProbeReasonCode, ProbeHealthResponse, ProbeHeartbeat, CaptureQuotas |
| Types Probe étendus | `client/src/types/index.ts` | Champs health, version, interfaces, allowlist, TLS |
| LocalStore enrichi | `client/src/api/localStore.ts` | heartbeat(), getHealth(), testCapture(), listByExecution() |
| CollectorApi étendu | `client/src/api/collectorApi.ts` | probeHeartbeat, getProbeHealth, testProbeCapture |
| Hooks React | `client/src/hooks/useProbeQueries.ts` | useProbeHealth, useProbeHeartbeat, useTestProbeCapture |
| Runner Agent | `runner-agent/src/probeSessionManager.ts` | ProbeSessionManager durci (auth, idempotence, quotas) |
| UI Probes | `client/src/pages/ProbesPage.tsx` | Diagnostics, health panel, test capture |
| UI Execution | `client/src/pages/ExecutionDetailPage.tsx` | Reason codes, paquets, diagnostics d'échec |

---

## 2. Probe Agent — Endpoints

### 2.1 Health Check

Le endpoint `/probe/health` retourne l'état complet de la sonde :

```
GET /api/v1/probes/{probe_id}/health
```

**Réponse** :

```json
{
  "status": "healthy",
  "version": "1.2.0",
  "uptime_seconds": 86400,
  "interfaces": [
    { "name": "eth0", "up": true, "speed_mbps": 1000, "rx_bytes": 1234567, "tx_bytes": 567890, "promisc": false },
    { "name": "mirror0", "up": true, "speed_mbps": 10000, "rx_bytes": 9876543, "tx_bytes": 0, "promisc": true }
  ],
  "disk_free_mb": 45000,
  "cpu_percent": 12,
  "last_error": null,
  "active_sessions": 1,
  "total_captures": 247
}
```

Les statuts possibles sont :

| Statut | Description | Impact |
|--------|-------------|--------|
| `healthy` | Sonde opérationnelle | Capture autorisée |
| `degraded` | Charge élevée ou disque faible | Capture autorisée avec avertissement |
| `unhealthy` | Sonde en erreur critique | Capture bloquée |

### 2.2 Heartbeat

Le heartbeat est envoyé périodiquement (par défaut toutes les 30 secondes) par la sonde vers AgilesTest :

```
POST /api/v1/probes/{probe_id}/heartbeat
```

**Payload** :

```json
{
  "status": "healthy",
  "version": "1.2.0",
  "cpu_percent": 15,
  "disk_free_mb": 42000,
  "interfaces": ["eth0", "mirror0", "bond0"],
  "active_sessions": 0
}
```

Le heartbeat met à jour automatiquement les champs `last_seen_at`, `status`, `health_status`, `version`, `cpu_percent`, `disk_free_mb`, `interfaces` et `active_sessions` de la sonde.

Une sonde est considérée **hors ligne** si aucun heartbeat n'est reçu pendant 3 intervalles consécutifs (90 secondes par défaut).

### 2.3 Test Capture (Dry Run)

Le endpoint de test capture lance une capture de 30 secondes sur l'interface spécifiée et retourne les statistiques :

```
POST /api/v1/probes/{probe_id}/test-capture
```

**Payload** :

```json
{
  "iface": "mirror0"
}
```

**Réponse (succès)** :

```json
{
  "success": true,
  "packets_captured": 3247,
  "bytes_captured": 2456789,
  "duration_sec": 30
}
```

**Réponse (échec)** :

```json
{
  "success": false,
  "packets_captured": 0,
  "bytes_captured": 0,
  "duration_sec": 0,
  "reason_code": "IFACE_NOT_FOUND",
  "error_message": "Interface mirror1 introuvable"
}
```

---

## 3. Authentification & Sécurité

### 3.1 Token d'authentification

Chaque sonde possède un token unique généré lors de la création. Ce token doit être envoyé dans le header `X-PROBE-TOKEN` de chaque requête.

| Aspect | Détail |
|--------|--------|
| Header | `X-PROBE-TOKEN: <token>` |
| Génération | Automatique à la création de la sonde |
| Régénération | Via le bouton "Régénérer le token" dans l'UI |
| Stockage agent | Variable d'environnement `PROBE_AUTH_TOKEN` |

Le token est affiché **une seule fois** lors de la création. L'opérateur doit le copier immédiatement et le configurer dans l'agent probe.

### 3.2 Allowlist CIDR

Chaque sonde peut être configurée avec une liste de CIDR autorisés. Par défaut, `0.0.0.0/0` autorise toutes les adresses. En production, il est recommandé de restreindre aux sous-réseaux de management.

**Exemple** :

```
allowlist_cidrs: ["10.0.0.0/8", "172.16.0.0/12"]
```

### 3.3 TLS

Le champ `tls_enabled` indique si la communication entre la sonde et AgilesTest est chiffrée. En production, TLS doit être activé avec des certificats valides.

### 3.4 Audit

Toutes les actions probe sont auditées :

| Action | Entity Type | Détail |
|--------|-------------|--------|
| Création sonde | `probe` | probe_id, site, zone, type |
| Heartbeat | `probe` | probe_id, status, version |
| Régénération token | `probe` | probe_id |
| Démarrage session | `capture_session` | session_id, probe_id, iface |
| Arrêt session | `capture_session` | session_id, status, reason_code |
| Échec session | `capture_session` | session_id, reason_code, error_message |

---

## 4. Sessions de Capture — Robustesse

### 4.1 Cycle de vie

```
PENDING → RUNNING → COMPLETED
                  → FAILED (+ reason_code)
                  → TIMEOUT
                  → CANCELLED
```

### 4.2 Idempotence

Les opérations `start` et `stop` sont idempotentes :

- **start** : Si une session est déjà en cours (RUNNING ou PENDING), elle est retournée directement sans créer de doublon.
- **stop** : Si la session est déjà dans un état terminal (COMPLETED, FAILED, CANCELLED, TIMEOUT), elle est retournée sans action.

### 4.3 Reason Codes

Les reason codes standardisés permettent un diagnostic précis des échecs :

| Code | Sévérité | Description | Action recommandée |
|------|----------|-------------|-------------------|
| `PROBE_OFFLINE` | **critical** | Sonde hors ligne ou injoignable | Vérifier la connectivité réseau de la sonde |
| `IFACE_NOT_FOUND` | **critical** | Interface réseau spécifiée introuvable | Vérifier le nom de l'interface dans la configuration |
| `NO_PACKETS` | warning | Aucun paquet capturé après le timeout | Vérifier les filtres BPF/VLAN et le port mirror |
| `CAPTURE_FAILED` | error | Échec de tcpdump | Vérifier les permissions et la configuration tcpdump |
| `UPLOAD_FAILED` | error | Échec d'upload PCAP vers MinIO | Vérifier la connectivité MinIO et l'espace disque |
| `AUTH_FAILED` | **critical** | Token invalide ou expiré | Régénérer le token et reconfigurer l'agent |
| `TIMEOUT` | warning | Session dépassant la durée maximale | Augmenter `max_session_duration_sec` ou réduire la durée de capture |
| `QUOTA_EXCEEDED` | warning | Quota de sessions concurrentes atteint | Attendre la fin des sessions en cours ou augmenter le quota |
| `CONFIG_INVALID` | **critical** | Configuration probe invalide | Vérifier tous les champs obligatoires |

### 4.4 No-Packets Detection

Après le démarrage d'une session, un timer de détection est lancé (par défaut 30 secondes, configurable via `no_packets_timeout_sec`). Si aucun paquet n'est capturé après ce délai, un avertissement `NO_PACKETS` est émis.

Causes fréquentes :

- Port mirror non configuré sur le switch
- Filtre BPF trop restrictif
- VLAN filter incorrect
- Interface en mode non-promiscuous

### 4.5 Quotas

Les quotas protègent contre la surcharge :

| Quota | Défaut | Description |
|-------|--------|-------------|
| `max_concurrent_sessions` | 3 | Nombre max de sessions simultanées par sonde |
| `max_session_duration_sec` | 3600 | Durée max d'une session (1 heure) |
| `max_total_size_mb` | 5000 | Taille max totale des PCAP par session (5 GB) |
| `max_files_per_session` | 20 | Nombre max de fichiers PCAP par session |
| `no_packets_timeout_sec` | 30 | Délai de détection no-packets |

### 4.6 Rotation PCAP

La rotation des fichiers PCAP est gérée par tcpdump avec les paramètres `rotate_mb` et `max_files` :

- `rotate_mb` : Taille maximale d'un fichier PCAP avant rotation (ex: 100 MB)
- `max_files` : Nombre maximum de fichiers en rotation (les plus anciens sont supprimés)

### 4.7 Retry avec Backoff

Les appels réseau vers la probe utilisent un retry avec backoff exponentiel :

- **Tentatives** : 3 (configurable)
- **Délai initial** : 1 seconde
- **Progression** : 1s → 2s → 4s
- **Exceptions** : Les erreurs `AUTH_FAILED` et `CONFIG_INVALID` ne sont jamais retryées

---

## 5. Interface Utilisateur

### 5.1 Page Sondes

La page Sondes (`/probes`) affiche pour chaque sonde :

- **Badge de statut** : ONLINE (vert), OFFLINE (gris), DEGRADED (jaune)
- **Version** : Numéro de version de l'agent probe
- **TLS** : Badge vert si TLS activé
- **Last seen** : Date et heure du dernier heartbeat
- **Uptime** : Durée de fonctionnement

En dépliant une sonde (chevron), on accède aux **diagnostics** :

- **Health status** : Sain / Dégradé / Critique
- **Métriques** : CPU, disque libre, sessions actives, captures totales
- **Interfaces réseau** : Liste avec statut up/down, vitesse, mode promiscuous
- **Dernière erreur** : Message d'erreur si applicable
- **Sécurité** : Token configuré, CIDR autorisés, TLS

### 5.2 Bouton Test Capture

Le bouton "Test capture (30s)" permet de lancer un dry run sur une interface sélectionnée. Le résultat affiche :

- Nombre de paquets capturés
- Volume de données
- Durée de la capture
- Reason code en cas d'échec

### 5.3 Heartbeat Simulation

Le bouton Activity (icône pulsation) permet de simuler un heartbeat pour mettre une sonde en ligne en mode démo. En production, le heartbeat est envoyé automatiquement par l'agent.

### 5.4 ExecutionDetailPage

La section "Capture Réseau" dans le détail d'une exécution affiche :

- **Sessions de capture** : ID, probe, interface, paquets, volume, statut
- **Reason codes** : Code, label humain, sévérité (couleur), message d'erreur
- **Badge test capture** : Identifie les sessions de dry run
- **Statut TIMEOUT** : Badge orange distinct pour les sessions en timeout

---

## 6. Configuration Agent Probe

### Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `PROBE_AUTH_TOKEN` | Token d'authentification X-PROBE-TOKEN | `probe-token-abc123` |
| `PROBE_HEARTBEAT_INTERVAL` | Intervalle heartbeat en secondes | `30` |
| `AGILESTEST_URL` | URL de l'instance AgilesTest | `https://agilestest.orange.ci` |
| `PROBE_TLS_CERT` | Chemin du certificat TLS | `/etc/probe/cert.pem` |
| `PROBE_TLS_KEY` | Chemin de la clé TLS | `/etc/probe/key.pem` |
| `MINIO_ENDPOINT` | Endpoint MinIO pour upload PCAP | `minio.internal:9000` |
| `MINIO_BUCKET` | Bucket MinIO | `agilestest-artifacts` |

### Exemple de déploiement Docker

```yaml
services:
  probe-agent:
    image: agilestest/probe-agent:1.2.0
    privileged: true
    network_mode: host
    environment:
      - PROBE_AUTH_TOKEN=probe-token-abc123
      - AGILESTEST_URL=https://agilestest.orange.ci
      - PROBE_HEARTBEAT_INTERVAL=30
      - MINIO_ENDPOINT=minio.internal:9000
      - MINIO_BUCKET=agilestest-artifacts
    volumes:
      - /tmp/probe-captures:/captures
    cap_add:
      - NET_RAW
      - NET_ADMIN
```

---

## 7. Troubleshooting

### Sonde hors ligne

1. Vérifier que l'agent probe est démarré : `docker ps | grep probe-agent`
2. Vérifier la connectivité vers AgilesTest : `curl -H "X-PROBE-TOKEN: $TOKEN" $AGILESTEST_URL/api/v1/probes/$PROBE_ID/health`
3. Vérifier les logs de l'agent : `docker logs probe-agent --tail 50`
4. Simuler un heartbeat depuis l'UI (bouton Activity) pour tester

### No-Packets

1. Vérifier que le port mirror est configuré sur le switch
2. Tester manuellement : `tcpdump -i mirror0 -c 10`
3. Vérifier le mode promiscuous : `ip link show mirror0`
4. Simplifier le filtre BPF pour tester (ex: retirer le filtre VLAN)

### Auth Failed

1. Vérifier que le token est correct dans `PROBE_AUTH_TOKEN`
2. Régénérer le token depuis l'UI si nécessaire
3. Vérifier les CIDR autorisés (l'IP de la sonde doit être dans la liste)

### Upload Failed

1. Vérifier la connectivité MinIO : `curl $MINIO_ENDPOINT/minio/health/live`
2. Vérifier l'espace disque sur MinIO
3. Vérifier les credentials MinIO de l'agent

---

## 8. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-02-18 | Durcissement initial : auth, heartbeat, health, reason codes, quotas, test capture, UI diagnostics |
