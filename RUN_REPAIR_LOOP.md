# RUN_REPAIR_LOOP — Run Center & Failure Repair Loop

## Vue d'ensemble

La mission **RUN-1 + LOOP-1** implémente le **Run Center** (lancement d'exécutions liées à un script IA) et la **boucle de réparation** (Failure → Repair → New Version → Activate & Rerun).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Run Center                            │
│  Profile → Scenario → Script ACTIVE (auto) → Bundle → Env  │
│                         ↓                                   │
│                   Execution créée                           │
│         (script_id, script_version, bundle_id,              │
│          target_env, runner_id)                              │
│                         ↓                                   │
│              ┌──────────┴──────────┐                        │
│              │                     │                        │
│           PASSED               FAILED                       │
│              │                     │                        │
│           (done)          Repair from failure                │
│                                    │                        │
│                          ┌─────────┴─────────┐              │
│                          │ AI Repair Engine   │              │
│                          │ (logs + context)   │              │
│                          └─────────┬─────────┘              │
│                                    │                        │
│                          RepairResult                       │
│                          (patches + root_cause)             │
│                                    │                        │
│                     ┌──────────────┼──────────────┐         │
│                     │                             │         │
│              Save as new version          Activate & Rerun  │
│              (script v+1 DRAFT)          (v+1 ACTIVE + run) │
└─────────────────────────────────────────────────────────────┘
```

---

## Modèle Execution étendu

| Champ | Type | Description |
|-------|------|-------------|
| `script_id` | `string?` | ID du script IA utilisé |
| `script_version` | `number?` | Version du script au moment du lancement |
| `dataset_bundle_id` | `string?` | Bundle de datasets utilisé |
| `target_env` | `TargetEnv?` | Environnement cible (DEV, PREPROD, PILOT_ORANGE, PROD) |
| `runner_id` | `string?` | Identifiant du runner/agent |
| `ai_repair_from_execution_id` | `string?` | Si repair, référence l'exécution d'origine |

---

## Run Center (ExecutionsPage)

### Fonctionnalités

Le Run Center remplace l'ancienne page Exécutions avec :

1. **Sélection automatique du script ACTIVE** : quand un scénario est sélectionné, le script avec `status: ACTIVE` est automatiquement détecté et affiché en read-only.

2. **Changement de version (ADMIN/MANAGER)** : un bouton "Changer version" permet aux rôles autorisés de sélectionner une version différente du script.

3. **Blocage si aucun script ACTIVE** : le bouton "Lancer" est désactivé si aucun script ACTIVE n'existe pour le scénario sélectionné, avec un message d'avertissement.

4. **Sélection env/bundle/runner** : l'utilisateur choisit l'environnement cible, le bundle de datasets (filtré par env et status ACTIVE), et le runner.

5. **Tableau enrichi** : la liste des exécutions affiche maintenant l'environnement, la version du script, et un badge "Repaired" pour les exécutions issues d'un repair.

### Payload de création

```typescript
localExecutions.create(projectId, {
  profile_id: string,
  scenario_id: string,
  script_id: string,        // script ACTIVE auto-détecté
  script_version: number,   // version au moment du lancement
  dataset_bundle_id?: string,
  target_env: TargetEnv,
  runner_id: string,
});
```

---

## Execution Detail & Repair Flow

### Informations affichées

La page de détail affiche maintenant 5 cartes contextuelles :
- **Durée** : temps d'exécution
- **Env** : environnement cible avec badge coloré
- **Script** : framework + version + nombre de fichiers
- **Bundle** : ID du bundle utilisé
- **Runner** : ID du runner

### Bouton Rerun

Pour les exécutions terminées (PASSED ou FAILED), un bouton **Rerun** permet de relancer avec les mêmes paramètres (clone de l'exécution).

### Repair from Failure

Pour les exécutions FAILED ou ERROR avec un script associé :

1. **Lancer le repair IA** : bouton qui envoie les artefacts (logs, screenshots, traces) et le contexte au moteur IA.

2. **Résultat du repair** :
   - **Cause racine** : description de la cause identifiée
   - **Score de confiance** : barre de progression 0-100%
   - **Correction suggérée** : résumé de la fix
   - **Diff viewer** : pour chaque patch, affichage original vs patched avec explication

3. **Actions post-repair** :
   - **Save as new version** : crée un script v+1 en status DRAFT
   - **Activate & Rerun** : crée v+1, l'active (désactive les autres), et relance immédiatement une exécution avec `ai_repair_from_execution_id` pointant vers l'exécution d'origine

---

## ScriptRepository étendu

Deux nouvelles méthodes ajoutées :

| Méthode | Description |
|---------|-------------|
| `getActive(projectId, scenarioId)` | Retourne le script ACTIVE le plus récent |
| `listVersions(projectId, scenarioId, framework?)` | Liste toutes les versions triées par version décroissante |

---

## LocalStore étendu

### `localExecutions.create()` étendu

Accepte maintenant les champs `script_id`, `script_version`, `dataset_bundle_id`, `target_env`, `runner_id`, `ai_repair_from_execution_id`.

### `localExecutions.rerun(executionId)`

Clone une exécution avec les mêmes références (profile, scenario, script, bundle, env, runner).

### Simulation améliorée

Les exécutions FAILED génèrent automatiquement :
- **Artefacts simulés** : 1 LOG + 1 SCREENSHOT
- **Incidents simulés** : 1 incident MAJOR avec expected/actual result

---

## Artefacts requis pour le repair

| Artefact | Type | Usage |
|----------|------|-------|
| Logs d'exécution | `LOG` (text) | Analyse des erreurs et stack traces |
| Screenshots | `SCREENSHOT` (png) | Vérification visuelle de l'état UI |
| Traces Playwright | `TRACE` (zip) | Replay détaillé des actions |
| Contexte IA | `AiScriptContext` | Profil + scénario + dataset (sans secrets) |

---

## Flow E2E complet

```
1. Scénario → Generate Script (IA-SCRIPT-1)
2. Activer le script (status: ACTIVE)
3. Run Center → Sélection auto du script ACTIVE
4. Lancer l'exécution (payload complet)
5. Si FAILED :
   a. Détail → "Repair from failure"
   b. IA analyse logs + context → RepairResult
   c. Diff viewer : patches proposés
   d. "Activate & Rerun" → v+1 ACTIVE + nouvelle exécution
6. Répéter jusqu'à PASSED
```

---

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `types/index.ts` | Champs Execution étendus |
| `api/localStore.ts` | create étendu, rerun, artefacts/incidents simulés |
| `ai/scriptRepository.ts` | getActive, listVersions |
| `pages/ExecutionsPage.tsx` | Run Center complet |
| `pages/ExecutionDetailPage.tsx` | Repair flow complet |

---

## Mode simulation

En mode local (localStorage), le repair utilise `simulateRepair()` qui génère un `RepairResult` déterministe basé sur les incidents de l'exécution. En mode API, l'endpoint `POST /ai/scripts/repair` sera appelé avec les artefacts et le contexte.
