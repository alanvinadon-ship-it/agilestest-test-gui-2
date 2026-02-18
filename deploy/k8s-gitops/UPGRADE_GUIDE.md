# UPGRADE_GUIDE — Mise à jour Kubernetes

> **Version** : 1.0.0 — Mission PACKAGING-DUAL-1

---

## 1. Stratégie de mise à jour

En mode Kubernetes, les mises à jour suivent une stratégie **RollingUpdate** native. Helm gère le cycle de vie des releases. ArgoCD (si utilisé) synchronise automatiquement les changements depuis Git.

---

## 2. Mise à jour via Helm

### 2.1 Pré-mise à jour

Avant toute mise à jour, vérifier l'état actuel et sauvegarder les données MinIO.

```bash
NS=agilestest-pilot-orange

# État actuel
helm list -n $NS
kubectl get pods -n $NS

# Backup MinIO (depuis un pod temporaire)
kubectl run minio-backup --rm -it \
  --image=minio/mc:latest \
  -n $NS -- \
  sh -c "mc alias set local http://agilestest-minio:9000 \$MINIO_USER \$MINIO_PASS && mc mirror local/agilestest-artifacts /tmp/backup/"
```

### 2.2 Exécuter la mise à jour

```bash
# Mettre à jour le tag dans les values
# global.tag: "1.1.0"

helm upgrade agilestest charts/agilestest/ \
  --namespace $NS \
  -f gitops/overlays/pilot_orange/values-pilot-orange.yaml \
  --wait --timeout 5m
```

### 2.3 Post-mise à jour

```bash
# Vérifier le rollout
kubectl rollout status deployment/agilestest-frontend -n $NS
kubectl rollout status deployment/agilestest-orchestration -n $NS

# Smoke test
helm test agilestest -n $NS
```

---

## 3. Mise à jour via GitOps (ArgoCD)

Si ArgoCD est configuré, la mise à jour se fait en modifiant les values dans Git.

```bash
# 1. Modifier le tag dans values-pilot-orange.yaml
sed -i 's/tag: "1.0.0"/tag: "1.1.0"/' \
  gitops/overlays/pilot_orange/values-pilot-orange.yaml

# 2. Commit et push
git add . && git commit -m "upgrade: v1.1.0" && git push

# 3. ArgoCD synchronise automatiquement
# Vérifier dans l'UI ArgoCD ou :
argocd app get agilestest-pilot-orange
```

---

## 4. Rollback

### Via Helm

```bash
# Lister les révisions
helm history agilestest -n $NS

# Rollback à la révision précédente
helm rollback agilestest <REVISION> -n $NS --wait

# Vérifier
kubectl get pods -n $NS
```

### Via ArgoCD

```bash
# Revenir au commit précédent dans Git
git revert HEAD && git push

# Ou forcer la synchronisation sur un commit spécifique
argocd app sync agilestest-pilot-orange --revision <COMMIT_SHA>
```

---

## 5. Migrations

Si une version nécessite des migrations (schéma MinIO, buckets), exécuter le job de migration avant la mise à jour :

```bash
kubectl apply -f migrations/v1.1.0-migration-job.yaml -n $NS
kubectl wait --for=condition=complete job/migration-v1.1.0 -n $NS --timeout=300s
```
