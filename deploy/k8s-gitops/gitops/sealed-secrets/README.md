# Sealed Secrets — Guide

> AgilesTest utilise **SealedSecrets** (Bitnami) pour gérer les secrets en GitOps.

## Prérequis

Installer le contrôleur SealedSecrets dans le cluster :

```bash
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system
```

Installer `kubeseal` en local :

```bash
brew install kubeseal  # macOS
# ou télécharger depuis https://github.com/bitnami-labs/sealed-secrets/releases
```

## Créer un SealedSecret

```bash
# 1. Créer le secret Kubernetes classique (ne pas appliquer)
kubectl create secret generic agilestest-secrets \
  --namespace=agilestest-pilot-orange \
  --from-literal=jwt-secret="$(openssl rand -base64 32)" \
  --from-literal=minio-access-key="minioadmin" \
  --from-literal=minio-secret-key="$(openssl rand -base64 16)" \
  --dry-run=client -o yaml > secret.yaml

# 2. Sceller le secret
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# 3. Appliquer le SealedSecret
kubectl apply -f sealed-secret.yaml

# 4. Supprimer le secret en clair
rm secret.yaml
```

## Rotation des secrets

Pour renouveler un secret, recréer le secret en clair avec les nouvelles valeurs, le sceller à nouveau avec `kubeseal`, et appliquer. Le contrôleur SealedSecrets déchiffrera automatiquement et mettra à jour le Secret Kubernetes sous-jacent.

## Alternative : ExternalSecrets

Si le cluster dispose d'un provider de secrets externe (Vault, AWS Secrets Manager), utiliser ExternalSecrets Operator à la place. Adapter le template `secrets.yaml` du chart Helm pour référencer le SecretStore.
