# Validation E2E Import/Export Projet

## Vue d'ensemble

Ce document décrit la procédure de validation end-to-end du système d'import/export de projets AgilesTest. Le test E2E vérifie qu'un projet peuplé peut être exporté en JSON, importé dans un nouveau projet, et que l'intégrité des données est préservée à travers le cycle complet.

## Périmètre du test

Le test `server/import-export.e2e.test.ts` couvre les entités suivantes :

| Entité | Quantité seed | Champs vérifiés |
|--------|--------------|-----------------|
| Profils | 5 | name, protocol, testType, targetHost, targetPort, parameters |
| Scénarios | 10 | name, testType, steps (JSON), requiredDatasetTypes, profileId (remappé) |
| Dataset Types | 6 | datasetTypeId, name, domain, schemaFields |
| Dataset Instances | 20 | datasetTypeId, env, valuesJson, notes, status |
| Bundles | 3 | name, env, tags, items (avec datasetId remappé) |
| Bundle Items | 15+ | bundleId → uid, datasetId → uid |
| Scripts | 5 | framework, language, code, status |

## Architecture du test

### Seed (données de test)

Le seed crée un projet complet avec des données variées :

- **Profils** : 5 protocoles différents (SIP, HTTP, DIAMETER, RADIUS, SSH) avec paramètres de connexion
- **Scénarios** : 10 scénarios avec 2-4 étapes chacun, liés aux profils par rotation
- **Dataset Types** : 6 types globaux avec schémas de champs variés (domaines IMS et 5GC)
- **Dataset Instances** : 20 instances réparties sur 4 environnements (DEV, PREPROD, PILOT_ORANGE, PROD)
- **Bundles** : 3 bundles avec respectivement 3, 5 et 7 items liés aux instances
- **Scripts** : 5 scripts (3 Playwright, 2 Cypress) avec code source complet

### Assertions

Le test vérifie 4 catégories de critères :

#### 1. Counts (comptage)

Après import, le nombre d'entités dans le projet cible doit correspondre exactement au nombre d'entités dans le projet source.

#### 2. Intégrité FK (clés étrangères)

Aucun UID du projet source ne doit apparaître dans le projet importé. Tous les UIDs doivent être régénérés :

- `profile.uid` → nouvel UUID
- `scenario.uid` → nouvel UUID
- `datasetInstance.uid` → nouvel UUID
- `bundle.uid` → nouvel UUID
- `scenario.profileId` → remappé vers le nouvel UID du profil correspondant
- `bundleItem.datasetId` → remappé vers le nouvel UID de l'instance correspondante

#### 3. Contenu normalisé

La comparaison de contenu ignore les champs non-déterministes (`uid`, `id`, `createdAt`, `updatedAt`, `profileId`, `scenarioId`, `datasetId`, `bundleId`) et vérifie l'égalité des champs métier :

- `steps` JSON identique (ordre, action, expected, protocol, data)
- `parameters` JSON identique
- `valuesJson` identique
- `code` source identique
- `config` identique

#### 4. Idempotence

L'import en mode "inject" (dans un projet existant) :

- Ne casse pas le projet cible
- Ajoute les entités de manière additive
- Préserve les métadonnées du projet cible (name, domain)
- Un double inject double les comptages (comportement additif)

## Procédure manuelle

Pour valider manuellement l'import/export :

### Export

1. Naviguer vers la page **Import/Export** (sidebar Configuration)
2. Sélectionner le projet à exporter
3. Cliquer sur **Exporter le projet**
4. Sauvegarder le fichier JSON

### Import

1. Naviguer vers la page **Import/Export**
2. Cliquer sur **Importer un projet**
3. Sélectionner le fichier JSON exporté
4. Choisir le mode : **Nouveau projet** ou **Injecter dans un projet existant**
5. Valider

### Vérifications manuelles

Après import, vérifier dans le projet cible :

| Vérification | Comment |
|-------------|---------|
| Nombre de profils | Page Profils → compter |
| Nombre de scénarios | Page Scénarios → compter |
| Nombre d'instances | Page Datasets → onglet Instances → compter |
| Nombre de bundles | Page Datasets → onglet Bundles → compter |
| Items dans chaque bundle | Ouvrir chaque bundle → vérifier items |
| Nombre de scripts | Page Scripts → compter |
| Contenu des steps | Ouvrir un scénario → vérifier les étapes |
| Références profil | Ouvrir un scénario → vérifier que le profil lié existe |
| Valeurs dataset | Ouvrir une instance → vérifier valuesJson |

## Résultats attendus

```
Test Files  1 passed (1)
Tests       16 passed (16)
```

### Détail des 16 tests

| # | Test | Durée typ. |
|---|------|-----------|
| 1 | Seed + export avec counts corrects | ~6s |
| 2 | Export profiles avec contenu correct | <1ms |
| 3 | Export scenarios avec steps et refs profil | <1ms |
| 4 | Export bundles avec items référençant instances | <1ms |
| 5 | Export scripts avec code | <1ms |
| 6 | Import dans nouveau projet avec counts corrects | ~4s |
| 7 | Aucun UID source dans le projet importé | ~500ms |
| 8 | Préservation contenu profils (normalisé) | ~500ms |
| 9 | Préservation steps_json scénarios (normalisé) | ~500ms |
| 10 | Préservation valuesJson instances (normalisé) | ~500ms |
| 11 | Préservation code scripts (normalisé) | ~500ms |
| 12 | Remapping profileId dans scénarios | ~500ms |
| 13 | Inject dans projet existant sans erreur | ~4s |
| 14 | Double inject additif | ~7s |
| 15 | Export projet vide | ~500ms |
| 16 | Import données vides | ~500ms |

## Bugs corrigés pendant la validation

### 1. Bundle items non exportés

**Cause** : L'export utilisait `b.id` (auto-increment) pour chercher les `bundleItems`, mais `bundleItems.bundleId` stocke l'`uid` du bundle.

**Fix** : Remplacé `String(b.id)` par `b.uid` dans la requête d'export.

### 2. Bundle items non importés correctement

**Cause** : L'import utilisait `bundleResult.id` (auto-increment) comme `bundleId` pour les items, mais `bundleItems.bundleId` attend l'`uid`.

**Fix** : Remplacé `String(bundleResult.id)` par `newUid` dans l'import.

### 3. Instance UID map stockait l'auto-id au lieu de l'uid

**Cause** : `instanceUidMap` était typé `Map<string, number>` et stockait `result.id`. Les `bundleItems.datasetId` recevaient donc un auto-id au lieu de l'uid.

**Fix** : Changé en `Map<string, string>` et stocké `newUid`.

### 4. Scripts framework écrasé par name

**Cause** : `scripts.create` utilisait `input.name || input.framework`, ce qui écrasait la valeur `framework` par le nom du script.

**Fix** : Inversé la priorité en `input.framework || input.name`.

## Exécution

```bash
# Lancer uniquement le test E2E
pnpm test -- server/import-export.e2e.test.ts

# Lancer tous les tests (inclut E2E)
pnpm test
```
