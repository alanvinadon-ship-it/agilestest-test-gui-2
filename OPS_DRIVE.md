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
