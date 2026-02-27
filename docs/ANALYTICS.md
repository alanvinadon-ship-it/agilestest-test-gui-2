# Analytics — Dashboard Analytique Global

## Vue d'ensemble

Le module Analytics fournit deux endpoints tRPC pour l'analyse des exécutions, incidents et sondes :

| Endpoint | Description | Scope |
|---|---|---|
| `analytics.dashboard` | Dashboard par projet (filtrable par `projectId`) | Projet unique |
| `analytics.globalDashboard` | Dashboard cross-projets avec agrégats complets | Tous les projets |

Les deux endpoints sont protégés (`protectedProcedure`) et nécessitent une session authentifiée.

---

## Endpoints

### `analytics.dashboard`

Dashboard par projet avec séries temporelles exécutions, incidents, sondes.

**Input :**

| Paramètre | Type | Requis | Description |
|---|---|---|---|
| `period` | `"week" \| "month"` | Non (défaut: `"week"`) | Granularité de regroupement |
| `projectId` | `string` | Non | Filtrer par projet (uid) |
| `from` | `string` (ISO date) | Non | Date de début |
| `to` | `string` (ISO date) | Non | Date de fin |

**Output :**

```typescript
{
  execSeries: {
    labels: string[];       // Ex: ["2026-W06", "2026-W07", ...]
    passed: number[];
    failed: number[];
    aborted: number[];
    successRate: number[];   // 0-100
  };
  incidentSeries: {
    labels: string[];
    critical: number[];
    high: number[];
    med: number[];
    low: number[];
  };
  probesSeries: {
    labels: ["Actuel"];
    green: number[];
    orange: number[];
    red: number[];
  };
  kpis: {
    totalRuns: number;
    successRate: number;     // 0-100
    openIncidents: number;
    redProbes: number;
  };
}
```

### `analytics.globalDashboard`

Dashboard cross-projets avec runs, incidents par sévérité, santé sondes, top scénarios échoués, détail par projet, et jobs backlog.

**Input :**

| Paramètre | Type | Requis | Description |
|---|---|---|---|
| `period` | `"week" \| "month"` | Non (défaut: `"week"`) | Granularité de regroupement |
| `projectUid` | `string` | Non | Filtrer par projet spécifique |
| `from` | `string` (ISO date) | Non | Date de début |
| `to` | `string` (ISO date) | Non | Date de fin |

**Output :**

```typescript
{
  kpis: {
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    successRate: number;      // 0-100
    avgDurationMs: number | null;
    projectCount: number;
    openIncidents: number;
    redProbes: number;
    jobsBacklog: number;      // QUEUED + RUNNING jobs
  };
  runs: {
    labels: string[];
    passed: number[];
    failed: number[];
    aborted: number[];
    total: number[];
    successRate: number[];
  };
  incidents: {
    labels: string[];
    critical: number[];
    high: number[];
    med: number[];
    low: number[];
  };
  probes: {
    green: number;
    orange: number;
    red: number;
    total: number;
  };
  trend: {
    labels: string[];
    total: number[];
    passed: number[];
    failed: number[];
    successRate: number[];
  };
  topFailed: Array<{
    scenarioName: string;
    projectName: string;
    failCount: number;
  }>;
  perProject: Array<{
    projectName: string;
    projectId: string;
    totalRuns: number;
    passed: number;
    failed: number;
    successRate: number;
    avgDurationMs: number | null;
  }>;
}
```

---

## Périodes et regroupement

Le paramètre `period` contrôle la granularité du regroupement SQL :

| Période | Format SQL | Exemple label |
|---|---|---|
| `week` | `DATE_FORMAT(col, '%x-W%v')` | `2026-W08` |
| `month` | `DATE_FORMAT(col, '%Y-%m')` | `2026-02` |

Les labels sont triés chronologiquement. Le format ISO week (`%x-W%v`) utilise l'année ISO pour gérer correctement les semaines à cheval sur deux années.

---

## Formules de calcul

### Taux de succès

```
successRate = ROUND((passed / total) * 100)
```

Retourne 0 si `total = 0`.

### Santé des sondes

| Statut | Condition |
|---|---|
| **GREEN** | `status = 'ONLINE'` ET `last_seen_at` < 60 secondes |
| **ORANGE** | `status = 'ONLINE'` ET `last_seen_at` entre 60s et 300s |
| **RED** | `status = 'OFFLINE'` OU `status = 'DEGRADED'` OU `last_seen_at` > 300s |

### Sévérité des incidents

Les incidents sont groupés par les valeurs de la colonne `severity` :

| Niveau | Valeur DB |
|---|---|
| Critique | `CRITICAL` |
| Majeur | `MAJOR` |
| Mineur | `MINOR` |
| Info | `INFO` |

### Jobs backlog

Compte les jobs avec `status IN ('QUEUED', 'RUNNING')`. Si la table `jobs` n'existe pas, retourne 0.

---

## Cache

Un cache en mémoire (Map) avec TTL de **30 secondes** évite les requêtes SQL répétées lors de rafraîchissements rapides. La clé de cache inclut `period`, `projectUid`, `from`, `to`.

---

## Frontend

### Page GlobalAnalyticsPage (`/analytics`)

La page affiche :

1. **9 KPI cards** : Exécutions, Taux succès, Réussis, Échoués, Durée moy., Projets, Incidents, Sondes RED, Jobs file
2. **Stacked bar chart** : Exécutions par période (PASSED/FAILED/ABORTED)
3. **Line chart** : Tendance taux de succès + total exécutions (double axe Y)
4. **Stacked bar chart** : Incidents par sévérité (CRITICAL/MAJOR/MINOR/INFO)
5. **Doughnut chart** : Santé des sondes (GREEN/ORANGE/RED)
6. **Stacked bar chart** : Exécutions par projet
7. **Table** : Top 10 scénarios échoués
8. **Table** : Détail par projet (total, réussis, échoués, taux, durée moy.)

**Auto-refresh** : `refetchInterval: 60_000` (60 secondes).

**Sélecteur de période** : Semaine / Mois.

### Page DashboardPage (`/dashboard`)

Dashboard par projet utilisant `analytics.dashboard` avec les mêmes types de graphiques (Bar, Line, Doughnut via react-chartjs-2).

---

## Tables SQL utilisées

| Table | Colonnes clés | Usage |
|---|---|---|
| `executions` | `project_id`, `status`, `created_at`, `scenario_id`, `duration_ms` | Séries runs, KPIs, top failed |
| `incidents` | `project_id`, `severity`, `detected_at` | Séries incidents |
| `probes` | `status`, `last_seen_at` | Snapshot santé sondes |
| `jobs` | `status` | Backlog jobs |
| `test_scenarios` | `uid`, `name` | Noms scénarios (JOIN) |
| `projects` | `id`, `name` | Noms projets (JOIN) |

---

## RBAC

Les deux endpoints utilisent `protectedProcedure` : tout utilisateur authentifié peut consulter les analytics. Le filtrage par `projectUid` est optionnel et ne vérifie pas l'appartenance au projet (les analytics sont cross-projets par design).

---

## Alertes Automatiques

### Success Rate Alert

| Paramètre | Défaut | Env Variable |
|---|---|---|
| Seuil | 90% | `ANALYTICS_SUCCESS_RATE_THRESHOLD` |
| Fenêtre | 7 jours | `ANALYTICS_WINDOW_DAYS` |
| Détections consécutives | 2 | (hardcodé) |
| Cooldown | 60 min | `ANALYTICS_ALERT_COOLDOWN_MS` |
| Marge de récupération | +2% | `ANALYTICS_RECOVERY_MARGIN` |

**Flux** :
1. Toutes les 5 minutes, le job poller évalue le taux de succès global
2. Si le taux < seuil pendant 2 évaluations consécutives → notification owner + webhook `analytics.success_rate.low`
3. Anti-spam : pas de nouvelle notification pendant 60 min
4. Récupération : quand le taux remonte au-dessus de seuil + marge, les compteurs sont réinitialisés

### Probe RED Alert

| Paramètre | Défaut | Env Variable |
|---|---|---|
| Seuil RED | 5 min | `PROBE_RED_THRESHOLD_MS` |
| Anti-spam | 30 min | `PROBE_ANTI_SPAM_MS` |
| Heartbeat GREEN | 60 sec | `PROBE_HEALTH_GREEN_SEC` |
| Heartbeat ORANGE | 300 sec | `PROBE_HEALTH_ORANGE_SEC` |

### Table `alerts_state`

| Colonne | Type | Description |
|---|---|---|
| `uid` | VARCHAR(36) | UUID unique |
| `org_id` | VARCHAR(100) | Scope organisationnel |
| `alert_type` | VARCHAR(50) | Type d'alerte |
| `key` | VARCHAR(100) | Clé unique (GLOBAL, probe-{id}) |
| `state_json` | JSON | État interne (breaches, threshold) |
| `alert_count` | INT | Nombre de notifications envoyées |
| `last_notified_at` | DATETIME | Dernière notification |
| `resolved_at` | DATETIME | Date de résolution |

---

## Date Range et Export

### URL Params

Les paramètres from/to sont persistés dans l'URL pour le partage :

```
/analytics?period=week&from=2026-01-01&to=2026-02-27
```

### Presets

| Preset | Description |
|---|---|
| 7 derniers jours | `from = now - 7d` |
| 30 derniers jours | `from = now - 30d` |
| 90 derniers jours | `from = now - 90d` |
| Depuis début d'année | `from = 1er janvier` |

### Export Rapport

Le bouton "Exporter Rapport" génère un rapport HTML complet (KPIs + tableaux) dans une nouvelle fenêtre, prêt pour impression PDF via le navigateur.

---

## Tests

- **analytics-dashboard.test.ts** : 18 tests (structure, date range, KPIs, by project, top failed)
- **alerts.test.ts** : 13 tests (alerts_state CRUD, success rate threshold/breach/cooldown/recovery, probe health, webhook types, job queue integration)
