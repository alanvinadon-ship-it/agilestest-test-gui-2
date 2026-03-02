# DATASET-1 — Dataset Instances, Bundles & Validation

## Résumé

Cette mission implémente le module **Dataset Instances** pour AgilesTest :

- **Dataset Instance** : instance concrète d'un gabarit (DatasetType) pour un environnement cible
- **Dataset Bundle** : regroupement de datasets pour un environnement donné (1 dataset max par type)
- **Validation scénario↔bundle** : vérification de compatibilité entre les datasets requis d'un scénario et le contenu d'un bundle
- **Secrets** : marquage de champs sensibles avec masquage visuel

## Architecture

```
types/index.ts          → DatasetInstance, DatasetBundle, BundleItem, DatasetSecretKey, BundleValidationResult
api/localStore.ts       → localDatasetInstances, localBundles, localBundleItems, localDatasetSecrets, localValidation
pages/DatasetsPage.tsx  → CRUD instances, éditeur JSON, gestion secrets, filtres env/type/status
pages/BundlesPage.tsx   → CRUD bundles, ajout/retrait datasets, validation scénario
components/ScenarioDatasetSection.tsx → Section intégrée dans ScenariosPage (compatibilité par env)
```

## Environnements

| Code | Label | Usage |
|------|-------|-------|
| `DEV` | DEV | Développement |
| `PREPROD` | PREPROD | Pré-production |
| `PILOT_ORANGE` | PILOT ORANGE | Pilote opérateur |
| `PROD` | PROD | Production |

## Workflow

```
Dataset Instance : DRAFT → ACTIVE → DEPRECATED
Dataset Bundle   : DRAFT → ACTIVE → DEPRECATED
```

## Règles métier

1. **Unicité type/bundle** : un bundle ne peut contenir qu'un seul dataset par `dataset_type_id`
2. **Cohérence env** : un dataset ne peut être ajouté à un bundle que s'il partage le même environnement
3. **Protection suppression** : un dataset ACTIVE dans un bundle ACTIVE ne peut pas être supprimé
4. **Validation scénario** : vérifie que tous les `required_dataset_types` du scénario sont couverts par le bundle
5. **Secrets** : les champs marqués comme secrets sont masqués par `••••••••` sauf activation explicite

## Pages UI

### Datasets (Instances) — `/datasets`
- Filtres : environnement, statut, type de dataset
- Création depuis un gabarit avec pré-remplissage des valeurs d'exemple
- Éditeur formulaire (champ par champ avec info schéma) ou JSON brut
- Gestion des secrets par champ (bouclier)
- Actions : éditer, cloner (nouvelle version), activer, déprécier, supprimer

### Bundles — `/bundles`
- Filtres : environnement, statut
- Création avec nom suggéré (BUNDLE_{DOMAIN}_{ENV}_V1)
- Expansion pour voir/gérer les datasets inclus
- Ajout de datasets avec prévention des doublons de type
- Validation contre un scénario (types manquants, conflits, erreurs schéma, warnings)
- Actions : activer, déprécier, cloner, supprimer

### Scénarios — `/scenarios`
- Section "Datasets" intégrée sous chaque scénario (si `required_dataset_types` définis)
- Indicateur de couverture par environnement (X/4 env prêts)
- Détail par env : bundles compatibles, types manquants

## Collections localStorage

| Clé | Contenu |
|-----|---------|
| `agilestest_dataset_instances` | DatasetInstance[] |
| `agilestest_dataset_bundles` | DatasetBundle[] |
| `agilestest_bundle_items` | BundleItem[] |
| `agilestest_dataset_secrets` | DatasetSecretKey[] |
