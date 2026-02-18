# AI_SCRIPTING.md — Génération automatique de scripts de test par IA

## Vue d'ensemble

Le module IA-SCRIPT-1 permet de générer automatiquement des scripts de test (Playwright, RobotFramework, etc.) à partir de la combinaison **Profile + Scenario + Dataset Bundle**. Le système construit un prompt déterministe, le soumet à l'IA, valide la sortie via des schémas Zod stricts, et stocke les scripts générés dans un repository versionné.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        UI (ScenariosPage)                    │
│  [Générer Prompt]  [Générer Script]                          │
└──────────┬──────────────────┬────────────────────────────────┘
           │                  │
           ▼                  ▼
┌──────────────────┐  ┌──────────────────────────────────────┐
│ GeneratePromptModal│  │ GenerateScriptModal                  │
│ (affiche prompt)   │  │ (plan → generate → save)             │
└──────────────────┘  └──────────┬───────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           buildAiScriptContext      Prompt Templates (v1)
           (normalise les données)   PLAN / GEN / REPAIR
                    │                         │
                    ▼                         ▼
           AiScriptContext            Zod Validation
           (JSON déterministe)        (ScriptPlanResult,
                                       ScriptPackage,
                                       RepairResult)
                                              │
                                              ▼
                                     ScriptRepository
                                     (localStorage / API)
```

---

## Fichiers du module

| Fichier | Rôle |
|---------|------|
| `client/src/ai/types.ts` | Types TypeScript + schémas Zod (ScriptPlanResult, ScriptPackage, RepairResult, AiScriptContext, GeneratedScript) |
| `client/src/ai/buildContext.ts` | `buildAiScriptContext()` — assemble le contexte normalisé |
| `client/src/ai/promptTemplates.ts` | 3 templates de prompt versionnés (PLAN_v1, GEN_v1, REPAIR_v1) |
| `client/src/ai/scriptRepository.ts` | CRUD localStorage pour les scripts générés |
| `client/src/ai/index.ts` | Barrel export du module |
| `client/src/components/GeneratePromptModal.tsx` | Modale "Générer Prompt" (affiche + copie) |
| `client/src/components/GenerateScriptModal.tsx` | Modale "Générer Script" (plan → gen → save) |
| `client/src/pages/GeneratedScriptsPage.tsx` | Page liste des scripts (filtres, viewer, actions) |

---

## Données d'entrée : `buildAiScriptContext()`

La fonction `buildAiScriptContext` assemble un objet `AiScriptContext` à partir de :

| Source | Données extraites |
|--------|-------------------|
| **Project** | `id`, `name` |
| **Profile** | `domain`, `test_type`, `profile_type`, `runner_type`, `config` |
| **Scenario** | `id`, `title`, `steps[]`, `expected_results[]`, `required_inputs[]`, `required_dataset_types[]` |
| **Bundle** | `env`, `id`, `name`, `version` |
| **Datasets** | Fusion `merged_json` de tous les datasets du bundle |
| **Secrets** | `masked_keys[]` — clés marquées secrètes (jamais en clair) |

Le contexte inclut aussi des `generation_constraints` automatiquement inférées :

| Contrainte | Logique |
|------------|---------|
| `code_language` | TypeScript pour WEB/API, Robot pour Télécom |
| `framework_preferences` | Déduit du `runner_type` ou du `domain` |
| `style_rules` | Adaptées au `test_type` (VABF/VSR/VABE) |
| `artifact_policy` | Traces, screenshots, vidéo selon le type de test |

---

## Templates de prompt

### PROMPT_SCRIPT_PLAN_v1

Produit un **plan de génération** : choix de framework, liste des fichiers à créer, mapping étapes→fonctions, inputs manquants.

**Sortie attendue** : `ScriptPlanResult` (validé par Zod)

### PROMPT_SCRIPT_GEN_v1

Prend le plan + contexte et produit un **ScriptPackage** contenant les fichiers complets.

**Sortie attendue** : `ScriptPackage` (validé par Zod)

### PROMPT_SCRIPT_REPAIR_v1

Analyse les logs d'échec et les fichiers actuels, produit des **patches ciblés**.

**Sortie attendue** : `RepairResult` (validé par Zod)

---

## Schémas Zod (contrats de sortie)

### ScriptPlanResult

```typescript
{
  framework_choice: string,
  code_language: string,
  file_plan: [{ path, purpose, dependencies? }],
  step_mapping: [{ step_id, step_order, action, target_file, target_function, dataset_keys_used }],
  missing_inputs: [{ key, reason, severity: 'BLOCKING' | 'WARNING' }],
  notes?: string,
  warnings?: string[],
}
```

### ScriptPackage

```typescript
{
  files: [{ path, content, language? }],
  notes?: string,
  warnings?: string[],
  metadata?: { framework, code_language, scenario_id, bundle_id, generated_at, prompt_version },
}
```

### RepairResult

```typescript
{
  patches: [{ file_path, original_snippet, patched_snippet, explanation }],
  root_cause: string,
  suggested_fix: string,
  confidence: number (0-1),
  warnings?: string[],
}
```

---

## ScriptRepository

Le repository stocke les scripts générés avec versioning automatique.

| Champ | Description |
|-------|-------------|
| `script_id` | ID unique |
| `scenario_id` | Scénario source |
| `bundle_id` | Bundle utilisé |
| `env` | Environnement cible |
| `framework` | Framework choisi |
| `code_language` | Langage |
| `version` | Auto-incrémenté par scenario+framework |
| `status` | DRAFT → ACTIVE → DEPRECATED |
| `files[]` | Fichiers générés |
| `plan` | Plan de génération (optionnel) |

**Opérations** : `list`, `get`, `create`, `update`, `activate` (désactive les autres versions), `delete`, `exportFiles`.

---

## Règles de génération

1. L'IA ne doit **jamais inventer de selectors** — elle référence les clés `selectors_*` du bundle.
2. Toute valeur métier doit provenir du **dataset** (`subscriber_payload_valid`, etc.).
3. Si des `required_inputs` manquent → retourner `missing_inputs` avec severity `BLOCKING` et ne pas générer.
4. Les clés secrètes (`masked_keys`) doivent être référencées via `process.env` ou `%{ENV_VAR}`.
5. **RobotFramework** : keywords réutilisables, variables centralisées dans `variables.robot`.
6. **Playwright** : structure `spec.ts` + `helpers/` + `selectors.ts` import.

---

## UI

### Boutons sur chaque scénario

Deux boutons sont ajoutés dans la liste des scénarios (ScenariosPage) :

| Bouton | Icône | Action |
|--------|-------|--------|
| **Générer Prompt IA** | MessageSquare (violet) | Ouvre `GeneratePromptModal` — affiche le prompt prêt à copier |
| **Générer Script** | Code2 (cyan) | Ouvre `GenerateScriptModal` — lance plan+gen, affiche fichiers, propose "Save to Repo" |

### Page Scripts Générés (`/scripts`)

Accessible depuis la sidebar. Affiche tous les scripts générés avec :

- Filtres par framework, status, environnement
- Recherche textuelle
- Viewer de fichiers intégré avec onglets
- Actions : activer une version, télécharger, supprimer

---

## Endpoints API (à implémenter côté backend)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/v1/ai/scripts/plan` | Génère un plan de script |
| POST | `/api/v1/ai/scripts/generate` | Génère un ScriptPackage |
| POST | `/api/v1/ai/scripts/repair` | Génère des patches de réparation |

Chaque endpoint doit loguer : `trace_id`, `scenario_id`, `bundle_id`, `framework`, `output_hash`.

---

## Test smoke (manuel)

1. Ouvrir Scénarios → sélectionner un scénario avec des `required_dataset_types`
2. Cliquer **Générer Prompt IA** → sélectionner env + bundle → vérifier le prompt
3. Cliquer **Générer Script** → sélectionner env + bundle → lancer la génération
4. Vérifier les fichiers générés dans le viewer
5. Cliquer **Save to Repo** → aller sur `/scripts` → vérifier la présence du script
6. Activer le script → vérifier que les autres versions sont dépréciées
