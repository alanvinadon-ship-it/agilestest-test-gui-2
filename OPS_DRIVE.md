# OPS_DRIVE — Guide Opérationnel Drive Test

## Prérequis terrain

### Équipements

Avant toute campagne, vérifier :
- Smartphone Android avec mode diagnostic activé (Samsung: `*#0011#`, Qualcomm: QXDM)
- Application de mesure installée (GNetTrack Pro, NSG ou équivalent)
- Batterie chargée > 80% + chargeur allume-cigare
- Carte SIM opérateur cible activée sur le réseau visé (4G/5G)
- GPS activé et fonctionnel

### Sondes réseau

Pour les captures protocolaires :
- Accès au SPAN port ou mirror tap configuré sur le switch
- VM edge avec tcpdump/tshark installé et droits root
- Espace disque suffisant (prévoir 1 GB par heure de capture PCAP)
- Connectivité vers MinIO/S3 pour l'upload des artefacts

### Serveurs de test

- Serveur iperf3 accessible depuis le réseau mobile (vérifier firewall)
- Serveur SIP/IMS pour les tests VoLTE (credentials dans le dataset)
- Serveur web de référence pour les tests de navigation

---

## Procédure de campagne

### Phase 1 : Préparation (J-2)

1. Créer la campagne dans AgilesTest (`/drive/campaigns`)
2. Définir les routes GeoJSON (import depuis Google Maps ou tracé manuel)
3. Vérifier les datasets : cell config, KPI thresholds, credentials
4. Valider le bundle pour l'environnement cible
5. Générer les scripts via les templates IA Drive Test
6. Tester les scripts en mode dry-run (DEV)

### Phase 2 : Exécution terrain (Jour J)

1. Vérifier l'état des équipements et sondes
2. Passer la campagne en statut RUNNING
3. Suivre le parcours défini, checkpoint par checkpoint
4. À chaque checkpoint : mesure RSRP/SINR, test débit, test latence
5. Collecter les captures réseau (PCAP, SIP traces)
6. Photographier les zones problématiques (couverture faible)

### Phase 3 : Analyse (J+1)

1. Uploader les artefacts vers MinIO
2. Consulter le rapport dans `/drive/reporting`
3. Identifier les zones en dessous des seuils KPI
4. Si échec : lancer le flow Repair avec les artefacts terrain
5. Passer la campagne en statut DONE

---

## Seuils KPI de référence

### 4G (LTE)

| KPI | Acceptable | Bon | Excellent |
|-----|-----------|-----|-----------|
| RSRP | > -110 dBm | > -100 dBm | > -85 dBm |
| SINR | > 0 dB | > 10 dB | > 20 dB |
| DL Throughput | > 5 Mbps | > 20 Mbps | > 50 Mbps |
| UL Throughput | > 2 Mbps | > 10 Mbps | > 25 Mbps |
| Latence | < 80 ms | < 50 ms | < 30 ms |

### 5G SA (NR)

| KPI | Acceptable | Bon | Excellent |
|-----|-----------|-----|-----------|
| SS-RSRP | > -110 dBm | > -95 dBm | > -80 dBm |
| SS-SINR | > 0 dB | > 13 dB | > 25 dB |
| DL Throughput | > 50 Mbps | > 200 Mbps | > 500 Mbps |
| UL Throughput | > 10 Mbps | > 50 Mbps | > 100 Mbps |
| Latence | < 20 ms | < 10 ms | < 5 ms |

### VoLTE (IMS)

| KPI | Seuil |
|-----|-------|
| Call Setup Time | < 3 s |
| MOS | > 3.5 |
| Jitter | < 30 ms |
| Packet Loss | < 1% |
| Handover Success | > 95% |

---

## Troubleshooting terrain

### Pas de mesure RSRP

- Vérifier que le mode diagnostic est activé sur le terminal
- Vérifier que l'application de mesure a les permissions nécessaires
- Redémarrer le terminal si les valeurs sont figées

### Débit très faible

- Vérifier la bande de fréquence utilisée (Band 3/7/20 en 4G, n78/n258 en 5G)
- Vérifier la charge cellulaire (nombre d'utilisateurs)
- Vérifier que le serveur iperf3 est accessible et non saturé

### Capture PCAP vide

- Vérifier le nom de l'interface réseau (`ip link show`)
- Vérifier les permissions root pour tcpdump
- Vérifier le filtre de capture (port, protocole)

### Échec VoLTE

- Vérifier l'enregistrement SIP (REGISTER 200 OK)
- Vérifier les credentials dans le dataset
- Vérifier la configuration IMS du terminal (APN IMS)

---

## Capture Policy — Configuration réseau

Depuis la version DRIVE-CAPTURE-POLICY-1, la capture réseau est gérée par une **politique de capture unifiée** avec résolution en cascade.

### Modes disponibles

| Mode | Usage | Configuration |
|------|-------|---------------|
| `NONE` | Pas de capture | Défaut |
| `RUNNER_TCPDUMP` (Mode A) | tcpdump sur le runner Docker | Interface, filtre BPF, snaplen, rotation |
| `PROBE_SPAN_TAP` (Mode B) | Sonde réseau SPAN/TAP distante | probe_id, interface, VLAN, filtre BPF |

### Résolution en cascade

```
Run Override (admin) → Scenario → Campaign → Project → NONE
```

### Configuration terrain

**Mode A (Runner tcpdump)** — Pour les tests depuis le runner Docker :
```yaml
capture_mode: RUNNER_TCPDUMP
runner_tcpdump:
  iface: eth0
  bpf_filter: "tcp port 443 or tcp port 80"
  snaplen: 65535
  rotate_mb: 100
  max_files: 5
```

**Mode B (Probe SPAN/TAP)** — Pour les captures sur le réseau opérateur :
```yaml
capture_mode: PROBE_SPAN_TAP
probe_span_tap:
  probe_id: probe-abidjan-01
  iface: ens192
  bpf_filter: "host 10.0.0.0/8"
  vlan_filter: 100
  rotate_mb: 200
```

### Vérification avant campagne

1. Vérifier que la politique de capture est configurée au niveau projet ou campagne
2. Mode A : vérifier que `tcpdump` est installé et que les capabilities Docker sont présentes
3. Mode B : vérifier que la probe est `ONLINE` via la page Probes
4. Vérifier l'espace disque MinIO (prévoir 1 GB/heure de capture)

Pour la documentation complète, voir [CAPTURE_POLICY.md](./docs/CAPTURE_POLICY.md).

---

## Convention de nommage des artefacts

```
/{project_id}/{execution_id}/
  ├── kpi/
  │   ├── rsrp_samples.json
  │   ├── throughput_dl.json
  │   └── latency_samples.json
  ├── captures/
  │   ├── pcap_checkpoint_001.pcap
  │   └── sip_trace.pcap
  ├── screenshots/
  │   ├── coverage_gap_001.png
  │   └── signal_strength_002.png
  ├── logs/
  │   ├── runner.log
  │   └── device_diag.log
  └── report/
      └── campaign_report.json
```

---

## Corrélation KPI ↔ Route ↔ Artefacts (DRIVE-CORRELATION-1)

> Ajouté par la mission DRIVE-CORRELATION-1 — 2026-02-18

### Segmentation de route

Les routes de campagne sont automatiquement découpées en **segments de 50m** (configurable). Chaque segment est classifié en **OK / WARN / CRIT** selon les seuils KPI configurés (voir `DEFAULT_KPI_THRESHOLDS` dans `driveCorrelation/types.ts`).

### Visualisation

La page **Drive Test — Corrélation & Reporting** (`/drive/reporting`) offre :

1. **Barre de segments colorés** : vue d'ensemble de la qualité réseau le long de la route
2. **Timeline KPI** : courbe temporelle avec marqueurs de breach et lignes de seuil
3. **Drill-down segment** : click sur un segment pour voir stats, violations, artefacts et incidents
4. **Filtres** : sélection du KPI, fenêtre temporelle (5s/10s/30s), projet, campagne, job

### Index temporel des artefacts

Les artefacts (PCAP, logs) sont indexés par fenêtre temporelle et source (RUNNER ou PROBE). Le drill-down affiche automatiquement les artefacts dont la fenêtre chevauche celle du segment sélectionné (±30s de marge).

### Incidents automatiques

Lorsque `auto_incidents` est activé (défaut : ON), des incidents Drive sont générés automatiquement :

| Condition | Sévérité |
|---|---|
| Segment CRIT + breach_pct ≥ 30% | **P0** (Critique) |
| Segment CRIT + breach_pct < 30% | **P1** (Majeur) |
| Segment WARN + breach_pct ≥ 50% | **P1** (Majeur) |
| Segment WARN + breach_pct < 50% | **P2** (Mineur) |

Les incidents sont dédupliqués (même KPI + même segment + fenêtre qui se chevauche) et les segments contigus sont fusionnés pour réduire le bruit.

### Intégration IA REPAIR

Chaque incident Drive dispose d'un bouton **"Analyze & Repair (Drive)"** qui :

1. Construit le contexte d'analyse (KPI, seuils, artefacts, géolocalisation)
2. Appelle le template `PROMPT_DRIVE_REPAIR_v1` (ou simulation locale)
3. Retourne des patches ciblés avec cause racine et confiance

### Documentation complète

Voir `docs/DRIVE_CORRELATION.md` pour l'architecture détaillée, les algorithmes et les tests recommandés.
