# DRIVE_CORRELATION.md — Corrélation KPI ↔ Route ↔ Artefacts

> **Mission** : DRIVE-CORRELATION-1  
> **Version** : 1.0.0  
> **Date** : 2026-02-18  
> **Auteur** : Manus AI — AgilesTest V1

---

## 1. Vue d'ensemble

La fonctionnalité **Drive Correlation** transforme le reporting Drive Test en outil d'investigation complet. Elle permet de :

- **Segmenter** les routes en tronçons de 50m et agréger les KPI par segment
- **Classifier** chaque segment en OK / WARN / CRIT selon les seuils configurés
- **Indexer** temporellement les artefacts (PCAP, logs) pour les corréler aux segments
- **Générer automatiquement** des incidents Drive lors de violations de seuils
- **Drill-down** sur chaque segment pour accéder aux preuves (samples, artefacts, incidents)
- **Intégrer l'IA REPAIR** pour analyser et proposer des corrections

---

## 2. Architecture des modules

Le code est organisé dans le dossier `client/src/driveCorrelation/` :

| Fichier | Rôle |
|---|---|
| `types.ts` | Types, enums, seuils par défaut, labels, couleurs |
| `segmentation.ts` | Segmentation route (Haversine), enrichissement samples, agrégation KPI |
| `artifactIndex.ts` | Index temporel des artefacts, linking avec segments |
| `autoIncidents.ts` | Génération automatique d'incidents, déduplication, fusion segments contigus |
| `driveRepairHook.ts` | Construction du contexte IA REPAIR, simulation repair |
| `index.ts` | Barrel exports |

---

## 3. Modèle de données

### 3.1 BreachLevel

```typescript
type BreachLevel = 'OK' | 'WARN' | 'CRIT';
```

Chaque échantillon KPI est classifié selon les seuils configurés. La direction (`higher_better` ou `lower_better`) détermine le sens de la comparaison.

### 3.2 RouteSegment

Un segment de route contient :

| Champ | Type | Description |
|---|---|---|
| `segment_id` | `string` | ID déterministe `seg-{routeId}-{index}` |
| `coordinates` | `number[][]` | Coordonnées [lon, lat] du segment |
| `center` | `{lat, lon}` | Centre géographique |
| `length_m` | `number` | Longueur en mètres |
| `time_window` | `{start, end}` | Fenêtre temporelle des samples |
| `kpi_stats` | `Record<string, SegmentKpiStats>` | Stats KPI agrégées |
| `breach_level` | `BreachLevel` | Pire niveau de breach des KPI |
| `sample_count` | `number` | Nombre de samples dans le segment |

### 3.3 ArtifactTimeIndex

Index temporel pour corréler les artefacts aux segments :

| Champ | Type | Description |
|---|---|---|
| `artifact_id` | `string` | Identifiant unique |
| `source` | `RUNNER \| PROBE` | Source de l'artefact |
| `start_ts` / `end_ts` | `string` | Fenêtre temporelle |
| `tags` | `object` | Tags de filtrage (project, campaign, route, device, session) |
| `filename` | `string` | Nom du fichier |
| `type` | `string` | Type (PCAP, DEVICE_LOGS) |

### 3.4 DriveIncident

Incident auto-généré lors d'une violation de seuil :

| Champ | Type | Description |
|---|---|---|
| `incident_id` | `string` | ID unique |
| `type` | `DRIVE_KPI_THRESHOLD_BREACH` | Type fixe |
| `kpi_name` | `DriveKpi` | KPI en violation |
| `threshold` | `number` | Seuil configuré |
| `observed_min/max/avg` | `number` | Valeurs observées |
| `geo_bbox` / `geo_point` | `object` | Localisation géographique |
| `severity` | `P0 \| P1 \| P2` | Sévérité calculée |
| `evidence_refs` | `object` | Références aux preuves (artifacts, samples, segments) |
| `status` | `OPEN \| INVESTIGATING \| RESOLVED \| DISMISSED` | Statut |

---

## 4. Seuils KPI par défaut

Les seuils sont définis dans `DEFAULT_KPI_THRESHOLDS` et correspondent aux normes Orange CI :

| KPI | WARN | CRIT | Direction |
|---|---|---|---|
| RSRP | -100 dBm | -110 dBm | higher_better |
| RSRQ | -12 dB | -15 dB | higher_better |
| SINR | 5 dB | 0 dB | higher_better |
| THROUGHPUT_DL | 10 Mbps | 5 Mbps | higher_better |
| THROUGHPUT_UL | 5 Mbps | 2 Mbps | higher_better |
| LATENCY | 50 ms | 100 ms | lower_better |
| JITTER | 20 ms | 50 ms | lower_better |
| PACKET_LOSS | 1% | 3% | lower_better |
| ATTACH_SUCCESS | 95% | 90% | higher_better |
| DROP_CALL | 2% | 5% | lower_better |
| HANDOVER_SUCCESS | 95% | 90% | higher_better |
| VOLTE_MOS | 3.5 | 3.0 | higher_better |
| VOLTE_SETUP_TIME | 3000 ms | 5000 ms | lower_better |
| DNS_RESOLUTION_TIME | 100 ms | 200 ms | lower_better |
| HTTP_RESPONSE_TIME | 500 ms | 1000 ms | lower_better |

---

## 5. Algorithmes

### 5.1 Segmentation de route

La fonction `segmentRoute()` découpe une route (LineString GeoJSON) en segments de taille configurable (défaut : 50m). L'algorithme utilise la distance Haversine pour calculer la longueur cumulée et créer un nouveau segment lorsque le seuil est atteint.

```
Pour chaque point de la route :
  1. Calculer la distance Haversine avec le point précédent
  2. Ajouter au segment courant
  3. Si longueur >= segment_length_m → finaliser le segment, commencer le suivant
```

### 5.2 Enrichissement des samples

La fonction `enrichSamplesWithSegments()` associe chaque sample KPI au segment le plus proche (par distance au centre) et calcule :

- `breach_level` : classification OK/WARN/CRIT selon les seuils
- `window_key` : bucketing temporel (5s/10s/30s)
- `segment_id` : rattachement au segment

### 5.3 Agrégation KPI par segment

La fonction `aggregateSegmentKpi()` calcule pour chaque KPI de chaque segment :

- **min / max / avg** des valeurs
- **breach_pct** : pourcentage de samples en violation
- **breach_level** : classification du segment pour ce KPI
- Le `breach_level` global du segment est le pire de tous les KPI.

### 5.4 Classification breach

```typescript
classifyBreach(kpiName, value, thresholds) → BreachLevel
```

Pour `higher_better` : `value < crit → CRIT`, `value < warn → WARN`, sinon `OK`.
Pour `lower_better` : `value > crit → CRIT`, `value > warn → WARN`, sinon `OK`.

### 5.5 Index temporel des artefacts

La fonction `buildArtifactTimeIndex()` construit un index à partir des manifests de DriveJob (source RUNNER) et des sessions de capture probe (source PROBE). Chaque artefact est indexé par sa fenêtre temporelle et ses tags.

La fonction `findArtifactsForSegment()` retrouve les artefacts dont la fenêtre temporelle chevauche celle du segment (avec une marge configurable de ±30s).

### 5.6 Génération automatique d'incidents

La fonction `generateDriveIncidents()` parcourt les segments en breach et crée un incident par KPI en violation :

1. **Sévérité** : CRIT + breach_pct >= 30% → P0, CRIT sinon → P1, WARN + breach_pct >= 50% → P1, sinon → P2
2. **Evidence refs** : liste des artifact_ids, sample_ids et segment_ids concernés
3. **Géolocalisation** : bounding box et point central

### 5.7 Déduplication

La fonction `deduplicateIncidents()` évite de recréer un incident si un incident similaire existe déjà (même KPI + même segment + fenêtre temporelle qui se chevauche dans la fenêtre de dédup configurable).

### 5.8 Fusion de segments contigus

La fonction `mergeContiguousIncidents()` fusionne les incidents sur des segments adjacents pour le même KPI, réduisant le bruit en regroupant les violations contiguës.

---

## 6. Interface utilisateur

### 6.1 DriveReportingPage

La page de reporting a été enrichie avec :

**Filtres** :
- Sélection du KPI à visualiser (RSRP, SINR, Débit DL/UL, Latence, Jitter, Perte paquets)
- Slider de fenêtre temporelle (5s / 10s / 30s)
- Sélection projet, campagne, job

**Vue Segments** :
- Barre horizontale de segments colorés (vert=OK, ambre=WARN, rouge=CRIT)
- Click sur un segment → drill-down
- Hover → tooltip avec stats KPI

**Timeline KPI** :
- Courbe KPI vs temps avec barres colorées par breach level
- Lignes de seuil WARN/CRIT en pointillés
- Click sur un point → sélection du segment correspondant

**Drill-Down Panel** :
- Stats du segment (longueur, samples, fenêtre temporelle)
- KPI agrégés avec breach_pct
- Top violations triées par sévérité
- Liste des artefacts liés (PCAP/logs) avec source, taille, téléchargement
- Incidents associés avec bouton "Analyze & Repair (Drive)"
- Bouton "Créer incident manuellement" si aucun incident auto

**Incidents Summary** :
- Liste des incidents auto-générés avec sévérité P0/P1/P2
- Compteurs par sévérité
- Bouton "Repair IA" par incident

### 6.2 Intégration IA REPAIR

Le bouton "Analyze & Repair" sur chaque incident :

1. Construit le contexte (`buildDriveRepairContext`) avec :
   - Résumé KPI (seuils, valeurs observées, breach_pct)
   - Liste des artefacts dans la fenêtre temporelle
   - Informations géographiques du segment
   - Analyse des captures PCAP (si disponibles)
2. Appelle `simulateDriveRepair` (MVP) ou le backend avec `PROMPT_DRIVE_REPAIR_v1`
3. Affiche les patches proposés avec confiance et warnings

---

## 7. Configuration

### 7.1 Segmentation

```typescript
const DEFAULT_SEGMENTATION_CONFIG = {
  mode: 'distance',        // 'distance' | 'time'
  segment_length_m: 50,    // mètres
  segment_duration_sec: 5, // secondes (mode time)
  window_size: '5s',       // '5s' | '10s' | '30s'
};
```

### 7.2 Auto-incidents

```typescript
const DEFAULT_AUTO_INCIDENT_CONFIG = {
  enabled: true,
  crit_threshold_pct: 30,  // % breach pour P0
  warn_threshold_pct: 50,  // % breach pour P1
  dedup_window_sec: 60,    // fenêtre de dédup
};
```

---

## 8. Flux de données

```
Import résultats (G-NetTrack/iperf)
  ↓
KpiSamples stockés (localKpiSamples)
  ↓
segmentRoute() → RouteSegment[]
  ↓
enrichSamplesWithSegments() → EnrichedKpiSample[]
  ↓
aggregateSegmentKpi() → segments avec kpi_stats
  ↓
buildArtifactTimeIndex() → ArtifactTimeIndex[]
  ↓
generateDriveIncidents() → DriveIncident[]
  ↓
deduplicateIncidents() + mergeContiguousIncidents()
  ↓
UI: segments colorés + drill-down + timeline + incidents
  ↓
handleRepair() → buildDriveRepairContext() → simulateDriveRepair()
```

---

## 9. Tests recommandés

### 9.1 Tests unitaires

| Test | Description |
|---|---|
| `segmentRoute` | Vérifier que N points → M segments de ~50m |
| `classifyBreach` | Tester higher_better et lower_better |
| `enrichSamplesWithSegments` | Vérifier l'attribution segment_id correcte |
| `aggregateSegmentKpi` | Vérifier min/avg/max/breach_pct |
| `generateDriveIncidents` | Vérifier la création d'incidents pour segments CRIT |
| `deduplicateIncidents` | Vérifier la non-création de doublons |
| `mergeContiguousIncidents` | Vérifier la fusion de segments adjacents |

### 9.2 Tests E2E

| Test | Description |
|---|---|
| Import → Segments | Importer des résultats → vérifier les segments colorés |
| Drill-down | Cliquer un segment → vérifier stats + artefacts |
| Auto-incident | Vérifier la création automatique d'incidents P0/P1/P2 |
| Repair IA | Cliquer "Repair IA" → vérifier le résultat avec patches |
| Probe PCAP | Session probe → artefact visible dans drill-down |

---

## 10. Évolutions futures

1. **Carte interactive** : Afficher les segments sur une carte Google Maps / Leaflet avec coloration
2. **Heatmap KPI** : Superposer les valeurs KPI sur la carte avec gradient de couleur
3. **Alertes temps réel** : Notifications push lors de la détection d'un incident P0
4. **Export PDF** : Générer un rapport PDF avec segments, incidents et recommandations
5. **Comparaison campagnes** : Comparer les KPI entre deux campagnes sur la même route
6. **tshark integration** : Analyser automatiquement les PCAP avec tshark pour enrichir le contexte IA
