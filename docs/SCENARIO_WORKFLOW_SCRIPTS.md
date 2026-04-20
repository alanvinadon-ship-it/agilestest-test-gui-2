# Scénarios : Finalisation et Génération de Scripts

> Ce guide décrit le cycle de vie complet d'un scénario de test dans AgilesTest, depuis sa création en tant que brouillon jusqu'à sa finalisation, puis la génération automatique de scripts exécutables par l'IA. Chaque étape clé est illustrée par des captures d'écran annotées.

---

## Table des matières

1. [Vue d'ensemble du workflow](#vue-densemble-du-workflow)
2. [Prérequis](#prérequis)
3. [Créer un scénario (Brouillon)](#créer-un-scénario-brouillon)
4. [Finaliser un scénario (DRAFT → FINAL)](#finaliser-un-scénario-draft--final)
5. [Générer un script via l'IA](#générer-un-script-via-lia)
6. [Gérer les scripts générés](#gérer-les-scripts-générés)
7. [Cycle de vie complet d'un scénario](#cycle-de-vie-complet-dun-scénario)
8. [Permissions requises (RBAC)](#permissions-requises-rbac)
9. [Résolution de problèmes](#résolution-de-problèmes)

---

## Vue d'ensemble du workflow

Le workflow des scénarios dans AgilesTest suit un cycle de vie en trois statuts, conçu pour garantir la qualité et la traçabilité des tests avant leur exécution.

```
DRAFT (Brouillon)  ──►  FINAL (Finalisé)  ──►  DEPRECATED (Déprécié)
     │                        │                        │
     │  Édition libre         │  Verrouillé            │  Archivé
     │  Suppression possible  │  Génération scripts    │  Lecture seule
     │                        │  Fork possible         │
```

Le passage de **DRAFT** à **FINAL** est une étape critique qui déclenche une validation automatique du contenu du scénario. Une fois finalisé, le scénario devient la référence officielle pour la génération de scripts et l'exécution des tests.

| Statut | Description | Actions disponibles |
|--------|-------------|---------------------|
| **DRAFT** (Brouillon) | Scénario en cours de rédaction. Modifiable et supprimable librement. | Éditer, Supprimer, Finaliser |
| **FINAL** (Finalisé) | Scénario validé et verrouillé. Sert de base pour la génération de scripts. | Générer Script, Générer Prompt IA, Forker, Déprécier, Exporter |
| **DEPRECATED** (Déprécié) | Scénario archivé. Conservé pour historique mais plus utilisable pour de nouvelles exécutions. | Consultation uniquement |

---

## Prérequis

Avant de commencer à travailler avec les scénarios, assurez-vous que les éléments suivants sont en place.

**Projet actif** : Un projet doit être sélectionné dans la barre supérieure. Tous les scénarios sont rattachés à un projet spécifique. Si aucun projet n'est sélectionné, rendez-vous dans **Projets** pour en créer ou en sélectionner un.

**Profil de test configuré** : Au moins un profil de test doit exister dans le projet. Le profil définit le domaine technique (Web, API, Mobile, Télécom), le type de test (VABF, VSR, VABE), le protocole et les paramètres de connexion. Les scénarios sont regroupés par profil dans l'interface.

**Permissions utilisateur** : Votre rôle doit disposer des permissions appropriées (voir la section [Permissions requises](#permissions-requises-rbac)).

---

## Créer un scénario (Brouillon)

La création d'un scénario se fait depuis la page **Configuration → Scénarios**. La capture ci-dessous montre la vue d'ensemble de cette page avec ses principaux éléments d'interface.

![Page Scénarios — Vue d'ensemble annotée](/manus-storage/01-scenarios-page-annotated_389ba4f3.png)

> **Légende de la capture** : **(1)** Menu Scénarios dans la barre latérale — **(2)** Filtres par type de test (Tous, VABF, VSR, VABE) — **(3)** Filtres par statut (Tous, Brouillon, Finalisé, Déprécié) — **(4)** Bouton « + Nouveau scénario » pour créer un scénario — **(5)** En-tête du profil de test avec le type, le domaine et le runner associé.

Cliquez sur le bouton **+ Nouveau scénario** (repère 4) en haut à droite de la page pour ouvrir le formulaire de création.

### Informations obligatoires

Le formulaire de création demande les informations suivantes :

| Champ | Description | Obligatoire |
|-------|-------------|:-----------:|
| **Nom** | Titre descriptif du scénario. Doit suivre la nomenclature du projet (ex: `VABF-WEB-001-AUTH-LOGIN`). | Oui |
| **Type de test** | VABF (fonctionnel), VSR (service/résilience) ou VABE (performance/sécurité). | Oui |
| **Profil associé** | Profil de test qui définit le contexte technique d'exécution. | Oui |
| **Description** | Description libre du périmètre et des objectifs du scénario. | Non |
| **Code scénario** | Identifiant unique généré automatiquement (modifiable). Format : `SC-XXXXXXX`. | Auto |

### Définir les étapes

Chaque scénario contient une ou plusieurs **étapes** ordonnées. Chaque étape décrit une action à réaliser et le résultat attendu.

| Champ de l'étape | Description | Obligatoire pour finaliser |
|-------------------|-------------|:--------------------------:|
| **Action** | L'action à effectuer (ex: "Envoyer une requête POST /api/login"). | Recommandé |
| **Description** | Détails complémentaires sur l'étape. | Non |
| **Résultat attendu** | Le comportement attendu après l'action (ex: "Code HTTP 200, token JWT retourné"). | Oui (au moins 1) |
| **Paramètres** | Paramètres techniques spécifiques à l'étape (clé/valeur). | Non |

Pour ajouter une étape, cliquez sur le bouton **+ Ajouter une étape** dans le formulaire d'édition du scénario. Les étapes peuvent être réordonnées par glisser-déposer grâce à l'icône de poignée à gauche de chaque étape.

### Datasets requis

La section **Datasets requis** permet de spécifier les types de jeux de données nécessaires à l'exécution du scénario (ex: `load_test_data`, `auth_credentials`). Ces types seront vérifiés lors de la configuration des bundles d'exécution.

---

## Finaliser un scénario (DRAFT → FINAL)

La finalisation est l'étape qui transforme un brouillon en scénario officiel, prêt pour la génération de scripts et l'exécution. La capture ci-dessous montre un scénario déplié au statut Brouillon avec ses boutons d'action.

![Scénario déplié — Détails et boutons d'action](/manus-storage/02-scenario-details-annotated_7faee76a.png)

> **Légende de la capture** : **(1)** Badge de statut « Brouillon » (orange) — **(2)** Titre et code unique du scénario — **(3)** Barre de boutons d'action (de gauche à droite : Finaliser, Générer Prompt IA, Générer Script, Éditer, Publier template, Exporter JSON, Supprimer) — **(4)** Politique de capture réseau (Aucune, Runner, Probe) — **(5)** Indicateur de datasets liés au scénario.

### Conditions de validation

Avant de pouvoir finaliser un scénario, trois conditions doivent être remplies. Le système vérifie automatiquement ces conditions et affiche un indicateur visuel (coche verte ou triangle orange) pour chacune.

| Condition | Détail | Icône |
|-----------|--------|:-----:|
| **Titre non vide** | Le champ `name` du scénario doit contenir au moins un caractère non-espace. | ✅ / ⚠️ |
| **Au moins 1 étape** | Le tableau `steps` doit contenir au moins une entrée. | ✅ / ⚠️ |
| **Au moins 1 résultat attendu** | Au moins une étape doit avoir un champ `expected_result` non vide. | ✅ / ⚠️ |

### Procédure pas à pas

**Étape 1 — Accéder à la page Scénarios.** Naviguez vers **Configuration → Scénarios** dans le menu latéral (repère 1 de la première capture). Sélectionnez le projet concerné si ce n'est pas déjà fait.

**Étape 2 — Identifier le scénario à finaliser.** Les scénarios au statut **Brouillon** sont identifiés par un badge orange « Brouillon » (repère 1 de la capture ci-dessus). Utilisez les filtres par statut (repère 3 de la première capture) pour afficher uniquement les brouillons.

**Étape 3 — Vérifier le contenu.** Avant de finaliser, assurez-vous que le scénario contient toutes les étapes nécessaires avec leurs résultats attendus. Cliquez sur le scénario pour le déplier et vérifier son contenu, comme illustré dans la capture ci-dessus.

**Étape 4 — Cliquer sur le bouton Finaliser.** Dans la barre d'actions (repère 3), cliquez sur l'icône de validation (coche verte ✓), qui est le premier bouton à gauche. Ce bouton n'apparaît que pour les scénarios au statut DRAFT et si vous disposez de la permission `scenarios.activate`.

**Étape 5 — Confirmer dans la boîte de dialogue.** La capture ci-dessous montre la boîte de dialogue de finalisation qui s'ouvre après avoir cliqué sur le bouton Finaliser.

![Boîte de dialogue — Finaliser le scénario](/manus-storage/03-finalize-dialog-annotated_f08155eb.png)

> **Légende de la capture** : **(1)** Titre de la boîte de dialogue « Finaliser le scénario » — **(2)** Récapitulatif du scénario concerné (nom complet, code, nombre d'étapes, version) — **(3)** Checklist de validation automatique des 3 critères (titre non vide, au moins 1 étape, au moins 1 résultat attendu) avec indicateurs visuels — **(4)** Bouton de confirmation « Finaliser → FINAL » (actif uniquement si les 3 critères sont remplis) — **(5)** Bouton « Annuler » pour fermer sans modifier.

Si toutes les conditions sont remplies (trois coches vertes dans le repère 3), cliquez sur **Finaliser → FINAL** (repère 4). Si des conditions ne sont pas remplies (triangles orange), la finalisation sera refusée et les erreurs seront affichées en rouge.

**Étape 6 — Confirmation.** Après une finalisation réussie, un message de succès s'affiche et le statut du scénario passe à **FINAL**. La liste des scénarios est automatiquement rafraîchie. Vous pouvez vérifier le résultat en utilisant le filtre « Finalisé » comme illustré ci-dessous.

![Filtre Finalisé actif](/manus-storage/06-filter-finalise-annotated_a8366e8e.png)

> **Légende de la capture** : **(1)** Filtre « Finalisé » activé (surligné en vert) pour afficher uniquement les scénarios au statut FINAL — **(2)** Indicateur du workflow (DRAFT → FINAL → DEPRECATED) affiché en en-tête de page.

### Que se passe-t-il après la finalisation ?

Une fois finalisé, le scénario est **verrouillé en édition directe**. Les modifications ne sont plus possibles via le bouton Éditer classique. À la place, le bouton se transforme en **Forker** (icône branche Git), permettant de créer une nouvelle version du scénario en tant que brouillon, tout en conservant l'original intact.

---

## Générer un script via l'IA

La génération de scripts est la fonctionnalité phare d'AgilesTest. Elle utilise un modèle de langage (LLM) pour transformer un scénario finalisé en code exécutable, adapté au framework et à l'environnement cible.

### Prérequis pour la génération

Avant de lancer la génération, les éléments suivants doivent être en place :

| Élément | Description |
|---------|-------------|
| **Scénario finalisé** | Le scénario doit être au statut FINAL (ou DRAFT avec permission). |
| **Bundle actif** | Un bundle de datasets au statut ACTIVE doit exister pour l'environnement cible. |
| **Datasets associés** | Le bundle doit contenir les datasets nécessaires au scénario. |
| **Configuration IA** | Le moteur IA doit être configuré (Administration → Paramètres IA). |

### Procédure de génération en 5 étapes

La génération de script suit un processus en 5 phases, guidé par un assistant modal. La capture ci-dessous montre l'écran de configuration initial du modal de génération.

![Modal de génération de script IA — Phase Configuration](/manus-storage/04-generate-script-annotated_bf3ac5fa.png)

> **Légende de la capture** : **(1)** Titre du modal avec le code du scénario et le badge « LLM » indiquant l'utilisation de l'intelligence artificielle — **(2)** Fil d'Ariane des 5 étapes du processus (Configuration → Plan IA → Revue du plan → Génération IA → Résultat) — **(3)** Sélecteurs de configuration : environnement cible (DEV, PREPROD, etc.) et bundle actif associé — **(4)** Message d'avertissement si aucun bundle ACTIVE n'est trouvé pour l'environnement sélectionné — **(5)** Zone d'information sur le mode de génération (streaming SSE) et bouton « Lancer la planification IA ».

#### Phase 1 — Configuration

Cliquez sur l'icône **Générer Script** (icône code `</>` en cyan, repère 3 de la barre d'actions du scénario) dans la barre d'actions du scénario. Le modal de génération s'ouvre sur l'étape de configuration (repère 2 montre l'étape active).

Sélectionnez l'**environnement cible** (repère 3, sélecteur de gauche) parmi les options disponibles :

| Environnement | Usage |
|---------------|-------|
| **DEV** | Développement et tests unitaires |
| **PREPROD** | Validation pré-production |
| **PILOT_ORANGE** | Pilote client Orange |
| **PROD** | Production |

Sélectionnez ensuite le **bundle** actif (repère 3, sélecteur de droite) correspondant à l'environnement choisi. Le bundle regroupe les datasets (jeux de données) nécessaires à l'exécution du script. Si aucun bundle ACTIVE n'est disponible pour l'environnement sélectionné, un message d'avertissement s'affiche (repère 4).

Cliquez sur **Lancer la planification IA** (repère 5) pour démarrer.

#### Phase 2 — Planification IA

Le LLM analyse le scénario, le profil de test, et les datasets du bundle pour produire un **plan de génération**. Cette phase dure généralement quelques secondes. Un indicateur de chargement s'affiche pendant l'analyse.

#### Phase 3 — Revue du plan

Le plan de génération est présenté pour validation avant la génération du code. Il contient les informations suivantes :

**Framework et langage** : Le LLM choisit automatiquement le framework le plus adapté au profil de test.

| Framework | Cas d'usage |
|-----------|-------------|
| **Playwright** | Tests Web (navigateur), API REST |
| **RobotFramework** | Tests multi-domaines, keyword-driven |
| **Cypress** | Tests Web front-end |
| **Selenium** | Tests Web legacy |
| **K6** | Tests de charge et performance (VABE) |
| **Custom** | Scripts personnalisés |

**Fichiers planifiés** : Liste des fichiers qui seront générés, avec leur chemin et leur rôle (ex: `tests/auth-login.spec.ts` — Test principal d'authentification).

**Mapping étapes** : Correspondance entre chaque étape du scénario et la fonction/fichier qui l'implémentera. Chaque mapping indique l'action, le fichier cible, la fonction cible, et les clés de dataset utilisées.

**Inputs manquants** : Si des données sont manquantes, elles sont signalées avec un niveau de sévérité (BLOCKING ou WARNING). Les inputs BLOCKING empêchent la génération et nécessitent de compléter les datasets.

Si le plan est satisfaisant, cliquez sur **Générer le code** pour lancer la phase suivante.

#### Phase 4 — Génération IA (Streaming)

Le LLM génère le code en temps réel via **streaming SSE** (Server-Sent Events). Le code apparaît progressivement dans la fenêtre de prévisualisation, caractère par caractère. Un compteur de caractères et un indicateur « STREAMING » confirment que la génération est en cours. Cette phase peut durer de 10 à 60 secondes selon la complexité du scénario.

#### Phase 5 — Résultat

Une fois la génération terminée, le résultat est présenté sous forme de **package de scripts** contenant les **fichiers générés** (code source complet, fichiers de configuration, helpers consultables individuellement via les onglets), les **notes de génération** (recommandations du LLM sur l'utilisation du script), et les **avertissements** (points d'attention identifiés par le LLM).

Deux actions sont disponibles à cette étape :

| Action | Description |
|--------|-------------|
| **Copier** | Copie le contenu d'un fichier dans le presse-papiers. |
| **Sauvegarder** | Enregistre le script en base de données au statut DRAFT. |

Cliquez sur **Sauvegarder** pour persister le script. Un message de confirmation s'affiche et le script devient accessible depuis la page **Scripts Générés**.

### Générer un Prompt IA (alternative)

En complément de la génération automatique de scripts, AgilesTest propose la génération de **prompts IA**. Cette fonctionnalité produit un prompt structuré que vous pouvez utiliser dans un outil IA externe (ChatGPT, Claude, Copilot, etc.) pour générer ou affiner un script manuellement.

Cliquez sur l'icône **Générer Prompt IA** (icône bulle de message en violet) dans la barre d'actions du scénario. Le prompt généré inclut le contexte complet du scénario, du profil et des datasets.

---

## Gérer les scripts générés

Les scripts générés sont accessibles depuis la page **Configuration → Scripts Générés** dans le menu latéral. La capture ci-dessous montre cette page.

![Page Scripts Générés](/manus-storage/05-scripts-generes-annotated_df6a9ea2.png)

> **Légende de la capture** : **(1)** Titre de la page « Scripts Générés » — **(2)** Compteur du nombre total de scripts — **(3)** Filtres de recherche : champ texte, sélecteur de framework (Playwright, RobotFramework, Cypress, K6), sélecteur de statut (Brouillon, Actif, Déprécié) — **(4)** Zone d'affichage des scripts (vide ici, avec un message invitant à utiliser le bouton « Générer Script » depuis un scénario) — **(5)** Lien « Scripts Générés » dans le menu latéral.

### Statuts des scripts

Les scripts suivent leur propre cycle de vie, indépendant de celui des scénarios.

| Statut | Description | Actions |
|--------|-------------|---------|
| **DRAFT** (Brouillon) | Script nouvellement généré, en attente de validation. | Activer, Supprimer, Comparer |
| **ACTIVE** (Actif) | Script validé, utilisable pour les exécutions. | Déprécier, Télécharger, Comparer |
| **DEPRECATED** (Déprécié) | Script archivé, remplacé par une version plus récente. | Consultation uniquement |

### Filtres et recherche

La page Scripts Générés propose plusieurs filtres pour retrouver rapidement un script (repère 3 de la capture ci-dessus) :

| Filtre | Options |
|--------|---------|
| **Recherche** | Recherche textuelle sur le nom du scénario ou le code. |
| **Framework** | Playwright, RobotFramework, Cypress, K6, Custom |
| **Statut** | Brouillon, Actif, Déprécié |
| **Environnement** | DEV, PREPROD, PILOT_ORANGE, PROD |

### Comparer les versions (Diff)

Lorsque plusieurs versions d'un script existent pour un même scénario, le bouton **Comparer** (icône diff) permet d'afficher un comparatif côte à côte des fichiers, mettant en évidence les ajouts, suppressions et modifications entre deux versions.

### Télécharger un script

Les scripts au statut ACTIVE peuvent être téléchargés pour une exécution locale ou une intégration CI/CD. Le téléchargement produit l'ensemble des fichiers du package (code source, configuration, helpers) dans leur structure de répertoires d'origine.

---

## Cycle de vie complet d'un scénario

Le diagramme ci-dessous résume le parcours complet, de la création du scénario à l'exécution du script.

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. CRÉER LE SCÉNARIO                                               │
│     Page: Configuration → Scénarios → + Nouveau scénario            │
│     Statut initial: DRAFT                                           │
│     Renseigner: nom, type de test, profil, étapes, résultats        │
├─────────────────────────────────────────────────────────────────────┤
│  2. COMPLÉTER LES ÉTAPES                                            │
│     Ajouter les étapes avec actions et résultats attendus           │
│     Associer les types de datasets requis                           │
│     Configurer la politique de capture (optionnel)                  │
├─────────────────────────────────────────────────────────────────────┤
│  3. FINALISER LE SCÉNARIO                                           │
│     Bouton: ✓ (coche verte) → Boîte de dialogue de validation      │
│     Vérification: titre ✓, étapes ✓, résultats attendus ✓          │
│     Statut: DRAFT → FINAL                                           │
├─────────────────────────────────────────────────────────────────────┤
│  4. PRÉPARER LE BUNDLE                                              │
│     Page: Configuration → Bundles                                   │
│     Créer un bundle pour l'environnement cible (DEV, PREPROD...)    │
│     Associer les datasets nécessaires, activer le bundle            │
├─────────────────────────────────────────────────────────────────────┤
│  5. GÉNÉRER LE SCRIPT                                               │
│     Bouton: </> (icône code cyan) → Modal de génération IA          │
│     Sélectionner environnement + bundle → Plan IA → Génération      │
│     Sauvegarder le script en base de données                        │
├─────────────────────────────────────────────────────────────────────┤
│  6. ACTIVER ET EXÉCUTER                                             │
│     Page: Configuration → Scripts Générés → Activer le script       │
│     Page: Exécution → Exécutions → Lancer une exécution             │
│     Sélectionner le scénario et le script actif                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Permissions requises (RBAC)

Le système de contrôle d'accès basé sur les rôles (RBAC) d'AgilesTest définit des permissions granulaires pour chaque action sur les scénarios et les scripts.

### Permissions Scénarios

| Permission | Clé | Description |
|------------|-----|-------------|
| Lire | `scenarios.read` | Consulter les scénarios du projet. |
| Créer | `scenarios.create` | Créer de nouveaux scénarios. |
| Modifier | `scenarios.update` | Éditer les scénarios au statut DRAFT, forker les scénarios FINAL. |
| Supprimer | `scenarios.delete` | Supprimer les scénarios au statut DRAFT uniquement. |
| Activer/Finaliser | `scenarios.activate` | Passer un scénario de DRAFT à FINAL, ou de FINAL à DEPRECATED. |

### Permissions Scripts

| Permission | Clé | Description |
|------------|-----|-------------|
| Lire | `scripts.read` | Consulter les scripts générés. |
| Générer | `scripts.create` | Lancer la génération IA d'un script. |
| Activer | `scripts.activate` | Passer un script de DRAFT à ACTIVE. |
| Supprimer | `scripts.delete` | Supprimer un script. |
| Télécharger | `scripts.download` | Télécharger les fichiers d'un script. |

> **Note** : Les permissions sont gérées par l'administrateur depuis **Administration → Rôles et Permissions**. Par défaut, le rôle Admin dispose de toutes les permissions, tandis que le rôle Testeur dispose des permissions de lecture, création et génération.

---

## Résolution de problèmes

### Le bouton Finaliser n'apparaît pas

Ce problème peut avoir deux causes. Premièrement, vérifiez que le scénario est bien au statut **DRAFT** (badge orange « Brouillon », repère 1 de la capture du scénario déplié). Le bouton Finaliser n'apparaît pas pour les scénarios déjà finalisés ou dépréciés. Deuxièmement, vérifiez que votre rôle dispose de la permission `scenarios.activate`. Contactez votre administrateur si nécessaire.

### La finalisation échoue avec des erreurs de validation

Si la boîte de dialogue affiche des triangles orange (repère 3 de la capture de la boîte de finalisation), corrigez les problèmes identifiés avant de réessayer. Les erreurs les plus courantes sont : un titre vide ou composé uniquement d'espaces, aucune étape définie dans le scénario, ou aucun résultat attendu renseigné dans les étapes. Retournez à l'édition du scénario (bouton crayon dans la barre d'actions) pour compléter les informations manquantes.

### Aucun bundle disponible pour la génération de script

La génération de script nécessite un bundle au statut **ACTIVE** pour l'environnement sélectionné (repère 4 de la capture du modal de génération montre l'avertissement correspondant). Rendez-vous dans **Configuration → Bundles** pour créer un bundle, y associer les datasets nécessaires, puis l'activer. Assurez-vous que l'environnement du bundle correspond à celui sélectionné dans le modal de génération.

### Erreur "Inputs manquants bloquants" lors de la planification

Le LLM a identifié des données manquantes dans les datasets du bundle. Les inputs marqués **BLOCKING** empêchent la génération. Complétez les datasets concernés dans **Configuration → Datasets** avec les valeurs manquantes, puis relancez la génération.

### Le script généré ne correspond pas aux attentes

La qualité du script dépend directement de la précision des étapes du scénario et de la complétude des datasets. Pour améliorer les résultats, rédigez des étapes détaillées avec des actions explicites (ex: "Envoyer POST /api/v1/auth/login avec body {email, password}" plutôt que "Se connecter"), renseignez des résultats attendus précis (ex: "HTTP 200, body contient access_token de type JWT" plutôt que "Succès"), et assurez-vous que les datasets contiennent toutes les valeurs nécessaires (URLs, credentials, paramètres).

---

*Document généré pour AgilesTest v1.1.0 — Dernière mise à jour : 20 avril 2026*
