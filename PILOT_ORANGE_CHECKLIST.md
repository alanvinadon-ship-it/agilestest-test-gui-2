# Checklist Pilote Orange — AgilesTest V1

> **Document de suivi** à imprimer ou cocher en ligne pendant le pilote.
> Chaque item doit être validé (✅) ou marqué comme bloquant (❌) avec un commentaire.
>
> **Version** : 2.0 — Février 2026

---

## Checklist J-15 — Choix packaging et provisioning

| # | Item | Responsable | Statut | Commentaire |
|---|------|------------|--------|-------------|
| 1 | Mode de déploiement choisi (Compose ou K8s) | Ops + Chef projet | ☐ | |
| 2 | Infrastructure provisionnée (VM ou cluster K8s) | Ops | ☐ | |
| 3 | CPU/RAM/Disque conformes aux prérequis | Ops | ☐ | |
| 4 | Archive `agilestest-dual-packaging-vX.Y.Z.tar.gz` déployée | Ops | ☐ | |
| 5 | Images Docker construites (frontend, runner, orchestration) | Ops | ☐ | |
| 6 | `.env` configuré (Compose) ou values overlay (K8s) | Ops | ☐ | |
| 7 | `init.sh` exécuté (Compose) ou `helm install` (K8s) | Ops | ☐ | |
| 8 | `smoke_test.sh` ou `helm test` passé (16 tests) | Ops | ☐ | |

---

## Checklist J-7 — Préparation infrastructure

| # | Item | Responsable | Statut | Commentaire |
|---|------|------------|--------|-------------|
| 1 | Serveur AgilesTest accessible sur le réseau Orange | Ops | ☐ | |
| 2 | URL de la plateforme communiquée aux participants | Ops | ☐ | |
| 3 | Certificat SSL valide (TLS) | Ops | ☐ | |
| 4 | Docker Engine opérationnel sur le serveur runner | Ops | ☐ | |
| 5 | Image `agilestest-runner-agent` construite et disponible | Ops | ☐ | |
| 6 | MinIO/S3 démarré et bucket `agilestest-artifacts` créé | Ops | ☐ | |
| 7 | Connectivité MinIO testée depuis le runner | Ops | ☐ | |
| 8 | Compte ADMIN créé (`admin@agilestest.io`) | Admin | ☐ | |
| 9 | Compte MANAGER créé (`manager@orange.ci`) | Admin | ☐ | |
| 10 | Compte VIEWER créé (`viewer@orange.ci`) | Admin | ☐ | |
| 11 | Invitations envoyées et acceptées | Admin | ☐ | |
| 12 | Jeux de données `users` préparés pour `PILOT_ORANGE` | QA Lead | ☐ | |
| 13 | Jeux de données `form_data` préparés | QA Lead | ☐ | |
| 14 | Jeux de données `api_endpoints` préparés | QA Lead | ☐ | |
| 15 | Données Drive Test (CSV/JSON) disponibles | Réseau | ☐ | |
| 16 | Probe agent déployé (si mode B prévu) | Ops | ☐ | |
| 17 | Token X-PROBE-TOKEN configuré (si mode B) | Ops | ☐ | |
| 18 | Interface miroir SPAN/TAP connectée (si mode B) | Réseau | ☐ | |
| 19 | Canal Email SMTP configuré dans `/admin/notifications` | Admin | ☐ | |

---

## Checklist J-2 — Validation technique

| # | Item | Responsable | Statut | Commentaire |
|---|------|------------|--------|-------------|
| 1 | Connexion ADMIN réussie | QA Lead | ☐ | |
| 2 | Connexion MANAGER réussie | QA Lead | ☐ | |
| 3 | Connexion VIEWER réussie | QA Lead | ☐ | |
| 4 | Navigation fluide dans toutes les sections | QA Lead | ☐ | |
| 5 | Section Administration visible uniquement pour ADMIN | QA Lead | ☐ | |
| 6 | Projet pilote `Orange-WEB` pré-créé | Admin | ☐ | |
| 7 | Dataset types vérifiés dans `/dataset-types` | QA Lead | ☐ | |
| 8 | Runner Docker connecté et en statut ONLINE | Ops | ☐ | |
| 9 | Job de test lancé et complété avec succès | Ops | ☐ | |
| 10 | Upload d'artefact vers MinIO vérifié | Ops | ☐ | |
| 11 | Documentation accessible dans `/docs` (17 guides) | QA Lead | ☐ | |
| 12 | Salle de pilote réservée et matériel vérifié | Logistique | ☐ | |
| 13 | Participants confirmés (noms + emails) | Chef de projet | ☐ | |
| 14 | Probe health check OK (si mode B) : `/probe/health` → 200 | Ops | ☐ | |
| 15 | Test capture 30s réussi (si mode B) : packets > 0 | Ops | ☐ | |
| 16 | Email de test envoyé et reçu via `/admin/notifications` | Admin | ☐ | |
| 17 | Règle `EXECUTION_FAILED` activée | Admin | ☐ | |
| 18 | Dry run complet (fail → repair → rerun → PASSED) | QA Lead | ☐ | |

---

## Checklist Jour J — Briefing

| # | Item | Responsable | Statut | Commentaire |
|---|------|------------|--------|-------------|
| 1 | Briefing de 15 min effectué | Chef de projet | ☐ | |
| 2 | Runbook V2 distribué aux participants | Chef de projet | ☐ | |
| 3 | Identifiants distribués (ADMIN/MANAGER/VIEWER) | Admin | ☐ | |
| 4 | Plateforme accessible depuis tous les postes | Ops | ☐ | |
| 5 | Chronomètre prêt pour mesure des temps | QA Lead | ☐ | |
| 6 | Outil de capture d'écran disponible | Participants | ☐ | |

---

## Parcours 1 — WEB VABF (30 min)

**Profil** : MANAGER | **Chrono départ** : ___:___ | **Chrono fin** : ___:___

| # | Étape | Résultat attendu | Statut | Preuve |
|---|-------|------------------|--------|--------|
| 1.1 | Créer projet `Orange-WEB` | Projet visible dans `/projects` | ☐ | |
| 1.2 | Sélectionner le projet comme actif | Indicateur dans la barre latérale | ☐ | |
| 1.3 | Créer profil `WEB-E2E-VABF` (WEB, VABF, UI_E2E) | Profil avec badge VABF | ☐ | |
| 1.4 | Suggérer scénarios IA (scope Standard) | ≥ 6 templates WEB VABF proposés | ☐ | |
| 1.5 | Importer 2 scénarios (Login + Form Submit) | 2 scénarios en statut Draft | ☐ | |
| 1.6 | Finaliser scénario Login | Statut passe à Final | ☐ | |
| 1.7 | Finaliser scénario Form Submit | Statut passe à Final | ☐ | |
| 1.8 | Créer dataset instance `users` (PILOT_ORANGE) | Instance créée | ☐ | |
| 1.9 | Créer dataset instance `form_data` (PILOT_ORANGE) | Instance créée | ☐ | |
| 1.10 | Créer bundle `Bundle-WEB-PILOT` et activer | Bundle ACTIVE avec 2 instances | ☐ | |
| 1.11 | Générer script IA — Étape Plan | Plan de test affiché | ☐ | |
| 1.12 | Générer script IA — Étape Gen | Code Playwright généré | ☐ | |
| 1.13 | Activer le script | Badge ACTIVE | ☐ | |
| 1.14 | Lancer exécution depuis Run Center | Statut PENDING → RUNNING | ☐ | |
| 1.15 | Exécution terminée | Statut PASSED ou FAILED | ☐ | |
| 1.16 | Vérifier artefacts (LOG, SCREENSHOT, TRACE) | Artefacts listés dans le détail | ☐ | |
| 1.17 | Vérifier section Capture Réseau | Mode effectif affiché | ☐ | |

**Observations** : _______________________________________________________________

---

## Parcours 2 — API VABF + mini-VABE (30–45 min)

**Profil** : MANAGER | **Chrono départ** : ___:___ | **Chrono fin** : ___:___

| # | Étape | Résultat attendu | Statut | Preuve |
|---|-------|------------------|--------|--------|
| 2.1 | Créer profil `API-REST-VABF` (API, VABF, REST) | Profil créé | ☐ | |
| 2.2 | Suggérer scénarios API (scope Standard) | ≥ 4 templates API proposés | ☐ | |
| 2.3 | Importer CRUD + Error Codes | 2 scénarios Draft | ☐ | |
| 2.4 | Finaliser les 2 scénarios | Statut Final | ☐ | |
| 2.5 | Créer dataset `api_endpoints` (PILOT_ORANGE) | Instance créée | ☐ | |
| 2.6 | Créer/compléter bundle API | Bundle ACTIVE | ☐ | |
| 2.7 | Générer scripts IA pour CRUD | Script généré | ☐ | |
| 2.8 | Générer scripts IA pour Error Codes | Script généré | ☐ | |
| 2.9 | Activer les scripts | 2 scripts ACTIVE | ☐ | |
| 2.10 | Lancer exécution CRUD | Résultat PASSED/FAILED | ☐ | |
| 2.11 | Lancer exécution Error Codes | Résultat PASSED/FAILED | ☐ | |
| 2.12 | Créer profil `API-LOAD-VABE` (API, VABE, REST) | Profil créé | ☐ | |
| 2.13 | Importer scénario LOAD_BASELINE | Scénario Draft | ☐ | |
| 2.14 | Configurer dataset de charge | Données de charge saisies | ☐ | |
| 2.15 | Générer et lancer script de charge | Exécution lancée | ☐ | |
| 2.16 | Vérifier métriques de performance | Latence p50/p95/p99 affichées | ☐ | |

**Observations** : _______________________________________________________________

---

## Parcours 3 — Drive Test opérateur-grade (60 min)

**Profil** : MANAGER | **Chrono départ** : ___:___ | **Chrono fin** : ___:___

| # | Étape | Résultat attendu | Statut | Preuve |
|---|-------|------------------|--------|--------|
| 3.1 | Créer campagne `Campagne-Abidjan-Centre` | Campagne PLANNED | ☐ | |
| 3.2 | Ajouter route `Route-Plateau-Cocody` | Route visible | ☐ | |
| 3.3 | Ajouter device `Samsung-S24-Test` | Device listé | ☐ | |
| 3.4 | Configurer capture réseau (mode A ou B) | Mode affiché dans `/settings` | ☐ | |
| 3.5 | Test capture probe 30s (si mode B) | packets > 0, taille affichée | ☐ | |
| 3.6 | Ouvrir ImportResultsModal | Modal affiché | ☐ | |
| 3.7 | Importer fichier CSV de mesures radio | Données parsées | ☐ | |
| 3.8 | Confirmer l'import | Résultats dans la campagne | ☐ | |
| 3.9 | Naviguer vers `/drive/reporting` | Page reporting affichée | ☐ | |
| 3.10 | Vérifier barre de segments colorés (OK/WARN/CRIT) | Segments colorés visibles | ☐ | |
| 3.11 | Vérifier filtre KPI (RSRP, SINR, throughput) | Filtre fonctionnel | ☐ | |
| 3.12 | Vérifier slider window (5s/10s/30s) | Agrégation change | ☐ | |
| 3.13 | Drill-down sur segment CRIT | Panneau latéral avec stats | ☐ | |
| 3.14 | Vérifier artefacts liés dans le drill-down | PCAP/logs listés avec source | ☐ | |
| 3.15 | Vérifier auto-incidents générés (P0/P1/P2) | Incidents dans la section | ☐ | |
| 3.16 | Vérifier déduplication incidents | Pas de doublon | ☐ | |
| 3.17 | Cliquer "Analyser & Repair" sur incident P0 | Page rapport d'incident | ☐ | |
| 3.18 | Vérifier hypothèses par couche (Radio/Core/QoS/App) | Hypothèses affichées | ☐ | |
| 3.19 | Cliquer evidence chips | Navigation vers preuves | ☐ | |
| 3.20 | Vérifier recommandations catégorisées | Actions avec effort/risque | ☐ | |
| 3.21 | Cliquer "Generate Rerun Job" | Job pré-rempli | ☐ | |
| 3.22 | Exporter CSV reporting | Fichier CSV téléchargé | ☐ | |
| 3.23 | Lancer DriveJob (si runner disponible) | Job lancé | ☐ | |

**Observations** : _______________________________________________________________

---

## Parcours 4 — Incident → Repair → Rerun (30 min)

**Profil** : MANAGER + ADMIN | **Chrono départ** : ___:___ | **Chrono fin** : ___:___

| # | Étape | Résultat attendu | Statut | Preuve |
|---|-------|------------------|--------|--------|
| 4.1 | Modifier dataset pour provoquer un échec | Dataset modifié | ☐ | |
| 4.2 | Lancer exécution | Statut FAILED | ☐ | |
| 4.3 | Vérifier rapport d'incident (sévérité, description) | Incident affiché | ☐ | |
| 4.4 | Vérifier artefacts d'échec (screenshot, logs) | Artefacts présents | ☐ | |
| 4.5 | Cliquer sur "Lancer le repair IA" | Analyse en cours | ☐ | |
| 4.6 | Vérifier cause racine identifiée | Description textuelle | ☐ | |
| 4.7 | Vérifier score de confiance | Score affiché (ex: 82%) | ☐ | |
| 4.8 | Examiner le diff viewer (avant/après) | Patches visibles | ☐ | |
| 4.9 | Cliquer "Activate & Rerun" | Toast de confirmation | ☐ | |
| 4.10 | Attendre la nouvelle exécution | Statut PASSED | ☐ | |
| 4.11 | Vérifier le lien vers l'exécution d'origine | Badge "Repair de..." | ☐ | |
| 4.12 | Restaurer le dataset original | Dataset restauré | ☐ | |

**Observations** : _______________________________________________________________

---

## Parcours 5 — Validation Notifications (15 min)

**Profil** : ADMIN | **Chrono départ** : ___:___ | **Chrono fin** : ___:___

| # | Étape | Résultat attendu | Statut | Preuve |
|---|-------|------------------|--------|--------|
| 5.1 | Accéder à `/admin/notifications` | Page 5 onglets affichée | ☐ | |
| 5.2 | Configurer Email SMTP | Formulaire rempli et sauvé | ☐ | |
| 5.3 | Envoyer email de test | Email reçu | ☐ | |
| 5.4 | Configurer SMS Orange (ou vérifier mode stub) | Canal configuré ou stub actif | ☐ | |
| 5.5 | Vérifier 8 templates système | Templates listés | ☐ | |
| 5.6 | Prévisualiser un template avec variables | Preview rendu correctement | ☐ | |
| 5.7 | Activer règle `EXECUTION_FAILED` | Règle ACTIVE | ☐ | |
| 5.8 | Activer règle `DRIVE_KPI_THRESHOLD_BREACH` | Règle ACTIVE | ☐ | |
| 5.9 | Tester une règle | Notification de test reçue | ☐ | |
| 5.10 | Vérifier Delivery Logs (≥ 3 entrées) | Logs avec statut DELIVERED | ☐ | |
| 5.11 | Drill-down sur une entrée | Contenu rendu + trace_id | ☐ | |
| 5.12 | Exporter CSV des delivery logs | Fichier CSV téléchargé | ☐ | |

**Observations** : _______________________________________________________________

---

## Vérification RBAC

| # | Test | Profil | Résultat attendu | Statut |
|---|------|--------|------------------|--------|
| R1 | Section Admin visible | ADMIN | Visible | ☐ |
| R2 | Section Admin invisible | MANAGER | Invisible | ☐ |
| R3 | Section Admin invisible | VIEWER | Invisible | ☐ |
| R4 | Créer un scénario | MANAGER | Succès | ☐ |
| R5 | Créer un scénario | VIEWER | Bouton absent/désactivé | ☐ |
| R6 | Supprimer un projet | ADMIN | Succès | ☐ |
| R7 | Supprimer un projet | MANAGER | Bouton absent | ☐ |
| R8 | Voir secrets dataset | ADMIN | Secrets visibles | ☐ |
| R9 | Voir secrets dataset | MANAGER | Secrets masqués | ☐ |
| R10 | Lancer une exécution | MANAGER | Succès | ☐ |
| R11 | Lancer une exécution | VIEWER | Bouton absent | ☐ |
| R12 | Consulter audit | ADMIN | Journal affiché | ☐ |
| R13 | Consulter audit | MANAGER | Page inaccessible (403) | ☐ |
| R14 | Gérer invitations | ADMIN | Formulaire accessible | ☐ |
| R15 | Gérer invitations | MANAGER | Page inaccessible | ☐ |
| R16 | Accéder `/admin/notifications` | ADMIN | Page affichée | ☐ |
| R17 | Accéder `/admin/notifications` | MANAGER | 403 Forbidden | ☐ |
| R18 | Accéder `/admin/notifications` | VIEWER | 403 Forbidden | ☐ |

---

## Vérification Capture Réseau

| # | Test | Mode | Résultat attendu | Statut |
|---|------|------|------------------|--------|
| CA1 | Politique par défaut configurée | A ou B | Mode affiché dans `/settings` | ☐ |
| CA2 | Override campagne (si testé) | — | Override visible dans campagne | ☐ |
| CA3 | Mode effectif affiché dans Run Center | — | Badge mode effectif | ☐ |
| CA4 | PCAP généré (mode A) | A | Artefact PCAP source=RUNNER | ☐ |
| CA5 | Session probe créée (mode B) | B | Session DONE dans `/probes` | ☐ |
| CA6 | PCAP généré (mode B) | B | Artefact PCAP source=PROBE | ☐ |
| CA7 | Probe health check | B | Badge Online, last_seen < 60s | ☐ |
| CA8 | Test capture 30s | B | packets > 0 | ☐ |
| CA9 | Reason code affiché si erreur | B | Code + message dans exécution | ☐ |

---

## Récapitulatif final

| Parcours | Durée réelle | Items OK | Items KO | Bloquants |
|----------|-------------|----------|----------|-----------|
| 1 — WEB VABF | ___:___ | ___/17 | ___/17 | |
| 2 — API VABF + VABE | ___:___ | ___/16 | ___/16 | |
| 3 — Drive Test opérateur-grade | ___:___ | ___/23 | ___/23 | |
| 4 — Repair | ___:___ | ___/12 | ___/12 | |
| 5 — Notifications | ___:___ | ___/12 | ___/12 | |
| RBAC | — | ___/18 | ___/18 | |
| Capture réseau | — | ___/9 | ___/9 | |
| **Total** | **___:___** | **___/107** | **___/107** | |

**Validé par** : _________________________ **Date** : ___/___/2026

**Signature** : _________________________
