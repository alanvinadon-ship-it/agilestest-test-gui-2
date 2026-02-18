# SMOKE_TESTS — Étapes et résultats attendus

> **Version** : 1.0.0 — Mission PACKAGING-DUAL-1  
> **Objectif** : Valider que l'installation est opérationnelle dans les deux modes.

---

## 1. Tests d'infrastructure

Ces tests vérifient que tous les services sont démarrés et accessibles.

| # | Test | Compose | K8s | Résultat attendu |
|---|------|---------|-----|------------------|
| 1 | Reverse proxy / Ingress health | `curl http://localhost/health` | `kubectl get ingress` | HTTP 200 "OK" |
| 2 | Frontend accessible | `curl http://localhost/` | `curl http://<domain>/` | HTML contenant "AgilesTest" |
| 3 | Frontend retourne 200 | `curl -o /dev/null -w '%{http_code}'` | idem | Code 200 |
| 4 | API orchestration health | `curl http://localhost/api/health` | `curl http://<svc>:4000/health` | HTTP 200 ou 404 |
| 5 | MinIO health | `docker exec minio mc ready local` | `curl http://<svc>:9000/minio/health/live` | HTTP 200 |
| 6 | MinIO ready | via mc | `curl .../minio/health/ready` | HTTP 200 |

---

## 2. Tests MinIO (stockage artefacts)

| # | Test | Commande | Résultat attendu |
|---|------|----------|------------------|
| 7 | Bucket existe | `mc ls local/agilestest-artifacts` | Liste (vide ou avec objets) |
| 8 | Upload test | `echo test \| mc pipe local/agilestest-artifacts/smoke.txt` | Upload réussi |
| 9 | Download test | `mc cat local/agilestest-artifacts/smoke.txt` | Contenu "test" |
| 10 | Delete test | `mc rm local/agilestest-artifacts/smoke.txt` | Suppression réussie |

---

## 3. Tests des conteneurs / pods

| # | Test | Compose | K8s | Résultat attendu |
|---|------|---------|-----|------------------|
| 11 | Proxy running | `docker ps \| grep proxy` | `kubectl get pod -l app=frontend` | Status "Up" / "Running" |
| 12 | Frontend running | `docker ps \| grep frontend` | idem | Status "Up" / "Running" |
| 13 | Orchestration running | `docker ps \| grep orchestration` | idem | Status "Up" / "Running" |
| 14 | Runner running | `docker ps \| grep runner` | idem | Status "Up" / "Running" |
| 15 | MinIO running | `docker ps \| grep minio` | idem | Status "Up" / "Running" |

---

## 4. Tests de sécurité

| # | Test | Commande | Résultat attendu |
|---|------|----------|------------------|
| 16 | Header X-Frame-Options | `curl -sI / \| grep X-Frame` | "SAMEORIGIN" |
| 17 | Header X-Content-Type-Options | `curl -sI / \| grep nosniff` | "nosniff" |
| 18 | Pas d'erreur 500 | `curl -o /dev/null -w '%{http_code}' /` | Code != 500 |

---

## 5. Tests fonctionnels

| # | Test | Action | Résultat attendu |
|---|------|--------|------------------|
| 19 | Page de login | Accéder à `/` | Formulaire de connexion visible |
| 20 | Assets chargés | Inspecter le HTML | Références `.js` et `.css` présentes |
| 21 | Navigation SPA | Cliquer sur un lien | Changement de page sans rechargement |

---

## 6. Exécution

### Docker Compose

```bash
cd deploy/compose
./scripts/smoke_test.sh
# Résultat attendu : 16/16 PASS (ou plus selon les tests activés)
```

### Kubernetes

```bash
# Via Helm test hook
helm test agilestest -n agilestest-pilot-orange

# Ou manuellement
kubectl apply -f charts/agilestest/templates/smoke-test-job.yaml
kubectl logs job/agilestest-smoke-test -n agilestest-pilot-orange
```

---

## 7. Critères de succès

| Critère | Seuil | Bloquant |
|---------|-------|:--------:|
| Tous les services UP | 5/5 | Oui |
| Frontend accessible | HTTP 200 | Oui |
| MinIO opérationnel | Upload/Download OK | Oui |
| Security headers | 2/2 présents | Non |
| Pas d'erreur 500 | 0 erreur | Oui |
| Smoke test global | >= 90% PASS | Oui |
