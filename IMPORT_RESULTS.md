# IMPORT_RESULTS.md — Import manuel de résultats Drive Test

## Vue d'ensemble

Le composant **Import Results** permet d'importer manuellement des résultats de mesures Drive Test depuis des fichiers CSV, JSON, GPX, GeoJSON ou iperf3. Les données importées sont converties en `KpiSample`, stockées dans le localStore, et alimentent automatiquement la page Reporting.

## Formats supportés

| Format | Extension | Description | Détection auto |
|--------|-----------|-------------|----------------|
| **CSV** | `.csv` | Colonnes : timestamp, kpi_name, value, unit, lat, lon | Oui |
| **JSON** | `.json` | Tableau de samples ou `{samples: [...]}` | Oui |
| **GPX** | `.gpx` | Trackpoints avec extensions KPI dans `<extensions>` | Oui |
| **GeoJSON** | `.geojson` | FeatureCollection avec propriétés KPI par Feature | Oui |
| **iperf3** | `.json` | Résultat natif iperf3 (`iperf3 -J`) | Par contenu |

## Format CSV

Le format CSV est le plus simple et le plus courant. Les colonnes attendues sont :

```csv
timestamp,kpi_name,value,unit,lat,lon,cell_id,technology
2026-02-18T10:00:00Z,RSRP,-85.3,dBm,48.8566,2.3522,12345,4G
2026-02-18T10:00:00Z,SINR,15.2,dB,48.8566,2.3522,12345,4G
2026-02-18T10:00:00Z,THROUGHPUT_DL,45.7,Mbps,48.8566,2.3522,12345,4G
2026-02-18T10:00:01Z,LATENCY,23,ms,48.8567,2.3523,12346,4G
```

### Colonnes obligatoires
- `timestamp` — ISO 8601 ou format parseable
- `kpi_name` — Nom du KPI (RSRP, SINR, THROUGHPUT_DL, etc.)
- `value` — Valeur numérique
- `lat`, `lon` — Coordonnées GPS

### Colonnes optionnelles
- `unit` — Unité (dBm, dB, Mbps, ms, %)
- `cell_id` — Identifiant cellule
- `technology` — Type réseau (4G, 5G_NSA, etc.)

## Format JSON

```json
{
  "samples": [
    {
      "timestamp": "2026-02-18T10:00:00Z",
      "kpi_name": "RSRP",
      "value": -85.3,
      "unit": "dBm",
      "lat": 48.8566,
      "lon": 2.3522,
      "cell_id": "12345",
      "technology": "4G"
    }
  ]
}
```

Un tableau direct `[{...}, {...}]` est aussi accepté.

## Format GPX

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="48.8566" lon="2.3522">
        <time>2026-02-18T10:00:00Z</time>
        <extensions>
          <rsrp>-85.3</rsrp>
          <sinr>15.2</sinr>
          <throughput_dl>45.7</throughput_dl>
        </extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
```

Les tags dans `<extensions>` sont mappés vers les KPIs correspondants.

## Format GeoJSON

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [2.3522, 48.8566]
      },
      "properties": {
        "timestamp": "2026-02-18T10:00:00Z",
        "RSRP": -85.3,
        "SINR": 15.2,
        "THROUGHPUT_DL": 45.7,
        "cell_id": "12345"
      }
    }
  ]
}
```

Chaque Feature génère un `KpiSample` par propriété KPI reconnue.

## Format iperf3

Le résultat natif de `iperf3 -J` est parsé automatiquement :

```bash
iperf3 -c server.example.com -J > results.json
```

Le parser extrait :
- **THROUGHPUT_DL** ou **THROUGHPUT_UL** depuis `sum_sent.bits_per_second`
- **JITTER** depuis `sum.jitter_ms` (mode UDP)
- **PACKET_LOSS** depuis `sum.lost_percent` (mode UDP)

## Utilisation dans l'UI

### Accès

1. Ouvrir **Drive Test → Campagnes**
2. Lancer une exécution (ou utiliser un job existant)
3. Dans la section "Jobs d'exécution", cliquer **Importer** sur un job
4. Sélectionner un fichier
5. Vérifier l'aperçu (format détecté, nombre d'échantillons, KPIs)
6. Cliquer **Importer**

### Workflow

```
Fichier → Détection format → Parsing → Aperçu → Validation → Import → Recalcul summary
```

### Après import

- Les échantillons sont stockés dans `localKpiSamples`
- Le summary est recalculé automatiquement via `computeAndStore()`
- La page **Reporting** affiche les données avec le badge "Données réelles"
- L'export CSV est disponible depuis le Reporting

## API Parsers

Le module `client/src/ai/kpiParsers.ts` expose :

```typescript
// Détecter le format d'un fichier
detectFormat(filename: string, content: string): ImportFormat

// Parser un fichier vers des KpiSampleInput
parseFile(content: string, format: ImportFormat, context: {
  drive_job_id: string;
  campaign_id: string;
  route_id: string;
}): { samples: KpiSampleInput[]; errors: string[] }

// Évaluer un seuil KPI
getThresholdLevel(kpi: string, value: number, threshold: number): 'good' | 'warning' | 'critical'
```

## Seuils et coloration

Les seuils sont appliqués automatiquement lors de l'import :

| Niveau | Couleur | Condition |
|--------|---------|-----------|
| `good` | Vert | Valeur dans les seuils |
| `warning` | Ambre | Valeur proche du seuil (±10%) |
| `critical` | Rouge | Valeur hors seuils |

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `client/src/components/ImportResultsModal.tsx` | Composant modal d'import |
| `client/src/ai/kpiParsers.ts` | Parsers multi-format + threshold |
| `client/src/api/localStore.ts` | `localKpiSamples.bulkInsert()` + `localDriveRunSummaries.computeAndStore()` |
| `client/src/pages/DriveReportingPage.tsx` | Consommation des données importées |
