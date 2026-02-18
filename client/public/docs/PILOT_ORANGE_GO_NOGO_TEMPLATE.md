# Grille GO/NOGO — Pilote Orange AgilesTest V1

> **Document d'évaluation** à remplir à l'issue du pilote pour statuer sur la décision GO/NOGO.
>
> **Version** : 2.0 — Février 2026
> **Date du pilote** : ___/___/2026
> **Lieu** : ________________________
> **Participants** : ___ personnes

---

## 1. Informations générales

| Champ | Valeur |
|-------|--------|
| Chef de projet Orange | |
| Responsable QA | |
| Ingénieur réseau | |
| Représentant AgilesTest | |
| Durée effective du pilote | ___h ___min |
| Nombre de parcours complétés | ___/5 |
| Mode de déploiement utilisé | ☐ Docker Compose / ☐ Kubernetes |

---

## 2. Critères d'évaluation pondérés

### C1 — Compréhension incident sans assistance (20%)

> **Question** : Les participants ont-ils compris la cause d'un échec de test en lisant uniquement le rapport d'incident généré par la plateforme, sans aide extérieure ?

| Participant | A compris la cause ? | Temps de compréhension | Commentaire |
|-------------|:-------------------:|----------------------|-------------|
| Participant 1 | ☐ Oui / ☐ Non | ___min | |
| Participant 2 | ☐ Oui / ☐ Non | ___min | |
| Participant 3 | ☐ Oui / ☐ Non | ___min | |
| Participant 4 | ☐ Oui / ☐ Non | ___min | |
| Participant 5 | ☐ Oui / ☐ Non | ___min | |

**Taux de compréhension** : ___/___  = **___%**

| Seuil | Résultat |
|-------|----------|
| ≥ 80% | GO |
| 60–79% | GO conditionnel |
| < 60% | NOGO |

**Score C1** : ☐ GO / ☐ GO conditionnel / ☐ NOGO

---

### C2 — Temps gagné vs baseline (15%)

> **Question** : Combien de temps la génération IA de scripts a-t-elle permis de gagner par rapport à l'écriture manuelle ?

| Mesure | Temps (min) |
|--------|-------------|
| **Baseline** : Temps estimé pour écrire manuellement 1 script Playwright (Login E2E) | ___ |
| **AgilesTest** : Temps mesuré pour générer le script IA (Plan + Gen + Activation) | ___ |
| **Différence** | ___ |
| **Gain en %** | **___%** |

Pour le parcours complet (2 scripts) :

| Mesure | Temps (min) |
|--------|-------------|
| Baseline (2 scripts manuels) | ___ |
| AgilesTest (2 scripts IA) | ___ |
| Gain total | ___ |
| **Gain en %** | **___%** |

| Seuil | Résultat |
|-------|----------|
| ≥ 30% de gain | GO |
| 15–29% de gain | GO conditionnel |
| < 15% de gain | NOGO |

**Score C2** : ☐ GO / ☐ GO conditionnel / ☐ NOGO

---

### C3 — Stabilité des exécutions (15%)

> **Question** : Sur N exécutions identiques (même scénario, même bundle, même environnement), quel est le taux de succès ?

| Run # | Scénario | Résultat | Durée | Commentaire |
|-------|----------|----------|-------|-------------|
| 1 | | ☐ PASSED / ☐ FAILED | ___s | |
| 2 | | ☐ PASSED / ☐ FAILED | ___s | |
| 3 | | ☐ PASSED / ☐ FAILED | ___s | |
| 4 | | ☐ PASSED / ☐ FAILED | ___s | |
| 5 | | ☐ PASSED / ☐ FAILED | ___s | |
| 6 | | ☐ PASSED / ☐ FAILED | ___s | |
| 7 | | ☐ PASSED / ☐ FAILED | ___s | |
| 8 | | ☐ PASSED / ☐ FAILED | ___s | |
| 9 | | ☐ PASSED / ☐ FAILED | ___s | |
| 10 | | ☐ PASSED / ☐ FAILED | ___s | |

**Taux de succès** : ___/___  = **___%**

| Seuil | Résultat |
|-------|----------|
| ≥ 90% | GO |
| 75–89% | GO conditionnel |
| < 75% | NOGO |

**Score C3** : ☐ GO / ☐ GO conditionnel / ☐ NOGO

---

### C4 — Adoption déclarative (15%)

> **Question** : Les participants utiliseraient-ils AgilesTest au quotidien dans leur travail ?

Chaque participant note sur une échelle de Likert (1 = Pas du tout d'accord, 5 = Tout à fait d'accord) :

| Affirmation | P1 | P2 | P3 | P4 | P5 |
|-------------|:--:|:--:|:--:|:--:|:--:|
| "Je comprends la valeur ajoutée d'AgilesTest" | /5 | /5 | /5 | /5 | /5 |
| "L'interface est intuitive et facile à prendre en main" | /5 | /5 | /5 | /5 | /5 |
| "La génération IA de scripts est utile" | /5 | /5 | /5 | /5 | /5 |
| "Le repair IA m'aide à corriger les scripts plus vite" | /5 | /5 | /5 | /5 | /5 |
| "Le Drive Test opérateur-grade est exploitable" | /5 | /5 | /5 | /5 | /5 |
| "**Je l'utiliserais au quotidien**" | /5 | /5 | /5 | /5 | /5 |
| "Je recommanderais AgilesTest à un collègue" | /5 | /5 | /5 | /5 | /5 |

**Score moyen "Je l'utiliserais au quotidien"** : ___/5

**% de participants avec score ≥ 4** : ___/___  = **___%**

| Seuil | Résultat |
|-------|----------|
| ≥ 70% avec score ≥ 4 | GO |
| 50–69% avec score ≥ 4 | GO conditionnel |
| < 50% avec score ≥ 4 | NOGO |

**Score C4** : ☐ GO / ☐ GO conditionnel / ☐ NOGO

---

### C5 — Couverture fonctionnelle (10%)

> **Question** : Les 5 parcours du pilote ont-ils été complétés sans blocage critique ?

| Parcours | Complété ? | Bloquants rencontrés | Commentaire |
|----------|:----------:|---------------------|-------------|
| 1 — WEB VABF | ☐ Oui / ☐ Non | ___ | |
| 2 — API VABF + VABE | ☐ Oui / ☐ Non | ___ | |
| 3 — Drive Test opérateur-grade | ☐ Oui / ☐ Non | ___ | |
| 4 — Repair | ☐ Oui / ☐ Non | ___ | |
| 5 — Notifications | ☐ Oui / ☐ Non | ___ | |

**Parcours complétés** : ___/5

| Seuil | Résultat |
|-------|----------|
| 5/5 complétés | GO |
| 4/5 complétés | GO conditionnel |
| ≤ 3/5 complétés | NOGO |

**Score C5** : ☐ GO / ☐ GO conditionnel / ☐ NOGO

---

### C6 — RBAC opérationnel (10%)

> **Question** : Les restrictions de permission fonctionnent-elles correctement pour les 3 profils ?

| Test RBAC | Résultat attendu | Résultat observé | Conforme ? |
|-----------|------------------|------------------|:----------:|
| ADMIN voit section Administration | Visible | | ☐ |
| MANAGER ne voit pas section Administration | Invisible | | ☐ |
| VIEWER ne voit pas section Administration | Invisible | | ☐ |
| MANAGER peut créer un scénario | Succès | | ☐ |
| VIEWER ne peut pas créer un scénario | Refusé | | ☐ |
| ADMIN peut supprimer un projet | Succès | | ☐ |
| MANAGER ne peut pas supprimer un projet | Refusé | | ☐ |
| ADMIN voit les secrets dataset | Visible | | ☐ |
| MANAGER ne voit pas les secrets dataset | Masqué | | ☐ |
| VIEWER ne peut pas lancer d'exécution | Refusé | | ☐ |
| ADMIN accède à `/admin/notifications` | Page affichée | | ☐ |
| MANAGER n'accède pas à `/admin/notifications` | 403 Forbidden | | ☐ |

**Tests conformes** : ___/12

| Seuil | Résultat |
|-------|----------|
| 12/12 (100%) | GO |
| 10–11/12 (83–92%) | GO conditionnel |
| < 10/12 | NOGO |

**Score C6** : ☐ GO / ☐ GO conditionnel / ☐ NOGO

---

### C7 — Drive Test opérateur-grade (10%)

> **Question** : Les fonctionnalités Drive Test avancées (segmentation, auto-incidents, repair multi-couches) sont-elles exploitables par un ingénieur réseau Orange ?

| Fonctionnalité | Fonctionnel ? | Exploitable ? | Commentaire |
|----------------|:-------------:|:-------------:|-------------|
| Segmentation 50m avec couleurs OK/WARN/CRIT | ☐ Oui / ☐ Non | ☐ Oui / ☐ Non | |
| Drill-down segment avec stats KPI | ☐ Oui / ☐ Non | ☐ Oui / ☐ Non | |
| Auto-incidents P0/P1/P2 générés | ☐ Oui / ☐ Non | ☐ Oui / ☐ Non | |
| Rapport d'incident avec hypothèses par couche | ☐ Oui / ☐ Non | ☐ Oui / ☐ Non | |
| Evidence chips cliquables | ☐ Oui / ☐ Non | ☐ Oui / ☐ Non | |
| Recommandations catégorisées (effort/risque) | ☐ Oui / ☐ Non | ☐ Oui / ☐ Non | |
| Plan de rerun ciblé | ☐ Oui / ☐ Non | ☐ Oui / ☐ Non | |
| Artefacts PCAP corrélés aux segments | ☐ Oui / ☐ Non | ☐ Oui / ☐ Non | |

**Fonctionnalités fonctionnelles** : ___/8
**Fonctionnalités exploitables** : ___/8

| Seuil | Résultat |
|-------|----------|
| ≥ 7/8 fonctionnelles ET ≥ 6/8 exploitables | GO |
| ≥ 5/8 fonctionnelles | GO conditionnel |
| < 5/8 fonctionnelles | NOGO |

**Score C7** : ☐ GO / ☐ GO conditionnel / ☐ NOGO

---

### C8 — Notifications opérationnelles (5%)

> **Question** : Le système de notifications est-il configuré et opérationnel ?

| Fonctionnalité | Validé ? | Commentaire |
|----------------|:--------:|-------------|
| Au moins 1 canal configuré (Email ou SMS) | ☐ Oui / ☐ Non | |
| Email de test reçu | ☐ Oui / ☐ Non | |
| Au moins 2 règles activées | ☐ Oui / ☐ Non | |
| Delivery logs affichent les envois | ☐ Oui / ☐ Non | |
| Throttle fonctionnel (pas de spam) | ☐ Oui / ☐ Non | |

**Items validés** : ___/5

| Seuil | Résultat |
|-------|----------|
| ≥ 4/5 validés | GO |
| 3/5 validés | GO conditionnel |
| < 3/5 validés | NOGO |

**Score C8** : ☐ GO / ☐ GO conditionnel / ☐ NOGO

---

## 3. Critères bloquants (NOGO immédiat)

Cocher si l'un des critères bloquants suivants a été observé pendant le pilote :

| # | Critère bloquant | Observé ? | Description |
|---|-----------------|:---------:|-------------|
| B1 | Perte de données utilisateur | ☐ Oui / ☐ Non | |
| B2 | Faille de sécurité (bypass RBAC) | ☐ Oui / ☐ Non | |
| B3 | Indisponibilité > 15 min | ☐ Oui / ☐ Non | |
| B4 | Corruption d'artefacts MinIO | ☐ Oui / ☐ Non | |
| B5 | Perte de capture réseau (PCAP corrompus) | ☐ Oui / ☐ Non | |

**Critère bloquant déclenché** : ☐ Oui → **NOGO immédiat** / ☐ Non → Continuer l'évaluation

---

## 4. Calcul du score global

| Critère | Poids | Score (GO=100, Cond=70, NOGO=30) | Score pondéré |
|---------|:-----:|:--------------------------------:|:-------------:|
| C1 — Compréhension incident | 20% | ___ | ___ |
| C2 — Temps gagné | 15% | ___ | ___ |
| C3 — Stabilité exécutions | 15% | ___ | ___ |
| C4 — Adoption déclarative | 15% | ___ | ___ |
| C5 — Couverture fonctionnelle | 10% | ___ | ___ |
| C6 — RBAC opérationnel | 10% | ___ | ___ |
| C7 — Drive Test opérateur-grade | 10% | ___ | ___ |
| C8 — Notifications opérationnelles | 5% | ___ | ___ |
| **TOTAL** | **100%** | | **___** |

---

## 5. Décision finale

| Score global | Décision |
|:------------:|----------|
| ≥ 75 | **GO** — Déploiement élargi validé |
| 60–74 | **GO conditionnel** — Déploiement avec réserves |
| < 60 | **NOGO** — Pilote à refaire après corrections |

### Décision

☐ **GO** — La plateforme AgilesTest V1 est validée pour un déploiement élargi chez Orange CIV.

☐ **GO conditionnel** — La plateforme est validée sous réserve des actions correctives suivantes :

| # | Action corrective | Responsable | Échéance |
|---|-------------------|------------|----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

☐ **NOGO** — Le pilote doit être refait après les corrections suivantes :

| # | Correction requise | Priorité | Responsable | Échéance |
|---|-------------------|----------|------------|----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## 6. Retours qualitatifs

### Points forts identifiés

| # | Point fort | Commentaire |
|---|-----------|-------------|
| 1 | | |
| 2 | | |
| 3 | | |

### Points d'amélioration

| # | Point d'amélioration | Priorité | Suggestion |
|---|---------------------|----------|------------|
| 1 | | ☐ Haute / ☐ Moyenne / ☐ Basse | |
| 2 | | ☐ Haute / ☐ Moyenne / ☐ Basse | |
| 3 | | ☐ Haute / ☐ Moyenne / ☐ Basse | |

### Fonctionnalités demandées pour V2

| # | Fonctionnalité | Justification | Priorité |
|---|---------------|---------------|----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

### Retour spécifique Drive Test opérateur-grade

| Question | Réponse |
|----------|---------|
| Les seuils KPI par défaut sont-ils adaptés au réseau Orange CIV ? | |
| Les hypothèses par couche sont-elles pertinentes pour le diagnostic terrain ? | |
| Le plan de rerun ciblé est-il exploitable opérationnellement ? | |
| Quels KPI supplémentaires souhaités pour V2 ? | |

### Retour spécifique Notifications

| Question | Réponse |
|----------|---------|
| Le canal Email est-il suffisant ou le SMS est-il indispensable ? | |
| Les templates système couvrent-ils les besoins ? | |
| Le throttle est-il correctement calibré ? | |
| Quels événements supplémentaires souhaités ? | |

---

## 7. Signatures

| Rôle | Nom | Signature | Date |
|------|-----|-----------|------|
| Chef de projet Orange | | | ___/___/2026 |
| Responsable QA Orange | | | ___/___/2026 |
| Ingénieur réseau Orange | | | ___/___/2026 |
| Représentant AgilesTest | | | ___/___/2026 |
| Direction technique (si GO) | | | ___/___/2026 |

---

> **Note** : Ce document doit être archivé avec les preuves collectées (captures d'écran, fichiers CSV exportés, logs, delivery logs) dans le dossier du pilote.
