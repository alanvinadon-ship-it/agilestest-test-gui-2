# ADMIN_NOTIFICATIONS — Guide d'administration des notifications

> **Version** : 1.0 — Mission ADMIN-NOTIFICATIONS-1  
> **Date** : 2026-02-18  
> **Auteur** : Équipe AgilesTest

---

## 1. Vue d'ensemble

Le module Notifications permet d'envoyer des alertes automatiques par **SMS (Orange API)** et **E-mail (SMTP)** lors d'événements clés de la plateforme. Il est accessible depuis **Admin → Notifications** et comprend 5 onglets :

| Onglet | Fonction | Permission requise |
|--------|----------|--------------------|
| SMS (Orange) | Configuration provider SMS + test d'envoi | `settings.notifications.read/update/test` |
| E-mail (SMTP) | Configuration SMTP + test d'envoi | `settings.notifications.read/update/test` |
| Templates | Gestion des modèles de messages | `notifications.templates.read/update` |
| Règles | Mapping événement → canaux + destinataires | `notifications.rules.read/update` |
| Delivery Logs | Journal d'envoi avec filtres et drill-down | `notifications.delivery.read` |

---

## 2. Permissions RBAC

Le module ajoute 8 permissions au catalogue RBAC, regroupées dans le groupe **Notifications** :

| Permission | Description | Rôles par défaut |
|------------|-------------|------------------|
| `settings.notifications.read` | Voir la configuration des canaux | ADMIN, MANAGER |
| `settings.notifications.update` | Modifier la configuration | ADMIN |
| `settings.notifications.test` | Envoyer des messages de test | ADMIN |
| `settings.notifications.disable` | Désactiver un canal | ADMIN |
| `notifications.templates.read` | Voir les templates | ADMIN, MANAGER |
| `notifications.templates.update` | Créer/modifier/supprimer des templates | ADMIN |
| `notifications.rules.read` | Voir les règles d'envoi | ADMIN, MANAGER |
| `notifications.rules.update` | Modifier les règles | ADMIN |
| `notifications.delivery.read` | Consulter les logs d'envoi | ADMIN, MANAGER |

---

## 3. Configuration SMS Orange

### 3.1 Paramètres

Le canal SMS utilise l'API Orange SMS CI. Deux modes d'authentification sont supportés :

**OAuth2 Client Credentials** (recommandé pour Orange) :
- **Base URL** : URL de l'API SMS Orange (ex: `https://api.orange.com/smsmessaging/v1`)
- **Token URL** : Endpoint OAuth2 (ex: `https://api.orange.com/oauth/v1/token`)
- **Client ID** / **Client Secret** : Identifiants OAuth2 fournis par Orange
- **Scope** : Scope OAuth2 (optionnel)
- **Sender ID** : Nom d'expéditeur affiché (ex: `AgilesTest`)

**API Key** :
- **API Key** : Clé d'API directe

### 3.2 Sécurité des secrets

Tous les secrets (Client ID, Client Secret, API Key, mots de passe SMTP) sont **masqués** dans l'interface. Le masquage est appliqué côté store : les valeurs réelles ne sont jamais exposées dans le frontend. Pour modifier un secret, cliquer sur l'icône d'édition à côté du champ masqué.

### 3.3 Mode Stub

Si le canal est désactivé ou le provider est `NONE`, le système fonctionne en **mode Stub** : les envois sont simulés localement et enregistrés dans les Delivery Logs avec le provider `STUB`. Ce mode est utile pour les tests et le développement.

### 3.4 Test SMS

Le bouton "Test SMS" permet d'envoyer un message de test à un numéro MSISDN. Le résultat affiche :
- Statut (OK/ERROR)
- Réponse provider
- Trace ID (pour le diagnostic)
- Durée de l'appel

---

## 4. Configuration E-mail SMTP

### 4.1 Paramètres

| Paramètre | Description | Exemple |
|-----------|-------------|---------|
| Host | Serveur SMTP | `smtp.orange.ci` |
| Port | Port SMTP | `587` |
| Sécurité | Mode TLS | `STARTTLS` / `TLS` / `NONE` |
| Username | Identifiant SMTP | (masqué) |
| Password | Mot de passe SMTP | (masqué) |
| From Email | Adresse d'expédition | `noreply@agilestest.io` |
| From Name | Nom d'affichage | `AgilesTest` |
| Reply-To | Adresse de réponse | `support@agilestest.io` |
| Timeout | Timeout en ms | `10000` |

---

## 5. Templates

### 5.1 Templates système

8 templates système sont pré-installés et couvrent les événements principaux :

| Template | Canal | Événement |
|----------|-------|-----------|
| `invite_user_email` | EMAIL | Invitation utilisateur |
| `invite_user_sms` | SMS | Invitation utilisateur |
| `execution_failed_email` | EMAIL | Exécution échouée |
| `execution_failed_sms` | SMS | Exécution échouée |
| `execution_passed_email` | EMAIL | Exécution réussie |
| `incident_created_email` | EMAIL | Incident créé |
| `drive_kpi_breach_email` | EMAIL | Seuil KPI Drive dépassé |
| `drive_kpi_breach_sms` | SMS | Seuil KPI Drive dépassé |

Les templates système ne peuvent pas être supprimés mais peuvent être modifiés et désactivés.

### 5.2 Variables

Les templates utilisent la syntaxe `{{variable}}` pour insérer des données dynamiques. Variables disponibles :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `app.name` | Nom de l'application | AgilesTest |
| `app.base_url` | URL de base | https://agilestest.orange.ci |
| `actor.name` | Nom de l'utilisateur | Jean Dupont |
| `actor.email` | Email de l'utilisateur | jean@orange.ci |
| `project.name` | Nom du projet | Orange-WEB |
| `execution.id` | ID d'exécution | exec_789 |
| `execution.status` | Statut d'exécution | FAILED |
| `execution.trace_id` | Trace ID | tr_abc123 |
| `incident.id` | ID d'incident | inc_042 |
| `incident.summary` | Résumé de l'incident | Login timeout |
| `incident.severity` | Sévérité | P1 |
| `drive.campaign` | Campagne Drive | Abidjan-Nord Q1 |
| `drive.kpi_name` | KPI en alerte | RSRP |
| `drive.value` | Valeur observée | -115 dBm |
| `drive.threshold` | Seuil configuré | -110 dBm |
| `invite.link` | Lien d'invitation | https://... |
| `invite.expires_at` | Date d'expiration | 2026-03-01 |

### 5.3 Preview

Le bouton Preview permet de visualiser le rendu d'un template avec des données d'exemple. Les variables sont remplacées par des valeurs réalistes pour vérifier le formatage.

### 5.4 Créer un template personnalisé

1. Cliquer sur "Nouveau template"
2. Renseigner l'ID (slug), le nom, le canal (SMS/Email)
3. Rédiger le corps du message en utilisant les variables
4. Sauvegarder

---

## 6. Règles d'envoi

### 6.1 Événements supportés

| Événement | Description |
|-----------|-------------|
| `USER_INVITED` | Invitation d'un utilisateur |
| `INVITE_ACCEPTED` | Invitation acceptée |
| `EXECUTION_FAILED` | Exécution échouée |
| `EXECUTION_PASSED` | Exécution réussie |
| `INCIDENT_CREATED` | Incident créé |
| `REPAIR_PROPOSED` | Repair IA proposé |
| `DRIVE_KPI_THRESHOLD_BREACH` | Seuil KPI Drive dépassé |

### 6.2 Configuration d'une règle

Chaque règle définit :
- **Canaux activés** : SMS et/ou Email
- **Templates** : Template SMS et/ou Email à utiliser
- **Destinataires** : Acteur, Utilisateur cible, Admins projet, Admins globaux, Custom
- **Throttle** : Max par heure + fenêtre de déduplication

### 6.3 Destinataires personnalisés

Si le type `CUSTOM` est sélectionné, des emails et numéros MSISDN spécifiques peuvent être ajoutés.

### 6.4 Test de règle

Le bouton "Tester cette règle" simule l'envoi avec un contexte d'exemple et enregistre les résultats dans les Delivery Logs.

---

## 7. Delivery Logs

### 7.1 Filtres

Les logs peuvent être filtrés par :
- Canal (SMS/Email)
- Statut (Envoyé/Échoué/Ignoré/Limité)
- Événement
- Destinataire (recherche textuelle)

### 7.2 Statuts

| Statut | Signification |
|--------|---------------|
| `SENT` | Message envoyé avec succès |
| `FAILED` | Échec de l'envoi (erreur provider) |
| `SKIPPED` | Envoi ignoré (canal désactivé, template manquant) |
| `THROTTLED` | Envoi limité par la politique de throttle |

### 7.3 Drill-down

Cliquer sur l'icône œil pour voir les détails complets d'un envoi : ID, date, canal, provider, événement, règle, template, destinataire, statut, trace ID, erreur et metadata.

### 7.4 Export CSV

Le bouton "Export CSV" télécharge l'intégralité des logs au format CSV.

---

## 8. Audit

Toutes les actions sur le module Notifications sont enregistrées dans le journal d'audit avec le type d'entité `notifications` :

| Action | Description |
|--------|-------------|
| `notifications_settings_updated` | Configuration canal modifiée |
| `notifications_channel_disabled` | Canal désactivé |
| `notifications_sms_test_sent` | SMS de test envoyé |
| `notifications_email_test_sent` | Email de test envoyé |
| `notifications_template_created` | Template créé |
| `notifications_template_updated` | Template modifié |
| `notifications_template_deleted` | Template supprimé |
| `notifications_rule_updated` | Règle modifiée |
| `notifications_rule_test` | Règle testée |
| `notifications_dispatched` | Notifications dispatchées |

---

## 9. Architecture technique

### 9.1 Fichiers

```
client/src/notifications/
├── types.ts                    # Types, enums, constantes, variables
├── localNotificationsStore.ts  # Store local (settings, templates, rules, logs, dispatcher)
└── index.ts                    # Exports

client/src/pages/
└── AdminNotificationsPage.tsx  # Page admin avec 5 onglets

client/src/admin/
└── permissions.ts              # Permissions RBAC (8 nouvelles)
```

### 9.2 Dispatcher

Le dispatcher (`localNotifDispatcher.dispatch`) est le point d'entrée pour envoyer des notifications depuis n'importe quel module :

```typescript
import { localNotifDispatcher } from '@/notifications';

localNotifDispatcher.dispatch('EXECUTION_FAILED', {
  app: { name: 'AgilesTest', base_url: '...' },
  actor: { name: 'Jean', email: 'jean@orange.ci' },
  project: { name: 'Orange-WEB', id: 'proj_001' },
  execution: { id: 'exec_789', scenario_id: 'sc_01', status: 'FAILED', trace_id: 'tr_abc' },
});
```

### 9.3 Intégration future

Pour connecter un provider réel :
1. Remplacer les appels stub dans `localNotificationsStore.ts` par des appels API
2. Utiliser les secrets configurés (Client ID, API Key, etc.)
3. Gérer les retries et les erreurs provider
4. Mettre à jour les Delivery Logs avec les réponses réelles

---

## 10. Checklist déploiement

- [ ] Configurer les secrets SMS Orange (Client ID, Client Secret) dans les variables d'environnement
- [ ] Configurer les identifiants SMTP dans les variables d'environnement
- [ ] Vérifier les templates système et les adapter si nécessaire
- [ ] Activer les règles pertinentes pour le pilote
- [ ] Tester l'envoi SMS et Email avec les boutons de test
- [ ] Vérifier les Delivery Logs après les premiers envois réels
- [ ] Configurer les destinataires personnalisés si nécessaire
