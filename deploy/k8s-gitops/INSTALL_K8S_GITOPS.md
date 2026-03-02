# INSTALL_K8S_GITOPS — Installation Kubernetes + GitOps

> **Version** : 1.0.0 — Mission PACKAGING-DUAL-1  
> **Cible** : Cluster Kubernetes 1.27+ (EKS, GKE, AKS, on-premise)  
> **Durée estimée** : 1 heure

---

## 1. Prérequis

| Composant | Version minimale | Vérification |
|-----------|-----------------|--------------|
| Kubernetes | 1.27+ | `kubectl version --short` |
| Helm | 3.12+ | `helm version` |
| kubectl | 1.27+ | `kubectl version --client` |
| Ingress Controller | nginx-ingress 1.8+ | `kubectl get pods -n ingress-nginx` |
| StorageClass | SSD recommandé | `kubectl get sc` |
| RAM cluster | 16 Go minimum | `kubectl top nodes` |

### Composants optionnels

| Composant | Usage | Installation |
|-----------|-------|-------------|
| cert-manager | TLS automatique | `helm install cert-manager jetstack/cert-manager` |
| SealedSecrets | Secrets GitOps | `helm install sealed-secrets bitnami/sealed-secrets` |
| ArgoCD | GitOps continu | `helm install argocd argo/argo-cd` |
| Metrics Server | HPA | `kubectl apply -f metrics-server.yaml` |

---

## 2. Installation rapide (Helm)

L'installation la plus simple utilise Helm directement avec les values de l'overlay souhaité.

```bash
# 1. Créer le namespace
kubectl create namespace agilestest-pilot-orange

# 2. Créer les secrets
kubectl create secret generic agilestest-secrets \
  --namespace=agilestest-pilot-orange \
  --from-literal=jwt-secret="$(openssl rand -base64 32)" \
  --from-literal=minio-access-key="minioadmin" \
  --from-literal=minio-secret-key="$(openssl rand -base64 16)"

# 3. Installer avec Helm
cd deploy/k8s-gitops/charts/agilestest
helm dependency update
helm install agilestest . \
  --namespace agilestest-pilot-orange \
  -f ../../../gitops/overlays/pilot_orange/values-pilot-orange.yaml

# 4. Vérifier
kubectl get pods -n agilestest-pilot-orange
helm test agilestest -n agilestest-pilot-orange
```

---

## 3. Installation GitOps (ArgoCD)

Pour une installation GitOps avec synchronisation automatique, utiliser les manifests ArgoCD fournis.

**Étape 1 — Pousser le code dans un dépôt Git** accessible par ArgoCD.

**Étape 2 — Créer les secrets scellés** en suivant le guide `gitops/sealed-secrets/README.md`. Les SealedSecrets sont commités dans Git et déchiffrés automatiquement dans le cluster.

**Étape 3 — Appliquer le manifest ArgoCD** :

```bash
kubectl apply -f deploy/k8s-gitops/gitops/argocd/application.yaml
```

ArgoCD synchronisera automatiquement le chart Helm avec les values de l'overlay `pilot_orange`. Toute modification du dépôt Git déclenchera une synchronisation automatique.

---

## 4. Configuration par overlay

Quatre overlays sont fournis, chacun adapté à un environnement spécifique.

| Overlay | Namespace | Replicas | PVC MinIO | TLS | HPA |
|---------|-----------|----------|-----------|-----|-----|
| `dev` | agilestest-dev | 1/1/1/1 | 10 Gi | Non | Non |
| `preprod` | agilestest-preprod | 2/2/1/1 | 50 Gi | Oui | Non |
| `pilot_orange` | agilestest-pilot-orange | 2/2/2/1 | 100 Gi | Oui | Non |
| `prod` | agilestest-prod | 3/3/3/1 | 500 Gi | Oui | Oui |

Les chiffres des replicas correspondent à : frontend / orchestration / runner / minio.

Pour utiliser un overlay spécifique :

```bash
helm install agilestest charts/agilestest/ \
  --namespace agilestest-<env> \
  -f gitops/overlays/<env>/values-<env>.yaml
```

---

## 5. TLS avec cert-manager

Si cert-manager est installé, les certificats TLS sont automatiquement provisionnés via les annotations Ingress. Vérifier que le ClusterIssuer `letsencrypt-prod` existe :

```bash
kubectl get clusterissuer letsencrypt-prod
```

Si cert-manager n'est pas disponible, créer un secret TLS manuellement :

```bash
kubectl create secret tls agilestest-orange-tls \
  --cert=fullchain.pem \
  --key=privkey.pem \
  -n agilestest-pilot-orange
```

---

## 6. Runner Agent — Capabilities réseau

Le runner agent nécessite les capabilities Linux `NET_RAW` et `NET_ADMIN` pour exécuter tcpdump (capture mode A). Le PodSecurityContext est configuré dans le chart. Si le cluster utilise des PodSecurityPolicies ou PodSecurityStandards restrictives, ajouter une exception pour le namespace du runner :

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: agilestest-runner-psp
spec:
  allowedCapabilities:
    - NET_RAW
    - NET_ADMIN
```

---

## 7. Vérification post-installation

```bash
# Tous les pods doivent être Running/Ready
kubectl get pods -n agilestest-pilot-orange

# Vérifier les services
kubectl get svc -n agilestest-pilot-orange

# Vérifier l'ingress
kubectl get ingress -n agilestest-pilot-orange

# Smoke test (si activé dans values)
helm test agilestest -n agilestest-pilot-orange

# Ou manuellement
kubectl run smoke-test --rm -it --image=curlimages/curl:8.5.0 \
  -n agilestest-pilot-orange -- \
  curl -sf http://agilestest-frontend:3000/
```
