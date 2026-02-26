# AUTH.md — Authentification Serveur Persistante

> **Version** : v0.4.0  
> **Date** : 2026-02-26  
> **Auteur** : Manus AI  

---

## 1. Vue d'ensemble

AgilesTest utilise une **authentification serveur persistante** basée sur le protocole OAuth 2.0 de Manus. La session utilisateur est maintenue via un **cookie HTTPOnly sécurisé** (`app_session_id`) contenant un JWT signé. Aucun token n'est stocké dans localStorage.

Le flux complet se déroule en trois étapes :

1. **Redirection OAuth** : le frontend redirige vers le portail Manus OAuth
2. **Callback serveur** : `/api/oauth/callback` échange le code → crée un JWT → pose le cookie
3. **Vérification automatique** : chaque requête tRPC vérifie le cookie via `context.ts`

---

## 2. Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│  Manus OAuth     │────▶│  /api/oauth/    │
│  (React)     │     │  Portal          │     │  callback       │
│              │◀────│                  │◀────│  (Express)      │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                                            │
       │  Cookie: app_session_id (HTTPOnly)         │ JWT signé
       │                                            │ (jose)
       ▼                                            ▼
┌─────────────┐                              ┌─────────────────┐
│  tRPC Client │─── /api/trpc ──────────────▶│  tRPC Context   │
│  (httpBatch) │                              │  ctx.user       │
│  credentials │                              │  (authenticateReq)
│  : include   │                              └─────────────────┘
└─────────────┘
```

---

## 3. Flux OAuth Manus

Le flux OAuth est implémenté dans `server/_core/oauth.ts` et utilise le protocole Authorization Code.

### 3.1 Initiation (Frontend)

Le frontend redirige vers le portail Manus OAuth via `getLoginUrl()` défini dans `client/src/const.ts` :

```typescript
// client/src/const.ts
export function getLoginUrl(returnPath?: string): string {
  const state = encodeURIComponent(JSON.stringify({
    origin: window.location.origin,
    returnPath: returnPath || '/',
  }));
  return `${import.meta.env.VITE_OAUTH_PORTAL_URL}/login?app_id=${import.meta.env.VITE_APP_ID}&state=${state}`;
}
```

### 3.2 Callback (Serveur)

Après authentification réussie, Manus redirige vers `/api/oauth/callback` avec un `code` et un `state`. Le serveur :

1. Échange le code contre un profil utilisateur via l'API Manus
2. Crée ou met à jour l'utilisateur dans la base de données
3. Génère un JWT de session signé avec `JWT_SECRET`
4. Pose le cookie `app_session_id` (HTTPOnly, Secure, SameSite=Lax)
5. Redirige vers l'URL d'origine extraite du `state`

### 3.3 Vérification (Contexte tRPC)

À chaque requête tRPC, `server/_core/context.ts` :

1. Lit le cookie `app_session_id`
2. Vérifie et décode le JWT via `jose`
3. Résout l'utilisateur depuis la base de données
4. Injecte `ctx.user` (ou `null` si non authentifié)

---

## 4. Stockage de session

### 4.1 Cookie HTTPOnly

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `app_session_id` |
| **Type** | HTTPOnly (inaccessible au JavaScript) |
| **Secure** | `true` en production, `false` en dev |
| **SameSite** | `Lax` (protection CSRF native) |
| **Path** | `/` |
| **Contenu** | JWT signé (jose) |

### 4.2 JWT Session Token

Le JWT contient :

| Champ | Description |
|-------|-------------|
| `sub` | OpenID de l'utilisateur |
| `iat` | Timestamp de création |
| `exp` | Expiration (configurable) |

Le JWT est signé avec `JWT_SECRET` (variable d'environnement injectée par la plateforme).

### 4.3 Sécurité

- **Aucun token dans localStorage** : le cookie HTTPOnly empêche l'accès JavaScript
- **Protection CSRF** : `SameSite=Lax` bloque les requêtes cross-site POST
- **Pas de CORS credentials** : le tRPC client utilise `credentials: "include"` pour envoyer le cookie automatiquement
- **Redaction logs** : aucun token ou mot de passe n'est loggé dans les audit_logs

---

## 5. Endpoints tRPC Auth

### 5.1 `auth.me` (Query)

Retourne l'utilisateur courant avec les rôles RBAC résolus.

**Accès** : `publicProcedure` (retourne `null` si non authentifié)

**Réponse authentifiée** :

```typescript
{
  // Champs utilisateur
  id: string;
  openId: string;
  email: string;
  full_name: string;
  name: string;
  status: string;
  loginMethod: string | null;
  createdAt: string;  // ISO 8601
  updatedAt: string;
  lastSignedIn: string;
  
  // Champs RBAC
  role: AppRole;           // Rôle effectif (le plus élevé)
  appRoles: AppRole[];     // Tous les rôles assignés
  effectiveRole: AppRole;  // Alias de role
  permissions: string[];   // Permissions résolues (module.action)
  
  // Booleans de commodité
  isAdmin: boolean;        // effectiveRole === "ORG_ADMIN"
  canWrite: boolean;       // effectiveRole >= TEST_ENGINEER
  isActive: boolean;       // status === "ACTIVE"
}
```

**Réponse non authentifiée** : `null`

### 5.2 `auth.logout` (Mutation)

Invalide la session en supprimant le cookie.

**Accès** : `publicProcedure`

**Réponse** : `{ success: true }`

**Actions** :
1. Supprime le cookie `app_session_id` avec `maxAge: -1`
2. Le frontend nettoie les artéfacts localStorage résiduels
3. Redirige vers le portail OAuth

---

## 6. Frontend — AuthContext

Le `AuthContext` (`client/src/auth/AuthContext.tsx`) est un React Context qui encapsule `trpc.auth.me` et expose une interface compatible avec l'ancien système localStorage.

### 6.1 Interface

```typescript
interface AuthContextValue {
  user: CompatUser | null;      // Utilisateur courant (format frontend)
  isAuthenticated: boolean;      // true si user !== null
  isAdmin: boolean;              // effectiveRole === "ORG_ADMIN"
  canWrite: boolean;             // effectiveRole >= TEST_ENGINEER
  loading: boolean;              // Requête me() en cours
  error: Error | null;           // Erreur de requête
  login: (token, user) => void;  // @deprecated — redirige vers OAuth
  logout: () => void;            // Supprime session + redirige
  hasRole: (...roles) => boolean; // Vérifie les rôles frontend
  refresh: () => void;           // Force un refetch de me()
}
```

### 6.2 Mapping des rôles

Le mapping entre les rôles RBAC serveur et les rôles frontend est le suivant :

| Rôle RBAC Serveur | Rôle Frontend | isAdmin | canWrite |
|-------------------|---------------|---------|----------|
| `ORG_ADMIN` | `ADMIN` | `true` | `true` |
| `QA_MANAGER` | `MANAGER` | `false` | `true` |
| `TEST_ENGINEER` | `MANAGER` | `false` | `true` |
| `SECURITY_ANALYST` | `MANAGER` | `false` | `true` |
| `VIEWER` | `VIEWER` | `false` | `false` |

### 6.3 Cache et rafraîchissement

- **staleTime** : 30 secondes (les données sont considérées fraîches pendant 30s)
- **refetchOnWindowFocus** : `true` (rafraîchit quand l'onglet reprend le focus)
- **retry** : `false` (pas de retry automatique sur erreur 401)

---

## 7. Variables d'environnement

| Variable | Côté | Description |
|----------|------|-------------|
| `JWT_SECRET` | Serveur | Clé de signature JWT (injectée par la plateforme) |
| `OAUTH_SERVER_URL` | Serveur | URL de l'API OAuth Manus backend |
| `VITE_APP_ID` | Client | ID de l'application OAuth Manus |
| `VITE_OAUTH_PORTAL_URL` | Client | URL du portail de login Manus |

Ces variables sont **pré-configurées** par la plateforme Manus. Ne pas les modifier manuellement.

---

## 8. Migration depuis localStorage

### 8.1 Changements effectués

| Composant | Avant (localStorage) | Après (tRPC/Cookie) |
|-----------|---------------------|---------------------|
| **AuthContext** | `localStorage.getItem('access_token')` | `trpc.auth.me.useQuery()` |
| **LoginPage** | Formulaire email/password | Redirection OAuth Manus |
| **api/client.ts** | `Authorization: Bearer ${token}` | `withCredentials: true` (cookie auto) |
| **DashboardLayout** | `useAuth()` → localStorage | `useAuth()` → tRPC (même interface) |
| **RequireAuth** | `isAuthenticated` → localStorage | `isAuthenticated` → tRPC |

### 8.2 Artéfacts localStorage nettoyés

Au logout, les clés suivantes sont supprimées pour éviter les données stales :

- `access_token`
- `user`
- `agilestest_current_project`
- `manus-runtime-user-info`

### 8.3 Compatibilité

L'interface `useAuth()` est **100% rétro-compatible**. Les composants existants n'ont pas besoin de modifications. La seule différence est que :

- `login()` est maintenant un no-op (redirige vers OAuth)
- `logout()` appelle `trpc.auth.logout.mutateAsync()` puis redirige

---

## 9. Tests

### 9.1 Fichier de test

`server/auth.test.ts` — 14 tests couvrant :

| Test | Description |
|------|-------------|
| `auth.me returns null when not authenticated` | Vérifie le retour null sans cookie |
| `auth.me returns enriched user when authenticated` | Vérifie les champs utilisateur |
| `auth.me returns RBAC fields` | Vérifie appRoles, effectiveRole, permissions |
| `admin user has isAdmin=true` | Vérifie le mapping admin → ORG_ADMIN |
| `regular user has isAdmin=false` | Vérifie le mapping user → VIEWER |
| `returns proper date fields as ISO strings` | Vérifie le format des dates |
| `returns isActive based on user status` | Vérifie ACTIVE vs SUSPENDED |
| `auth.logout clears the session cookie` | Vérifie clearCookie appelé |
| `auth.logout works even when not authenticated` | Vérifie la robustesse |
| `auth.logout clears cookie with maxAge: -1` | Vérifie les options du cookie |
| `projects.create rejects unauthenticated` | Vérifie le rejet des mutations |
| `profiles.list works for authenticated users` | Vérifie l'accès authentifié |
| `no token in response body` | Vérifie qu'aucun secret n'est leaké |
| `auth.me is idempotent` | Vérifie la cohérence des appels multiples |

### 9.2 Exécution

```bash
pnpm test
# 77 tests passent (5 fichiers, 0 échec)
```

---

## 10. Diagramme de séquence

```
Utilisateur          Frontend              Serveur              Manus OAuth
    │                    │                    │                      │
    │  Clic "Se connecter"                    │                      │
    │───────────────────▶│                    │                      │
    │                    │  Redirect OAuth     │                      │
    │                    │───────────────────────────────────────────▶│
    │                    │                    │                      │
    │  Login sur portail Manus               │                      │
    │◀──────────────────────────────────────────────────────────────▶│
    │                    │                    │                      │
    │                    │  Callback + code    │                      │
    │                    │◀──────────────────────────────────────────│
    │                    │                    │                      │
    │                    │  /api/oauth/callback│                      │
    │                    │───────────────────▶│                      │
    │                    │                    │  Exchange code        │
    │                    │                    │─────────────────────▶│
    │                    │                    │  User profile         │
    │                    │                    │◀─────────────────────│
    │                    │                    │                      │
    │                    │  Set-Cookie: JWT    │                      │
    │                    │  Redirect to /      │                      │
    │                    │◀───────────────────│                      │
    │                    │                    │                      │
    │                    │  trpc.auth.me()     │                      │
    │                    │───────────────────▶│                      │
    │                    │  { user, roles }    │                      │
    │                    │◀───────────────────│                      │
    │                    │                    │                      │
    │  Dashboard affiché │                    │                      │
    │◀───────────────────│                    │                      │
```

---

## 11. Fichiers clés

| Fichier | Rôle |
|---------|------|
| `server/_core/oauth.ts` | Flux OAuth Manus (callback, exchange, state parsing) |
| `server/_core/context.ts` | Création du contexte tRPC (vérification cookie → ctx.user) |
| `server/_core/cookies.ts` | Options du cookie session (HTTPOnly, Secure, SameSite) |
| `server/_core/sdk.ts` | `authenticateRequest()` — vérifie et décode le JWT |
| `server/routers.ts` | `auth.me` et `auth.logout` enrichis avec RBAC |
| `client/src/auth/AuthContext.tsx` | AuthProvider basé sur tRPC (remplace localStorage) |
| `client/src/const.ts` | `getLoginUrl()` — URL de redirection OAuth |
| `client/src/pages/LoginPage.tsx` | Page de login (redirection OAuth) |
| `client/src/api/client.ts` | Client Axios avec `withCredentials: true` |
| `server/auth.test.ts` | 14 tests Vitest pour l'authentification |
