# Drive Test Guide — AgilesTest

## Vue d'ensemble

Le module **Drive Test** étend AgilesTest avec le domaine de test terrain télécom. Il permet de planifier des campagnes de mesure radio, gérer les parcours (routes GeoJSON), enregistrer les équipements de test (smartphones, modems, CPE), configurer les sondes de capture réseau, et exploiter des scénarios de test spécialisés (couverture, débit, latence, handover, VoLTE/IMS).

Ce guide couvre l'ensemble du workflow : de la création d'une campagne à l'analyse des KPI en passant par la génération de scripts IA.

---

## Architecture

### Modèles de données

| Modèle | Description | Clé primaire |
|--------|-------------|--------------|
| `DriveCampaign` | Campagne de test terrain (zone, dates, réseau, env) | `campaign_id` |
| `DriveRoute` | Parcours géolocalisé (GeoJSON LineString + checkpoints) | `route_id` |
| `TestDevice` | Équipement de test (smartphone, modem, CPE, laptop) | `device_id` |
| `DriveProbeConfig` | Configuration de sonde de capture réseau | `probe_id` |

### Enums réseau

| Enum | Valeurs |
|------|---------|
| `NetworkType` | `4G`, `5G_SA`, `5G_NSA`, `IMS`, `IP` |
| `CampaignStatus` | `DRAFT`, `READY`, `RUNNING`, `DONE` |
| `DeviceType` | `ANDROID`, `MODEM`, `CPE`, `LAPTOP` |
| `DriveToolName` | `GNetTrack`, `NSG`, `QXDM`, `Wireshark`, `iperf3`, `ping`, `traceroute`, `tcpdump` |
| `DriveCaptureType` | `PCAP`, `SIP_TRACE`, `DIAMETER`, `GTPU`, `NGAP`, `NAS`, `HTTP`, `DNS`, `SYSLOG` |

### KPI télécom

| KPI | Unité | Seuil VABE typique |
|-----|-------|-------------------|
| RSRP | dBm | > -100 |
| SINR | dB | > 5 |
| Throughput DL | Mbps | > 10 |
| Throughput UL | Mbps | > 5 |
| Latence | ms | < 50 |
| Jitter | ms | < 15 |
| Packet Loss | % | < 1 |
| Handover Success Rate | % | > 95 |

---

## Pages UI

### 1. Campagnes (`/drive/campaigns`)

La page Campagnes est organisée en 4 onglets :

**Onglet Campagnes** — CRUD complet des campagnes de test terrain :
- Création avec nom, description, type réseau (4G/5G_SA/5G_NSA/IMS/IP), environnement cible, zone géographique, dates
- Workflow de statut : DRAFT → READY → RUNNING → DONE
- Vue expandable avec les routes associées à chaque campagne
- Filtres par statut et type réseau

**Onglet Équipements** — Gestion des devices de test :
- Enregistrement avec type (ANDROID/MODEM/CPE/LAPTOP), modèle, version OS
- Flag "diagnostic radio capable" pour les mesures RSRP/SINR
- Sélection des outils installés (GNetTrack, NSG, QXDM, Wireshark, iperf3, etc.)

**Onglet Sondes** — Configuration des sondes de capture :
- Emplacement (RUNNER_HOST, EDGE_VM, K8S_NODE, SPAN_PORT, MIRROR_TAP)
- Type de capture (PCAP, SIP_TRACE, DIAMETER, GTPU, NGAP, NAS, HTTP, DNS, SYSLOG)
- Politique de rétention (jours), taille max (MB), rotation, cible de sortie (MINIO/LOCAL/BOTH)

**Onglet Scénarios Templates** — Catalogue des 20 templates de scénarios Drive Test prêts à l'import, couvrant VABF, VABE et VSR.

### 2. Reporting (`/drive/reporting`)

Le rapport consolidé affiche pour une campagne sélectionnée :
- Barre d'info campagne (réseau, env, zone, dates, nombre de routes et checkpoints)
- Grille de 10 KPI cards avec seuils colorés (vert/rouge) et tendance
- 4 graphiques : distribution RSRP, débit DL/UL, latence, carte de couverture (placeholder)
- Tableau d'échantillons KPI avec coloration conditionnelle

---

## Dataset Types Drive Test

10 gabarits de datasets spécialisés ont été ajoutés au catalogue :

| ID | Nom | Description |
|----|-----|-------------|
| `drive-cell-config` | Cell Configuration | Paramètres cellule (cell_id, TAC, PCI, fréquence, bande) |
| `drive-route-definition` | Route Definition | Parcours GeoJSON avec checkpoints |
| `drive-device-config` | Device Configuration | Configuration équipement de test |
| `drive-kpi-thresholds` | KPI Thresholds | Seuils d'acceptation par KPI |
| `drive-iperf-server` | iPerf Server Config | Configuration serveur iperf3 |
| `drive-sip-credentials` | SIP/IMS Credentials | Identifiants SIP pour tests VoLTE |
| `drive-qos-profile` | QoS Profile | Profil QoS attendu (QCI, ARP, MBR, GBR) |
| `drive-handover-params` | Handover Parameters | Paramètres de mobilité (A3 offset, TTT, hysteresis) |
| `drive-probe-capture` | Probe Capture Config | Configuration de capture réseau |
| `drive-baseline-kpi` | Baseline KPI Reference | KPI de référence pour comparaison |

---

## Scénarios Templates

20 templates couvrant les 3 types de test :

### VABF (Fonctionnel)
- Couverture indoor/outdoor
- Attachement réseau et établissement PDN/PDU
- Appel VoLTE MO/MT
- Navigation web et streaming vidéo
- Transfert de fichiers FTP

### VABE (Performance)
- Débit DL/UL multi-points
- Latence et jitter bout-en-bout
- Qualité voix MOS (VoLTE)
- Capacité cellulaire sous charge
- Débit edge-of-cell

### VSR (Résilience)
- Handover inter-fréquence
- Handover inter-RAT (4G↔5G)
- Reprise après perte de couverture
- Continuité de service en mobilité
- Basculement site primaire/secondaire

---

## Templates IA Drive Test

3 templates de prompt spécialisés ont été ajoutés au registre :

| Template | Description |
|----------|-------------|
| `PROMPT_DRIVE_PLAN_v1` | Plan de test drive avec KPI cibles, requirements devices/probes, mapping étapes→mesures |
| `PROMPT_DRIVE_GEN_v1` | Génération de scripts d'automatisation (iperf3, ping, SIP, adb, tshark) |
| `PROMPT_DRIVE_REPAIR_v1` | Analyse d'échec terrain avec catégorisation (SCRIPT_BUG, CONFIG_ERROR, ENV_ISSUE, NETWORK_ISSUE) |

Ces templates incluent des règles spécifiques au domaine télécom : métriques radio, protocoles SIP/DIAMETER, commandes AT pour modems, et analyse de captures réseau.

---

## Stockage (LocalStore)

Les CRUD suivants sont disponibles en mode local :

| Module | Méthodes |
|--------|----------|
| `localDriveCampaigns` | list, get, create, update, updateStatus, delete |
| `localDriveRoutes` | list, get, create, update, delete |
| `localTestDevices` | list, get, create, update, delete |
| `localDriveProbeConfigs` | list, get, create, update, delete |

La suppression d'une campagne déclenche la suppression en cascade de ses routes.

---

## Workflow type

1. **Créer un projet** avec domaine `DRIVE_TEST`
2. **Enregistrer les équipements** (onglet Équipements)
3. **Configurer les sondes** (onglet Sondes)
4. **Créer une campagne** avec zone, réseau, dates
5. **Ajouter des routes** GeoJSON à la campagne
6. **Importer des scénarios templates** depuis l'onglet Templates
7. **Créer des dataset instances** avec les gabarits Drive Test
8. **Assembler un bundle** avec les datasets par environnement
9. **Générer les scripts IA** via les templates Drive Test
10. **Exécuter** via le Run Center
11. **Analyser les résultats** dans le Reporting

---

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `types/index.ts` | +15 types/enums Drive Test |
| `config/driveTestCatalog.ts` | 10 dataset types + 20 scénarios templates |
| `config/datasetTypeCatalog.ts` | Import et merge des types Drive Test |
| `api/localStore.ts` | 4 modules CRUD (campaigns, routes, devices, probes) |
| `pages/DriveCampaignsPage.tsx` | Page complète 4 onglets |
| `pages/DriveReportingPage.tsx` | Rapport KPI consolidé |
| `ai/driveTestTemplates.ts` | 3 templates IA spécialisés |
| `ai/promptTemplates.ts` | Intégration dans le registre |
| `App.tsx` | Routes `/drive/campaigns` et `/drive/reporting` |
| `DashboardLayout.tsx` | Section "Drive Test" dans la sidebar |
