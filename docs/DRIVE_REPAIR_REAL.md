# DRIVE_REPAIR_REAL — Repair Drive Opérateur-Grade

> **Mission** : DRIVE-REPAIR-REAL-2
> **Version** : 2.0
> **Statut** : Implémenté
> **Date** : 2026-02-18

---

## 1. Vue d'ensemble

Le module **Drive Repair Real** transforme chaque incident Drive (breach KPI sur segment de route) en un diagnostic structuré multi-couches, avec preuves citées, recommandations actionnables et plan de rerun ciblé. Il s'adresse aux équipes opérateur (Orange) qui doivent comprendre, diagnostiquer et résoudre les dégradations réseau observées lors des campagnes de Drive Test.

Le système suit une chaîne déterministe : **Incident → Context Builder → Analyse IA → Rapport structuré → Plan de rerun**. Chaque étape est traçable et vérifiable.

---

## 2. Architecture

```
DriveReportingPage                    DriveIncidentReportPage
  │                                     │
  │ click "Repair IA"                   │ /drive/incidents/:id
  │ ──────────────────►                 │
  │ navigate()                          ├── useMockIncidentData(id)
  │                                     │     ├── localDriveCampaigns
  │                                     │     ├── localDriveRoutes
  │                                     │     ├── localDriveJobs
  │                                     │     ├── localKpiSamples
  │                                     │     ├── segmentRoute()
  │                                     │     ├── enrichSamplesWithSegments()
  │                                     │     ├── aggregateSegmentKpi()
  │                                     │     └── buildArtifactTimeIndex()
  │                                     │
  │                                     ├── buildDriveRepairContextV2()
  │                                     │     ├── incident metadata
  │                                     │     ├── top 3 segments + stats
  │                                     │     ├── timeline KPI window
  │                                     │     ├── artefacts corrélés
  │                                     │     ├── device info
  │                                     │     └── capture policy
  │                                     │
  │                                     ├── simulateDriveRepairV2()
  │                                     │     ├── observations[]
  │                                     │     ├── hypotheses[] (par couche)
  │                                     │     ├── root_cause_candidates[]
  │                                     │     ├── recommendations[]
  │                                     │     ├── rerun_plan
  │                                     │     ├── next_measurements[]
  │                                     │     └── glossary[]
  │                                     │
  │                                     └── UI Rapport
  │                                           ├── Header incident
  │                                           ├── Observations factuelles
  │                                           ├── Hypothèses par couche
  │                                           ├── Causes racines classées
  │                                           ├── Recommandations
  │                                           ├── Plan de rerun
  │                                           ├── Mesures suivantes
  │                                           └── Glossaire auto
```

---

## 3. Schema de sortie (DriveRepairResult)

Le résultat est validé par un schema Zod strict. Chaque champ est typé et documenté.

### 3.1 Structure principale

| Champ | Type | Description |
|-------|------|-------------|
| `analysis_id` | `string` | Identifiant unique de l'analyse (UUID) |
| `incident_id` | `string` | Référence à l'incident Drive source |
| `generated_at` | `string` | Timestamp ISO de génération |
| `model_version` | `string` | Version du modèle d'analyse (ex: `DRIVE_REPAIR_v2`) |
| `confidence_score` | `number` | Score de confiance global (0.0 – 1.0) |
| `data_quality_score` | `number` | Qualité des données d'entrée (0.0 – 1.0) |
| `observations` | `Observation[]` | Faits observés dans les données |
| `hypotheses` | `Hypothesis[]` | Hypothèses par couche réseau |
| `root_cause_candidates` | `RootCauseCandidate[]` | Causes racines classées |
| `recommendations` | `Recommendation[]` | Actions recommandées |
| `rerun_plan` | `RerunPlan` | Plan de rerun ciblé |
| `next_measurements` | `NextMeasurement[]` | Mesures à capturer au prochain run |
| `glossary` | `GlossaryEntry[]` | Glossaire auto-généré |

### 3.2 Observation

Chaque observation est un **fait** extrait des données, jamais une interprétation.

```typescript
interface Observation {
  id: string;                    // ex: "OBS-001"
  category: 'KPI' | 'PATTERN' | 'CORRELATION' | 'ANOMALY' | 'CONTEXT';
  description: string;           // Description factuelle
  evidence_refs: EvidenceRef[];  // Preuves citées
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp_range?: { start: string; end: string };
}
```

### 3.3 Hypothesis

Les hypothèses sont organisées par **couche réseau** (RADIO, CORE, QOS, APP).

```typescript
interface Hypothesis {
  id: string;                    // ex: "HYP-001"
  layer: 'RADIO' | 'CORE' | 'QOS' | 'APP';
  title: string;                 // Titre court
  description: string;           // Explication détaillée
  confidence: number;            // 0.0 – 1.0
  evidence_refs: EvidenceRef[];  // Preuves supportant l'hypothèse
  counter_evidence?: string;     // Éléments contradictoires
  requires_investigation: boolean;
}
```

### 3.4 Recommendation

Chaque recommandation est catégorisée et évaluée en effort/risque/impact.

```typescript
interface Recommendation {
  id: string;                    // ex: "REC-001"
  category: 'RADIO' | 'CORE' | 'QOS' | 'APP' | 'CAPTURE' | 'DATASET';
  priority: 'IMMEDIATE' | 'SHORT_TERM' | 'MEDIUM_TERM';
  action: string;                // Action concrète
  expected_impact: string;       // Impact attendu
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  linked_hypothesis_ids: string[];
}
```

### 3.5 RerunPlan

Le plan de rerun est directement exploitable pour créer un nouveau DriveJob.

```typescript
interface RerunPlan {
  segments: string[];            // IDs des segments à re-tester
  time_window: { start: string; end: string };
  required_capture_mode: 'NONE' | 'RUNNER_TCPDUMP' | 'PROBE_SPAN_TAP';
  required_datasets: string[];   // Datasets nécessaires
  commands_hint: string[];       // Commandes suggérées (tcpdump, iperf, etc.)
  estimated_duration_min: number;
  focus_kpis: string[];          // KPI à surveiller en priorité
  capture_filters?: string;      // Filtres BPF recommandés
}
```

### 3.6 EvidenceRef

Les preuves sont typées et traçables.

```typescript
interface EvidenceRef {
  type: 'KPI_SAMPLE' | 'SEGMENT' | 'ARTIFACT' | 'TIMELINE' | 'THRESHOLD' | 'DEVICE';
  id: string;                    // ID de la preuve
  label: string;                 // Label lisible
  value?: string;                // Valeur (si applicable)
}
```

---

## 4. Context Builder V2

Le context builder (`buildDriveRepairContextV2`) construit un contexte déterministe à partir des données disponibles. Il ne fait **aucune interprétation** — il agrège et structure les données brutes.

### 4.1 Entrées

| Source | Données extraites |
|--------|-------------------|
| **Incident** | kpi_name, threshold, severity, time_window, geo_bbox, evidence_refs |
| **Segments** | Top 3 segments CRIT/WARN avec stats (min/avg/max, breach_pct) |
| **Timeline** | Échantillons KPI dans la fenêtre temporelle ± 30s |
| **Artefacts** | PCAP/logs corrélés avec metadata (source, taille, SHA256) |
| **Device** | Informations terminal (si disponibles) |
| **Capture Policy** | Mode effectif (A/B), filtres, interface |

### 4.2 Guardrails

Le context builder applique les règles suivantes :

1. **Ne jamais inventer de KPI** : seuls les KPI présents dans les données sont inclus.
2. **Preuves insuffisantes** : si moins de 3 échantillons dans la fenêtre, le champ `data_quality` est marqué `LOW` et une recommandation `CAPTURE` est automatiquement ajoutée.
3. **Toujours proposer au moins 1 action Capture/Observabilité** dans les recommandations.
4. **Citer uniquement des artefacts existants** : chaque `artifact_id` référencé doit exister dans l'index.

---

## 5. Simulateur V2

Le simulateur (`simulateDriveRepairV2`) génère un `DriveRepairResult` complet à partir du contexte. En mode MVP (sans backend IA réel), il produit des résultats réalistes basés sur des heuristiques opérateur.

### 5.1 Logique de génération

Le simulateur analyse le KPI en breach et génère des hypothèses adaptées :

| KPI | Couche primaire | Hypothèses typiques |
|-----|----------------|---------------------|
| RSRP | RADIO | Couverture insuffisante, distance eNodeB, obstacles |
| SINR | RADIO | Interférences co-canal, pollution pilote |
| THROUGHPUT_DL/UL | QOS | Congestion cellule, limitation QCI, backhaul saturé |
| LATENCY | CORE | Congestion S1-U, routage sous-optimal, DNS lent |
| PACKET_LOSS | QOS | Buffer overflow, handover raté, lien dégradé |
| JITTER | QOS | Congestion, QoS mal configurée |
| HANDOVER_SUCCESS | RADIO | Paramètres handover mal calibrés, zone blanche |

### 5.2 Scoring

Le score de confiance est calculé selon :

- **Nombre d'échantillons** : plus il y a de données, plus la confiance est élevée.
- **Cohérence des observations** : si plusieurs KPI convergent vers la même couche, la confiance augmente.
- **Qualité des artefacts** : la présence de PCAP augmente la confiance de +0.1.

---

## 6. Interface utilisateur

### 6.1 DriveIncidentReportPage

La page `/drive/incidents/:id` affiche le rapport complet en sections dépliables :

| Section | Contenu |
|---------|---------|
| **Header** | Incident ID, KPI, sévérité, confiance, qualité données, timestamps |
| **Observations** | Faits observés avec badges de sévérité et evidence chips cliquables |
| **Hypothèses** | Groupées par couche (Radio/Core/QoS/App) avec barres de confiance |
| **Causes racines** | Classées par probabilité avec evidence chips |
| **Recommandations** | Catégorisées avec badges priorité/effort/risque |
| **Plan de rerun** | Segments ciblés, mode capture, durée estimée, filtres BPF |
| **Mesures suivantes** | KPI et outils à utiliser au prochain run |
| **Glossaire** | Termes techniques auto-générés |

### 6.2 Evidence Chips

Les "evidence chips" sont des badges cliquables qui identifient chaque preuve :

- **KPI_SAMPLE** : icône Zap, couleur primaire
- **SEGMENT** : icône MapPin, couleur amber
- **ARTIFACT** : icône FileText, couleur emerald
- **TIMELINE** : icône Clock, couleur blue
- **THRESHOLD** : icône Target, couleur red
- **DEVICE** : icône Radio, couleur purple

Un clic sur un chip affiche un toast avec les détails de la preuve.

### 6.3 Bouton "Generate Rerun Job"

Le bouton pré-remplit un DriveJob avec :
- Les segments identifiés dans le `rerun_plan`
- La fenêtre temporelle recommandée
- Le mode capture requis (override si nécessaire)
- Les filtres BPF suggérés

### 6.4 Export HTML

Le bouton "Exporter HTML" génère un rapport HTML complet avec toutes les sections, téléchargeable pour partage hors-ligne.

---

## 7. Intégration avec DriveReportingPage

Le bouton "Repair IA" dans la DriveReportingPage (drill-down panel et incidents summary) navigue vers `/drive/incidents/:id` au lieu de faire l'analyse inline. Cela permet :

1. **URL partageable** : chaque rapport d'incident a une URL unique.
2. **Rapport complet** : la page dédiée offre plus d'espace pour les détails.
3. **Historique navigateur** : retour arrière possible.

---

## 8. Fichiers implémentés

| Fichier | Rôle |
|---------|------|
| `client/src/driveCorrelation/driveRepairTypes.ts` | Schema Zod strict + types TypeScript |
| `client/src/driveCorrelation/driveRepairContextBuilder.ts` | Context builder déterministe V2 |
| `client/src/driveCorrelation/driveRepairSimulator.ts` | Simulateur opérateur-grade V2 |
| `client/src/pages/DriveIncidentReportPage.tsx` | Page rapport d'incident Drive |
| `client/src/pages/DriveReportingPage.tsx` | Navigation vers rapport (modifié) |
| `client/src/App.tsx` | Route `/drive/incidents/:id` (ajoutée) |

---

## 9. Évolutions futures

1. **Backend IA réel** : remplacer `simulateDriveRepairV2` par un appel API vers un modèle LLM fine-tuné sur les données opérateur.
2. **Analyse PCAP automatique** : intégrer tshark pour extraire automatiquement les statistiques de protocole (retransmissions TCP, codes SIP, échecs DNS).
3. **Comparaison inter-incidents** : permettre de comparer deux rapports d'incidents pour identifier des patterns récurrents.
4. **Export PDF** : générer un PDF formaté avec en-tête Orange et graphiques intégrés.
5. **Intégration ticketing** : créer automatiquement un ticket Jira/ServiceNow depuis le rapport.

---

## 10. Glossaire

| Terme | Définition |
|-------|------------|
| **Breach** | Dépassement d'un seuil KPI (WARN ou CRIT) |
| **Segment** | Portion de route découpée par distance (50m) ou temps (5s) |
| **Evidence Ref** | Référence traçable vers une preuve (échantillon, segment, artefact) |
| **Rerun Plan** | Plan de re-test ciblé sur les segments problématiques |
| **Context Builder** | Module qui agrège les données brutes en contexte structuré pour l'IA |
| **Couche Radio** | Couche physique et liaison (RSRP, SINR, handover) |
| **Couche Core** | Réseau cœur (EPC/5GC, routage, DNS) |
| **Couche QoS** | Qualité de service (débit, perte, jitter) |
| **Couche App** | Couche applicative (HTTP, SIP, services) |
