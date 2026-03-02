# PARITY_CHECKLIST — Parité fonctionnelle Compose ↔ Kubernetes

> **Version** : 1.0.0 — Mission PACKAGING-DUAL-1  
> **Objectif** : Garantir que les deux modes de déploiement offrent une expérience identique.

---

## 1. Services et infrastructure

| Composant | Docker Compose | Kubernetes | Parité |
|-----------|:--------------:|:----------:|:------:|
| Frontend SPA (React/Vite) | `frontend` service | `frontend` Deployment | OK |
| Orchestration API (Node.js) | `orchestration` service | `orchestration` Deployment | OK |
| Runner Agent (Playwright + tcpdump) | `runner` service | `runner-agent` Deployment | OK |
| MinIO Object Storage | `minio` service | `minio` StatefulSet | OK |
| Reverse Proxy / Ingress | Nginx container | Ingress Controller | OK |
| Bucket init (minio-init) | `minio-init` service | Init container | OK |
| Healthchecks | Docker healthcheck | Liveness/Readiness probes | OK |
| TLS | Nginx certs | cert-manager / Secret | OK |
| Secrets management | `.env` file | SealedSecrets / K8s Secrets | OK |

---

## 2. Fonctionnalités applicatives

| Fonctionnalité | Compose | K8s | Notes |
|----------------|:-------:|:---:|-------|
| RBAC (45+ permissions, 6 rôles) | OK | OK | Géré côté frontend |
| Invitations utilisateurs | OK | OK | Géré côté frontend |
| Audit log | OK | OK | Géré côté frontend |
| Projets / Profils / Scénarios | OK | OK | Géré côté frontend |
| Datasets / Bundles | OK | OK | Géré côté frontend |
| Script IA (Plan + Gen + Activate) | OK | OK | Géré côté frontend |
| Run / Execution / Artefacts | OK | OK | Runner + MinIO |
| Repair IA (incident → fix → rerun) | OK | OK | Géré côté frontend |
| Drive Test (campagnes, routes, KPI) | OK | OK | Géré côté frontend |
| Drive Capture mode A (tcpdump) | OK | OK | Runner NET_RAW capability |
| Drive Capture mode B (probe SPAN/TAP) | OK | OK | Probe agent externe |
| Probe Hardening (health, heartbeat, auth) | OK | OK | Probe agent externe |
| Drive Reporting / Correlation | OK | OK | Géré côté frontend |
| Drive Repair opérateur-grade | OK | OK | Géré côté frontend |
| Auto-incidents Drive | OK | OK | Géré côté frontend |
| Notifications (SMS/Email/Templates/Rules) | OK | OK | Géré côté frontend |
| Export CSV / artefacts | OK | OK | MinIO download |

---

## 3. Exploitation

| Opération | Compose | K8s | Équivalence |
|-----------|---------|-----|-------------|
| Installation | `init.sh` | `helm install` | Documenté |
| Mise à jour | `docker compose pull && up` | `helm upgrade` | Documenté |
| Rollback | Tag précédent + `up -d` | `helm rollback` | Documenté |
| Backup MinIO | `backup_minio.sh` | CronJob mc mirror | Documenté |
| Restore MinIO | `restore_minio.sh` | Job mc mirror | Documenté |
| Rotation logs | `rotate_logs.sh` | Fluentd/Loki (externe) | Documenté |
| Rotation secrets | Éditer `.env` + restart | `kubectl create secret` + rollout | Documenté |
| Smoke test | `smoke_test.sh` | Helm test Job | Documenté |
| Scaling | Manuel (replicas dans compose) | HPA automatique | K8s supérieur |

---

## 4. Sécurité

| Aspect | Compose | K8s | Notes |
|--------|---------|-----|-------|
| TLS termination | Nginx | Ingress + cert-manager | Équivalent |
| Security headers | Nginx conf | Ingress annotations | Équivalent |
| Secrets en clair | `.env` (chmod 600) | SealedSecrets (chiffré) | K8s supérieur |
| Network isolation | Docker networks | NetworkPolicies | K8s supérieur |
| Pod Security | Docker user directive | PodSecurityContext | K8s supérieur |
| Rate limiting | Nginx limit_req | Ingress annotations | Équivalent |

---

## 5. Known limitations

| Limitation | Compose | K8s | Impact |
|------------|---------|-----|--------|
| Auto-scaling | Non supporté | HPA disponible | Compose limité à scaling manuel |
| Zero-downtime upgrade | Interruption brève possible | RollingUpdate natif | K8s supérieur |
| Multi-runner | Possible (multiple containers) | Natif (replicas) | K8s plus simple |
| Observabilité centralisée | Logs Docker | Prometheus/Grafana/Loki | K8s écosystème riche |
| Backup automatisé | Cron système | CronJob K8s | Équivalent |

---

## 6. Résumé

Les deux packagings offrent une **parité fonctionnelle complète** pour toutes les fonctionnalités applicatives. Les différences se situent au niveau de l'exploitation (scaling, secrets, observabilité) où Kubernetes offre des capacités supérieures. Docker Compose reste le choix optimal pour une installation rapide de pilote sur une VM unique, tandis que Kubernetes est recommandé pour les déploiements industriels multi-environnements.
