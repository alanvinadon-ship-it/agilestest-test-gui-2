# PROFILE_MODEL.md — Modèle de Profil de Test AgilesTest

> Version : 1.1 — Ajout du champ obligatoire `test_type`

---

## 1. Vue d'ensemble

Un **Profil de test** est l'unité de configuration fondamentale dans AgilesTest. Il définit :

1. **Le domaine** (`domain`) — le périmètre technologique du système sous test
2. **Le type de test** (`test_type`) — l'objectif de validation (VABF, VSR ou VABE)
3. **Le type de profil** (`profile_type`) — le protocole ou la technologie de test
4. **La configuration** (`config`) — les paramètres de connexion et d'exécution

Un Scénario **hérite** le `test_type` de son Profil. Une Exécution utilise le `test_type` pour proposer le **runner** approprié.

---

## 2. Champs du modèle

| Champ          | Type                                  | Obligatoire | Description                                           |
|----------------|---------------------------------------|-------------|-------------------------------------------------------|
| `id`           | `string (UUID)`                       | Auto        | Identifiant unique généré                             |
| `project_id`   | `string (UUID)`                       | Oui         | Projet parent                                         |
| `name`         | `string`                              | Oui         | Nom lisible du profil                                 |
| `description`  | `string`                              | Non         | Description optionnelle                               |
| `domain`       | `enum Domain`                         | Oui         | Domaine technologique                                 |
| `test_type`    | `enum TestType`                       | Oui         | Type de test (VABF, VSR, VABE)                        |
| `profile_type` | `enum ProfileType`                    | Oui         | Type de profil (protocole/techno)                     |
| `protocol`     | `string`                              | Oui         | Protocole (legacy, dérivé de profile_type)            |
| `config`       | `JSON`                                | Oui         | Configuration dynamique selon profile_type            |
| `created_at`   | `string (ISO 8601)`                   | Auto        | Date de création                                      |
| `updated_at`   | `string (ISO 8601)`                   | Auto        | Date de dernière modification                         |

---

## 3. Enums

### 3.1 Domain

```typescript
enum Domain {
  WEB           = 'WEB',
  API           = 'API',
  TELECOM_IMS   = 'TELECOM_IMS',
  TELECOM_5GC   = 'TELECOM_5GC',
  MOBILE        = 'MOBILE',
  IOT           = 'IOT',
  DESKTOP       = 'DESKTOP'
}
```

### 3.2 TestType

```typescript
enum TestType {
  VABF = 'VABF',   // Vérification d'Aptitude au Bon Fonctionnement
  VSR  = 'VSR',    // Vérification de Service Régulier
  VABE = 'VABE'    // Vérification d'Aptitude à la Bonne Exploitabilité
}
```

| TestType | Signification                              | Objectif                                                       |
|----------|--------------------------------------------|----------------------------------------------------------------|
| VABF     | Validation Fonctionnelle                   | Tests fonctionnels, cas nominaux, cas limites, non-régression  |
| VSR      | Validation Service / Résilience            | Tests de résilience, haute disponibilité, failover, recovery   |
| VABE     | Performance / Charge / Sécurité            | Tests de charge, performance, stress, sécurité                 |

### 3.3 ProfileType (par domaine)

| Domaine       | Types autorisés                                                    |
|---------------|---------------------------------------------------------------------|
| WEB           | UI_E2E, KEYWORD_DRIVEN, VISUAL_REGRESSION, ACCESSIBILITY           |
| API           | REST_API, SOAP_API, GRPC, GRAPHQL                                   |
| TELECOM_IMS   | SIP_ENDPOINT, DIAMETER_NODE, IMS_REGISTRATION, VOLTE_CALL          |
| TELECOM_5GC   | NRF_DISCOVERY, AMF_REGISTRATION, SMF_SESSION, UPF_DATAPATH         |
| MOBILE        | ANDROID_UI, IOS_UI, CROSS_PLATFORM                                  |
| IOT           | MQTT_DEVICE, COAP_ENDPOINT, LWMTM_DEVICE                           |
| DESKTOP       | WIN_UI, MACOS_UI, LINUX_UI                                          |

---

## 4. Filtrage par domaine du projet

Un projet a un domaine (`ProjectDomain`). Les domaines de profil autorisés dépendent du domaine du projet :

| ProjectDomain | Domaines de profil autorisés |
|---------------|------------------------------|
| WEB           | WEB, API                     |
| MOBILE        | MOBILE, API                  |
| DESKTOP       | DESKTOP, API                 |
| API           | API                          |
| TELECOM       | TELECOM_IMS, TELECOM_5GC, API |
| IOT           | IOT, API                     |

---

## 5. Mapping Runner par test_type + domain

Le runner proposé est déterminé par la combinaison `test_type` + `domain` :

| test_type | Domain        | Runner proposé                    |
|-----------|---------------|-----------------------------------|
| VABF      | WEB           | Playwright / Robot Framework      |
| VABF      | API           | Newman / REST Assured             |
| VABF      | TELECOM_IMS   | SIPp / SRTP Analyzer              |
| VABF      | TELECOM_5GC   | UERANSIM / Open5GS CLI           |
| VABF      | MOBILE        | Appium / Detox                    |
| VABF      | IOT           | MQTT Explorer / CoAP Client       |
| VABF      | DESKTOP       | WinAppDriver / PyAutoGUI          |
| VSR       | WEB           | Chaos Toolkit / Gremlin           |
| VSR       | API           | Toxiproxy / Chaos Monkey          |
| VSR       | TELECOM_*     | SIPp Stress / Diameter Overload   |
| VABE      | WEB           | k6 / Lighthouse CI                |
| VABE      | API           | k6 / JMeter / Newman              |
| VABE      | TELECOM_*     | SIPp Load / Diameter Bench        |
| VABE      | MOBILE        | Appium Perf / Firebase Perf       |

---

## 6. Règles fonctionnelles

### 6.1 Création

- `test_type` est **obligatoire** — une création sans `test_type` retourne une erreur 422
- Le wizard GUI suit 4 étapes : Domaine → Type de test → Type de profil → Configuration
- La configuration est dynamique selon le `profile_type` sélectionné

### 6.2 Modification

- `test_type` est **modifiable uniquement** si aucun scénario n'est attaché au profil
- Si des scénarios existent, la modification retourne une erreur 409 (Conflict)
- Les autres champs (name, description, config) restent modifiables

### 6.3 Héritage

- Un **Scénario** hérite le `test_type` de son Profil (read-only dans la GUI)
- Une **Exécution** utilise le `test_type` pour proposer le bon runner
- Le filtrage des scénarios peut se faire par `test_type` (via le profil parent)

### 6.4 Migration

- Les profils existants sans `test_type` reçoivent la valeur par défaut `'VABF'`
- Script de migration : `ALTER TABLE profiles ADD COLUMN test_type ENUM('VABF','VSR','VABE') NOT NULL DEFAULT 'VABF'`

---

## 7. Configuration dynamique (exemples)

### 7.1 REST API (VABE)

```json
{
  "base_url": "https://api.orange.ci/v2",
  "auth_type": "bearer_token",
  "auth_header": "Authorization",
  "timeout_ms": 10000,
  "verify_tls": true,
  "content_type": "JSON"
}
```

### 7.2 UI End-to-End (VABF)

```json
{
  "target_url": "https://orange.ci",
  "browser": "chromium",
  "viewport_width": 1920,
  "viewport_height": 1080,
  "headless": true,
  "timeout_ms": 30000,
  "screenshot_on_failure": true
}
```

### 7.3 SIP Endpoint (VSR)

```json
{
  "sip_server": "sip.orange.ci",
  "sip_port": 5060,
  "transport": "UDP",
  "realm": "orange.ci",
  "expires": 3600,
  "register_on_start": true
}
```

---

## 8. API Endpoints

| Méthode | Endpoint                          | Description                              |
|---------|-----------------------------------|------------------------------------------|
| POST    | `/profiles`                       | Créer un profil (test_type obligatoire)  |
| GET     | `/profiles`                       | Lister les profils (filtres: test_type, domain) |
| GET     | `/profiles/:id`                   | Détail d'un profil                       |
| PATCH   | `/profiles/:id`                   | Modifier (test_type si 0 scénarios)      |
| DELETE  | `/profiles/:id`                   | Supprimer un profil                      |

### Filtres disponibles

```
GET /profiles?test_type=VABF&domain=WEB
GET /profiles?test_type=VABE
GET /scenarios?test_type=VABF  (via join profile)
```

---

## 9. Validation Zod (Backend)

```typescript
const TestTypeEnum = z.enum(['VABF', 'VSR', 'VABE']);

const ProfileCreateInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  domain: DomainEnum,
  test_type: TestTypeEnum,           // OBLIGATOIRE
  profile_type: ProfileTypeEnum,
  config: z.record(z.unknown()),
});
```

---

## 10. Tests attendus

| Test                                          | Résultat attendu |
|-----------------------------------------------|------------------|
| POST /profiles sans test_type                 | 422              |
| POST /profiles avec test_type=VABF            | 201              |
| PATCH /profiles/:id test_type (0 scénarios)   | 200              |
| PATCH /profiles/:id test_type (N scénarios)   | 409              |
| GET /profiles?test_type=VABE                  | Liste filtrée    |
| GUI : wizard étape 2 affiche VABF/VSR/VABE    | OK               |
| GUI : badges test_type visibles dans liste     | OK               |
| GUI : filtre test_type fonctionne              | OK               |
| GUI : scénario hérite test_type (read-only)    | OK               |
