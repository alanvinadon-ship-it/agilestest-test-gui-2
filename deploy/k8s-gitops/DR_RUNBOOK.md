# DR_RUNBOOK — Disaster Recovery Kubernetes

> **Version** : 1.0.0 — Mission PACKAGING-DUAL-1

---

## 1. Scénarios de reprise

Ce runbook couvre les scénarios de reprise après incident pour AgilesTest en environnement Kubernetes.

| Scénario | Sévérité | RTO | RPO | Procédure |
|----------|----------|-----|-----|-----------|
| Pod crash loop | P2 | 5 min | 0 | §2 — Diagnostic pod |
| MinIO data loss | P0 | 30 min | Dernier backup | §3 — Restore MinIO |
| Secret compromis | P1 | 15 min | 0 | §4 — Rotation secrets |
| Namespace supprimé | P0 | 1 h | Dernier backup | §5 — Rebuild complet |
| Ingress down | P1 | 10 min | 0 | §6 — Diagnostic réseau |

---

## 2. Diagnostic pod en crash loop

Identifier la cause du crash et appliquer le correctif approprié.

```bash
NS=agilestest-pilot-orange

# Identifier le pod en erreur
kubectl get pods -n $NS | grep -v Running

# Lire les logs
kubectl logs <POD_NAME> -n $NS --previous

# Décrire le pod (events)
kubectl describe pod <POD_NAME> -n $NS

# Causes fréquentes :
# - OOMKilled : augmenter les limits mémoire dans values
# - CrashLoopBackOff : vérifier les variables d'environnement et secrets
# - ImagePullBackOff : vérifier le registry et les credentials
```

---

## 3. Restore MinIO

### 3.1 Backup régulier (CronJob recommandé)

Créer un CronJob qui sauvegarde MinIO quotidiennement vers un stockage externe.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: minio-backup
  namespace: agilestest-pilot-orange
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: minio/mc:latest
              command:
                - /bin/sh
                - -c
                - |
                  mc alias set src http://agilestest-minio:9000 $MINIO_USER $MINIO_PASS
                  mc mirror src/agilestest-artifacts /backup/$(date +%Y%m%d)/
              envFrom:
                - secretRef:
                    name: agilestest-secrets
              volumeMounts:
                - name: backup-vol
                  mountPath: /backup
          volumes:
            - name: backup-vol
              persistentVolumeClaim:
                claimName: minio-backup-pvc
```

### 3.2 Restauration

```bash
# Depuis un backup local
kubectl run minio-restore --rm -it \
  --image=minio/mc:latest \
  -n $NS \
  --overrides='{"spec":{"containers":[{"name":"restore","image":"minio/mc:latest","volumeMounts":[{"name":"backup","mountPath":"/backup"}]}],"volumes":[{"name":"backup","persistentVolumeClaim":{"claimName":"minio-backup-pvc"}}]}}' \
  -- sh -c "mc alias set dst http://agilestest-minio:9000 \$MINIO_USER \$MINIO_PASS && mc mirror /backup/<DATE>/ dst/agilestest-artifacts/"
```

---

## 4. Rotation des secrets

En cas de compromission d'un secret, le renouveler immédiatement.

```bash
NS=agilestest-pilot-orange

# 1. Générer de nouveaux secrets
NEW_JWT=$(openssl rand -base64 32)
NEW_MINIO_KEY=$(openssl rand -base64 16)

# 2. Mettre à jour le secret Kubernetes
kubectl create secret generic agilestest-secrets \
  --namespace=$NS \
  --from-literal=jwt-secret="$NEW_JWT" \
  --from-literal=minio-access-key="minioadmin" \
  --from-literal=minio-secret-key="$NEW_MINIO_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Redémarrer les pods pour prendre en compte les nouveaux secrets
kubectl rollout restart deployment/agilestest-orchestration -n $NS
kubectl rollout restart deployment/agilestest-runner-agent -n $NS

# 4. Mettre à jour MinIO credentials
kubectl exec -it agilestest-minio-0 -n $NS -- \
  mc admin user svcacct edit local minioadmin --secret-key "$NEW_MINIO_KEY"

# 5. Si SealedSecrets : re-sceller et commiter
kubeseal --format yaml < new-secret.yaml > sealed-secret.yaml
```

---

## 5. Rebuild complet (namespace supprimé)

Si le namespace entier a été supprimé, reconstruire depuis les sources GitOps.

```bash
# 1. Recréer le namespace
kubectl create namespace $NS

# 2. Recréer les secrets
# (utiliser les SealedSecrets ou recréer manuellement)

# 3. Réinstaller via Helm
helm install agilestest charts/agilestest/ \
  --namespace $NS \
  -f gitops/overlays/pilot_orange/values-pilot-orange.yaml

# 4. Restaurer MinIO depuis le backup
# (voir §3.2)

# 5. Vérifier
kubectl get pods -n $NS
helm test agilestest -n $NS
```

---

## 6. Diagnostic réseau (Ingress)

```bash
# Vérifier l'Ingress
kubectl get ingress -n $NS
kubectl describe ingress agilestest-frontend -n $NS

# Vérifier le contrôleur Ingress
kubectl get pods -n ingress-nginx
kubectl logs -l app.kubernetes.io/name=ingress-nginx -n ingress-nginx --tail=50

# Vérifier les certificats TLS
kubectl get certificate -n $NS
kubectl describe certificate agilestest-orange-tls -n $NS

# Test de connectivité interne
kubectl run debug --rm -it --image=curlimages/curl:8.5.0 -n $NS -- \
  curl -v http://agilestest-frontend:3000/
```

---

## 7. Contacts d'escalade

| Niveau | Contact | Délai |
|--------|---------|-------|
| L1 — Ops | ops@agilestest.io | Immédiat |
| L2 — DevOps | devops@agilestest.io | 15 min |
| L3 — Architecture | arch@agilestest.io | 1 h |
