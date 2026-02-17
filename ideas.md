# AgilesTest — GUI Frontend Design Ideas (v2 — Docker Frontend)

## Contexte
Reconstruction de la GUI frontend-app du package Docker AgilesTest. L'interface doit permettre de : se connecter (login), créer/gérer des projets, configurer des profils de test (SIP/DIAMETER/HTTP2), gérer des scénarios et datasets, lancer des exécutions, visualiser les captures réseau (PCAP/logs), gérer les sondes, et analyser les incidents. Architecture microservices avec APIs REST (admin-api, repository-api, collector-api, orchestration-api, analysis-api, reporting-api).

---

## Choix retenu : "Signal Flow" — Esthétique Réseau Télécom

L'approche reprend le vocabulaire visuel des ingénieurs réseau d'Orange CIV, avec un fond sombre adapté aux sessions longues, l'orange comme accent naturel (identité Orange), et une navigation organisée par workflow de test.

**Color Philosophy** : Fond sombre bleu nuit (#0C1222). Accent orange télécom (#F97316). Cyan (#06B6D4) pour les éléments de capture réseau. Surfaces en (#151D2E). Texte principal (#E2E8F0), secondaire (#94A3B8).

**Typography** : Space Grotesk pour les titres, Inter pour le body, Fira Code pour les éléments techniques.

**Layout** : Sidebar avec icônes + labels, organisée par workflow. Zone principale avec header contextuel. Cards avec indicateurs de statut intégrés.

**Signature Elements** : Bordures latérales colorées par statut, badges de domaine (WEB, IMS, 5GC), indicateurs de workflow.
