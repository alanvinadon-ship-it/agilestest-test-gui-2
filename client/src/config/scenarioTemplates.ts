/**
 * scenarioTemplates.ts — Catalogue de templates de scénarios par (domain, test_type, profile_type).
 *
 * Chaque template est un modèle de scénario générique, sans valeurs spécifiques au projet.
 * Le moteur de suggestion sélectionne et adapte ces templates selon le profil.
 *
 * Priorités :
 *   P0 = Bloquant (doit passer pour GO)
 *   P1 = Majeur (régression critique)
 *   P2 = Mineur (confort / edge case)
 */

import type { ProfileDomain, ProfileType } from './profileDomains';
import type { TestType } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type Priority = 'P0' | 'P1' | 'P2';
export type ScopeLevel = 'MINIMAL' | 'STANDARD' | 'FULL';

export interface StepOutline {
  action: string;
  description: string;
  expected_result: string;
}

export interface ScenarioTemplate {
  /** Identifiant unique du template (ex: WEB_VABF_E2E_LOGIN) */
  template_id: string;
  /** Titre humain */
  title: string;
  /** Priorité P0/P1/P2 */
  priority: Priority;
  /** Justification (1-2 phrases) */
  rationale: string;
  /** Étapes du scénario */
  steps_outline: StepOutline[];
  /** Résultats attendus globaux */
  expected_results_outline: string[];
  /** Inputs requis pour exécuter ce scénario */
  required_inputs: string[];
  /** Types de datasets nécessaires */
  required_datasets_types: string[];
  /** Tags pour filtrage */
  tags: string[];
  /** Scope minimum pour inclusion */
  min_scope: ScopeLevel;
  /** Domaines compatibles */
  domains: ProfileDomain[];
  /** Types de test compatibles */
  test_types: TestType[];
  /** Types de profil compatibles (vide = tous les types du domaine) */
  profile_types: ProfileType[];
}

// ─── WEB + VABF Templates ──────────────────────────────────────────────────

const WEB_VABF_TEMPLATES: ScenarioTemplate[] = [
  {
    template_id: 'WEB_VABF_LOGIN',
    title: 'Authentification utilisateur',
    priority: 'P0',
    rationale: 'Valide le flux de connexion principal. Bloquant car sans authentification aucun test fonctionnel n\'est possible.',
    steps_outline: [
      { action: 'NAVIGATE', description: 'Accéder à la page de connexion', expected_result: 'Formulaire de connexion affiché' },
      { action: 'INPUT', description: 'Saisir les identifiants valides', expected_result: 'Champs remplis sans erreur' },
      { action: 'CLICK', description: 'Soumettre le formulaire', expected_result: 'Redirection vers le dashboard' },
      { action: 'ASSERT', description: 'Vérifier la session active', expected_result: 'Nom utilisateur affiché, token JWT présent' },
    ],
    expected_results_outline: ['Connexion réussie en < 3s', 'Session persistante après refresh'],
    required_inputs: ['url_login', 'credentials_valid'],
    required_datasets_types: ['users'],
    tags: ['auth', 'login', 'smoke'],
    min_scope: 'MINIMAL',
    domains: ['WEB'],
    test_types: ['VABF'],
    profile_types: ['UI_E2E', 'UI_KEYWORD'],
  },
  {
    template_id: 'WEB_VABF_LOGIN_FAIL',
    title: 'Authentification — Identifiants invalides',
    priority: 'P1',
    rationale: 'Vérifie le comportement en cas d\'erreur d\'authentification. Important pour la sécurité et l\'UX.',
    steps_outline: [
      { action: 'NAVIGATE', description: 'Accéder à la page de connexion', expected_result: 'Formulaire affiché' },
      { action: 'INPUT', description: 'Saisir des identifiants invalides', expected_result: 'Champs remplis' },
      { action: 'CLICK', description: 'Soumettre le formulaire', expected_result: 'Message d\'erreur affiché' },
      { action: 'ASSERT', description: 'Vérifier l\'absence de session', expected_result: 'Pas de token, reste sur la page login' },
    ],
    expected_results_outline: ['Message d\'erreur explicite', 'Pas de fuite d\'information'],
    required_inputs: ['url_login', 'credentials_invalid'],
    required_datasets_types: ['users'],
    tags: ['auth', 'security', 'negative'],
    min_scope: 'STANDARD',
    domains: ['WEB'],
    test_types: ['VABF'],
    profile_types: ['UI_E2E', 'UI_KEYWORD'],
  },
  {
    template_id: 'WEB_VABF_NAVIGATION',
    title: 'Navigation principale',
    priority: 'P0',
    rationale: 'Valide que toutes les pages principales sont accessibles et que le menu fonctionne correctement.',
    steps_outline: [
      { action: 'NAVIGATE', description: 'Accéder à la page d\'accueil', expected_result: 'Page d\'accueil chargée' },
      { action: 'CLICK', description: 'Parcourir chaque lien du menu principal', expected_result: 'Chaque page se charge sans erreur' },
      { action: 'ASSERT', description: 'Vérifier les titres de page', expected_result: 'Titres cohérents avec le menu' },
      { action: 'ASSERT', description: 'Vérifier l\'absence d\'erreurs console', expected_result: 'Aucune erreur JS critique' },
    ],
    expected_results_outline: ['Toutes les pages accessibles', 'Temps de chargement < 5s par page'],
    required_inputs: ['url_home'],
    required_datasets_types: [],
    tags: ['navigation', 'smoke', 'ui'],
    min_scope: 'MINIMAL',
    domains: ['WEB'],
    test_types: ['VABF'],
    profile_types: ['UI_E2E', 'UI_KEYWORD'],
  },
  {
    template_id: 'WEB_VABF_FORM_SUBMIT',
    title: 'Soumission de formulaire principal',
    priority: 'P0',
    rationale: 'Valide le flux métier principal de soumission de données. Critique pour l\'acceptance fonctionnelle.',
    steps_outline: [
      { action: 'NAVIGATE', description: 'Accéder au formulaire principal', expected_result: 'Formulaire affiché avec tous les champs' },
      { action: 'INPUT', description: 'Remplir tous les champs obligatoires', expected_result: 'Champs validés (pas de bordure rouge)' },
      { action: 'CLICK', description: 'Soumettre le formulaire', expected_result: 'Message de succès affiché' },
      { action: 'ASSERT', description: 'Vérifier la persistance des données', expected_result: 'Données visibles dans la liste/détail' },
    ],
    expected_results_outline: ['Données sauvegardées correctement', 'Confirmation visuelle claire'],
    required_inputs: ['url_form', 'form_data_valid'],
    required_datasets_types: ['form_data'],
    tags: ['form', 'crud', 'functional'],
    min_scope: 'MINIMAL',
    domains: ['WEB'],
    test_types: ['VABF'],
    profile_types: ['UI_E2E', 'UI_KEYWORD'],
  },
  {
    template_id: 'WEB_VABF_FORM_VALIDATION',
    title: 'Validation de formulaire — Champs obligatoires',
    priority: 'P1',
    rationale: 'Vérifie que les validations côté client empêchent la soumission de données incomplètes.',
    steps_outline: [
      { action: 'NAVIGATE', description: 'Accéder au formulaire', expected_result: 'Formulaire affiché' },
      { action: 'CLICK', description: 'Soumettre le formulaire vide', expected_result: 'Messages de validation affichés' },
      { action: 'ASSERT', description: 'Vérifier les messages d\'erreur', expected_result: 'Chaque champ requis a un message' },
      { action: 'INPUT', description: 'Corriger les erreurs une par une', expected_result: 'Messages disparaissent au fur et à mesure' },
    ],
    expected_results_outline: ['Validation côté client fonctionnelle', 'Messages d\'erreur clairs et localisés'],
    required_inputs: ['url_form'],
    required_datasets_types: [],
    tags: ['form', 'validation', 'ux'],
    min_scope: 'STANDARD',
    domains: ['WEB'],
    test_types: ['VABF'],
    profile_types: ['UI_E2E', 'UI_KEYWORD'],
  },
  {
    template_id: 'WEB_VABF_SEARCH',
    title: 'Recherche et filtrage',
    priority: 'P1',
    rationale: 'Valide la fonctionnalité de recherche qui est essentielle pour l\'utilisabilité de l\'application.',
    steps_outline: [
      { action: 'NAVIGATE', description: 'Accéder à la page avec recherche', expected_result: 'Barre de recherche visible' },
      { action: 'INPUT', description: 'Saisir un terme de recherche connu', expected_result: 'Résultats filtrés en temps réel' },
      { action: 'ASSERT', description: 'Vérifier la pertinence des résultats', expected_result: 'Résultats contiennent le terme recherché' },
      { action: 'INPUT', description: 'Rechercher un terme inexistant', expected_result: 'Message "Aucun résultat" affiché' },
    ],
    expected_results_outline: ['Recherche fonctionnelle et pertinente', 'État vide géré correctement'],
    required_inputs: ['url_search', 'search_terms'],
    required_datasets_types: ['search_data'],
    tags: ['search', 'filter', 'functional'],
    min_scope: 'STANDARD',
    domains: ['WEB'],
    test_types: ['VABF'],
    profile_types: ['UI_E2E', 'UI_KEYWORD'],
  },
  {
    template_id: 'WEB_VABF_RESPONSIVE',
    title: 'Responsive design — Mobile',
    priority: 'P2',
    rationale: 'Vérifie l\'adaptation de l\'interface aux écrans mobiles pour garantir l\'accessibilité multi-device.',
    steps_outline: [
      { action: 'NAVIGATE', description: 'Accéder à l\'application en viewport mobile', expected_result: 'Page adaptée au format mobile' },
      { action: 'ASSERT', description: 'Vérifier le menu hamburger', expected_result: 'Menu hamburger fonctionnel' },
      { action: 'ASSERT', description: 'Vérifier l\'absence de scroll horizontal', expected_result: 'Pas de débordement horizontal' },
      { action: 'CLICK', description: 'Naviguer via le menu mobile', expected_result: 'Navigation fluide entre les pages' },
    ],
    expected_results_outline: ['Interface utilisable sur mobile', 'Pas de contenu tronqué'],
    required_inputs: ['url_home'],
    required_datasets_types: [],
    tags: ['responsive', 'mobile', 'ux'],
    min_scope: 'FULL',
    domains: ['WEB'],
    test_types: ['VABF'],
    profile_types: ['UI_E2E', 'VISUAL_CHECK'],
  },
  {
    template_id: 'WEB_VABF_LOGOUT',
    title: 'Déconnexion',
    priority: 'P1',
    rationale: 'Valide la destruction de session et la protection contre l\'accès non autorisé après déconnexion.',
    steps_outline: [
      { action: 'NAVIGATE', description: 'Se connecter à l\'application', expected_result: 'Session active' },
      { action: 'CLICK', description: 'Cliquer sur Déconnexion', expected_result: 'Redirection vers la page de login' },
      { action: 'NAVIGATE', description: 'Tenter d\'accéder à une page protégée', expected_result: 'Redirection vers login (401/403)' },
      { action: 'ASSERT', description: 'Vérifier la suppression du token', expected_result: 'Aucun token en localStorage/cookie' },
    ],
    expected_results_outline: ['Session détruite côté client et serveur', 'Accès protégé après déconnexion'],
    required_inputs: ['url_login', 'credentials_valid'],
    required_datasets_types: ['users'],
    tags: ['auth', 'logout', 'security'],
    min_scope: 'STANDARD',
    domains: ['WEB'],
    test_types: ['VABF'],
    profile_types: ['UI_E2E', 'UI_KEYWORD'],
  },
];

// ─── WEB + VSR Templates ───────────────────────────────────────────────────

const WEB_VSR_TEMPLATES: ScenarioTemplate[] = [
  {
    template_id: 'WEB_VSR_FAILOVER',
    title: 'Résilience — Coupure backend',
    priority: 'P0',
    rationale: 'Vérifie le comportement de l\'application lorsque le backend est indisponible. Critique pour la continuité de service.',
    steps_outline: [
      { action: 'NAVIGATE', description: 'Accéder à l\'application (backend actif)', expected_result: 'Application fonctionnelle' },
      { action: 'SIMULATE', description: 'Couper le backend (kill/stop)', expected_result: 'Timeout détecté' },
      { action: 'ASSERT', description: 'Vérifier le message d\'erreur gracieux', expected_result: 'Message utilisateur clair, pas de stack trace' },
      { action: 'SIMULATE', description: 'Rétablir le backend', expected_result: 'Application se reconnecte automatiquement' },
    ],
    expected_results_outline: ['Dégradation gracieuse', 'Reprise automatique après rétablissement'],
    required_inputs: ['url_app', 'backend_control_endpoint'],
    required_datasets_types: [],
    tags: ['resilience', 'failover', 'availability'],
    min_scope: 'MINIMAL',
    domains: ['WEB'],
    test_types: ['VSR'],
    profile_types: ['UI_E2E'],
  },
  {
    template_id: 'WEB_VSR_TIMEOUT',
    title: 'Résilience — Latence réseau élevée',
    priority: 'P1',
    rationale: 'Simule une latence réseau élevée pour vérifier les timeouts et l\'expérience utilisateur dégradée.',
    steps_outline: [
      { action: 'CONFIGURE', description: 'Activer la simulation de latence (3s+)', expected_result: 'Throttling réseau actif' },
      { action: 'NAVIGATE', description: 'Charger la page principale', expected_result: 'Spinner/skeleton affiché' },
      { action: 'ASSERT', description: 'Vérifier le timeout gracieux', expected_result: 'Message de retry ou fallback affiché' },
      { action: 'ASSERT', description: 'Vérifier l\'absence de freeze UI', expected_result: 'Interface reste interactive' },
    ],
    expected_results_outline: ['Indicateurs de chargement visibles', 'Pas de gel de l\'interface'],
    required_inputs: ['url_app', 'latency_ms'],
    required_datasets_types: [],
    tags: ['resilience', 'latency', 'timeout'],
    min_scope: 'STANDARD',
    domains: ['WEB'],
    test_types: ['VSR'],
    profile_types: ['UI_E2E'],
  },
  {
    template_id: 'WEB_VSR_SESSION_EXPIRY',
    title: 'Résilience — Expiration de session',
    priority: 'P1',
    rationale: 'Vérifie le comportement quand le token JWT expire pendant l\'utilisation active.',
    steps_outline: [
      { action: 'NAVIGATE', description: 'Se connecter à l\'application', expected_result: 'Session active' },
      { action: 'SIMULATE', description: 'Forcer l\'expiration du token', expected_result: 'Token expiré' },
      { action: 'CLICK', description: 'Effectuer une action nécessitant l\'auth', expected_result: 'Redirection vers login ou refresh token' },
      { action: 'ASSERT', description: 'Vérifier la non-perte de données', expected_result: 'Formulaire en cours préservé si possible' },
    ],
    expected_results_outline: ['Redirection propre vers login', 'Pas de perte de données utilisateur'],
    required_inputs: ['url_app', 'credentials_valid'],
    required_datasets_types: ['users'],
    tags: ['resilience', 'session', 'auth'],
    min_scope: 'STANDARD',
    domains: ['WEB'],
    test_types: ['VSR'],
    profile_types: ['UI_E2E'],
  },
];

// ─── WEB + VABE Templates ──────────────────────────────────────────────────

const WEB_VABE_TEMPLATES: ScenarioTemplate[] = [
  {
    template_id: 'WEB_VABE_PAGE_LOAD',
    title: 'Performance — Temps de chargement des pages',
    priority: 'P0',
    rationale: 'Mesure les temps de chargement des pages principales. Critique pour l\'expérience utilisateur et le SEO.',
    steps_outline: [
      { action: 'MEASURE', description: 'Charger la page d\'accueil', expected_result: 'LCP < 2.5s, FCP < 1.8s' },
      { action: 'MEASURE', description: 'Charger la page la plus lourde', expected_result: 'TTI < 5s' },
      { action: 'ASSERT', description: 'Vérifier les Core Web Vitals', expected_result: 'CLS < 0.1, INP < 200ms' },
    ],
    expected_results_outline: ['Core Web Vitals dans les seuils Google', 'Pas de régression de performance'],
    required_inputs: ['url_pages[]'],
    required_datasets_types: [],
    tags: ['performance', 'web-vitals', 'load-time'],
    min_scope: 'MINIMAL',
    domains: ['WEB'],
    test_types: ['VABE'],
    profile_types: ['UI_E2E', 'VISUAL_CHECK'],
  },
];

// ─── API + VABF Templates ──────────────────────────────────────────────────

const API_VABF_TEMPLATES: ScenarioTemplate[] = [
  {
    template_id: 'API_VABF_HEALTH',
    title: 'Health check API',
    priority: 'P0',
    rationale: 'Vérifie que l\'API est accessible et répond correctement. Premier test à exécuter avant tout autre.',
    steps_outline: [
      { action: 'GET', description: 'Appeler GET /health ou /status', expected_result: '200 OK avec body valide' },
      { action: 'ASSERT', description: 'Vérifier le format de réponse', expected_result: 'JSON valide, status: "ok"' },
      { action: 'ASSERT', description: 'Vérifier le temps de réponse', expected_result: '< 500ms' },
    ],
    expected_results_outline: ['API accessible', 'Réponse conforme au contrat'],
    required_inputs: ['base_url'],
    required_datasets_types: [],
    tags: ['health', 'smoke', 'api'],
    min_scope: 'MINIMAL',
    domains: ['API'],
    test_types: ['VABF'],
    profile_types: ['REST', 'GRPC'],
  },
  {
    template_id: 'API_VABF_AUTH',
    title: 'Authentification API',
    priority: 'P0',
    rationale: 'Valide le mécanisme d\'authentification de l\'API. Bloquant car tous les endpoints protégés en dépendent.',
    steps_outline: [
      { action: 'POST', description: 'Appeler POST /auth/login avec credentials valides', expected_result: '200 OK + token JWT' },
      { action: 'GET', description: 'Appeler un endpoint protégé avec le token', expected_result: '200 OK' },
      { action: 'GET', description: 'Appeler sans token', expected_result: '401 Unauthorized' },
      { action: 'GET', description: 'Appeler avec token expiré/invalide', expected_result: '401 Unauthorized' },
    ],
    expected_results_outline: ['Auth fonctionne avec credentials valides', 'Rejet correct des requêtes non authentifiées'],
    required_inputs: ['base_url', 'credentials_valid', 'credentials_invalid'],
    required_datasets_types: ['users'],
    tags: ['auth', 'security', 'api'],
    min_scope: 'MINIMAL',
    domains: ['API'],
    test_types: ['VABF'],
    profile_types: ['REST'],
  },
  {
    template_id: 'API_VABF_CRUD',
    title: 'CRUD complet — Ressource principale',
    priority: 'P0',
    rationale: 'Valide le cycle de vie complet d\'une ressource (Create, Read, Update, Delete). Fondamental pour l\'acceptance.',
    steps_outline: [
      { action: 'POST', description: 'Créer une ressource', expected_result: '201 Created + body avec id' },
      { action: 'GET', description: 'Lire la ressource créée', expected_result: '200 OK + données cohérentes' },
      { action: 'PATCH', description: 'Mettre à jour la ressource', expected_result: '200 OK + champs modifiés' },
      { action: 'DELETE', description: 'Supprimer la ressource', expected_result: '204 No Content' },
      { action: 'GET', description: 'Vérifier la suppression', expected_result: '404 Not Found' },
    ],
    expected_results_outline: ['Cycle CRUD complet sans erreur', 'Codes HTTP conformes à REST'],
    required_inputs: ['base_url', 'resource_endpoint', 'resource_payload'],
    required_datasets_types: ['resource_data'],
    tags: ['crud', 'rest', 'functional'],
    min_scope: 'MINIMAL',
    domains: ['API'],
    test_types: ['VABF'],
    profile_types: ['REST'],
  },
  {
    template_id: 'API_VABF_PAGINATION',
    title: 'Pagination et filtrage',
    priority: 'P1',
    rationale: 'Vérifie que la pagination et les filtres fonctionnent correctement pour les listes de ressources.',
    steps_outline: [
      { action: 'GET', description: 'Lister avec pagination (page=1, limit=10)', expected_result: '200 OK + 10 items max + metadata pagination' },
      { action: 'GET', description: 'Lister page 2', expected_result: 'Items différents de page 1' },
      { action: 'GET', description: 'Filtrer par critère', expected_result: 'Résultats filtrés correctement' },
      { action: 'ASSERT', description: 'Vérifier total count', expected_result: 'Total cohérent avec les filtres' },
    ],
    expected_results_outline: ['Pagination fonctionnelle', 'Filtres appliqués correctement'],
    required_inputs: ['base_url', 'resource_endpoint'],
    required_datasets_types: ['resource_data'],
    tags: ['pagination', 'filter', 'api'],
    min_scope: 'STANDARD',
    domains: ['API'],
    test_types: ['VABF'],
    profile_types: ['REST'],
  },
  {
    template_id: 'API_VABF_VALIDATION',
    title: 'Validation des entrées API',
    priority: 'P1',
    rationale: 'Vérifie que l\'API rejette correctement les données invalides avec des messages d\'erreur explicites.',
    steps_outline: [
      { action: 'POST', description: 'Envoyer un body vide', expected_result: '422 Unprocessable Entity' },
      { action: 'POST', description: 'Envoyer des types invalides', expected_result: '422 avec détails des erreurs' },
      { action: 'POST', description: 'Envoyer des valeurs hors limites', expected_result: '422 avec message explicite' },
      { action: 'ASSERT', description: 'Vérifier le format d\'erreur', expected_result: 'Format d\'erreur standardisé (RFC 7807 ou custom)' },
    ],
    expected_results_outline: ['Validation stricte des entrées', 'Messages d\'erreur exploitables'],
    required_inputs: ['base_url', 'resource_endpoint'],
    required_datasets_types: ['invalid_data'],
    tags: ['validation', 'security', 'api'],
    min_scope: 'STANDARD',
    domains: ['API'],
    test_types: ['VABF'],
    profile_types: ['REST', 'SOAP', 'GRPC'],
  },
  {
    template_id: 'API_VABF_ERROR_CODES',
    title: 'Codes d\'erreur HTTP',
    priority: 'P2',
    rationale: 'Vérifie la conformité des codes d\'erreur HTTP pour les cas limites (404, 409, 429, 500).',
    steps_outline: [
      { action: 'GET', description: 'Accéder à une ressource inexistante', expected_result: '404 Not Found' },
      { action: 'POST', description: 'Créer un doublon (conflit)', expected_result: '409 Conflict' },
      { action: 'ASSERT', description: 'Vérifier les headers de réponse', expected_result: 'Content-Type correct, CORS headers présents' },
    ],
    expected_results_outline: ['Codes HTTP conformes aux standards REST', 'Headers de réponse corrects'],
    required_inputs: ['base_url', 'resource_endpoint'],
    required_datasets_types: [],
    tags: ['error-handling', 'http', 'api'],
    min_scope: 'FULL',
    domains: ['API'],
    test_types: ['VABF'],
    profile_types: ['REST'],
  },
];

// ─── API + VABE Templates ──────────────────────────────────────────────────

const API_VABE_TEMPLATES: ScenarioTemplate[] = [
  {
    template_id: 'API_VABE_LOAD_BASELINE',
    title: 'Charge — Baseline performance',
    priority: 'P0',
    rationale: 'Établit la baseline de performance sous charge nominale. Référence pour détecter les régressions.',
    steps_outline: [
      { action: 'CONFIGURE', description: 'Configurer k6/JMeter : 50 VUs, 5 min', expected_result: 'Script de charge prêt' },
      { action: 'EXECUTE', description: 'Lancer le test de charge', expected_result: 'Exécution complète sans erreur' },
      { action: 'ASSERT', description: 'Vérifier p95 < 500ms', expected_result: 'Latence p95 dans les seuils' },
      { action: 'ASSERT', description: 'Vérifier taux d\'erreur < 1%', expected_result: 'Error rate acceptable' },
    ],
    expected_results_outline: ['Baseline établie', 'Métriques p50/p95/p99 documentées'],
    required_inputs: ['base_url', 'target_endpoint', 'vus', 'duration'],
    required_datasets_types: ['load_test_data'],
    tags: ['performance', 'load', 'baseline'],
    min_scope: 'MINIMAL',
    domains: ['API'],
    test_types: ['VABE'],
    profile_types: ['REST', 'GRPC'],
  },
  {
    template_id: 'API_VABE_STRESS',
    title: 'Charge — Stress test (montée en charge)',
    priority: 'P1',
    rationale: 'Identifie le point de rupture de l\'API sous charge croissante pour dimensionner l\'infrastructure.',
    steps_outline: [
      { action: 'CONFIGURE', description: 'Configurer rampe : 10→200 VUs sur 10 min', expected_result: 'Script de stress prêt' },
      { action: 'EXECUTE', description: 'Lancer le stress test', expected_result: 'Exécution complète' },
      { action: 'ASSERT', description: 'Identifier le point de rupture', expected_result: 'Seuil VUs max identifié' },
      { action: 'ASSERT', description: 'Vérifier la récupération', expected_result: 'API se stabilise après réduction de charge' },
    ],
    expected_results_outline: ['Point de rupture documenté', 'Comportement de dégradation gracieuse vérifié'],
    required_inputs: ['base_url', 'target_endpoint', 'max_vus', 'ramp_duration'],
    required_datasets_types: ['load_test_data'],
    tags: ['performance', 'stress', 'scalability'],
    min_scope: 'STANDARD',
    domains: ['API'],
    test_types: ['VABE'],
    profile_types: ['REST', 'GRPC'],
  },
  {
    template_id: 'API_VABE_ENDURANCE',
    title: 'Charge — Endurance (soak test)',
    priority: 'P2',
    rationale: 'Détecte les fuites mémoire et la dégradation progressive sous charge constante prolongée.',
    steps_outline: [
      { action: 'CONFIGURE', description: 'Configurer : 30 VUs, 30 min', expected_result: 'Script d\'endurance prêt' },
      { action: 'EXECUTE', description: 'Lancer le soak test', expected_result: 'Exécution complète' },
      { action: 'ASSERT', description: 'Vérifier la stabilité des temps de réponse', expected_result: 'Pas de dégradation > 20% sur la durée' },
      { action: 'ASSERT', description: 'Vérifier l\'absence de fuite mémoire', expected_result: 'Consommation mémoire stable' },
    ],
    expected_results_outline: ['Pas de fuite mémoire détectée', 'Performance stable sur la durée'],
    required_inputs: ['base_url', 'target_endpoint', 'vus', 'duration'],
    required_datasets_types: ['load_test_data'],
    tags: ['performance', 'endurance', 'soak'],
    min_scope: 'FULL',
    domains: ['API'],
    test_types: ['VABE'],
    profile_types: ['REST', 'GRPC'],
  },
];

// ─── API + VSR Templates ───────────────────────────────────────────────────

const API_VSR_TEMPLATES: ScenarioTemplate[] = [
  {
    template_id: 'API_VSR_CIRCUIT_BREAKER',
    title: 'Résilience — Circuit breaker',
    priority: 'P0',
    rationale: 'Vérifie que le circuit breaker protège l\'API contre les cascades de pannes.',
    steps_outline: [
      { action: 'SIMULATE', description: 'Rendre un service dépendant indisponible', expected_result: 'Service down' },
      { action: 'GET', description: 'Appeler l\'endpoint dépendant', expected_result: 'Réponse dégradée (fallback) ou 503' },
      { action: 'ASSERT', description: 'Vérifier que le circuit s\'ouvre', expected_result: 'Requêtes suivantes rapides (pas de timeout)' },
      { action: 'SIMULATE', description: 'Rétablir le service', expected_result: 'Circuit se referme progressivement' },
    ],
    expected_results_outline: ['Circuit breaker fonctionnel', 'Pas de cascade de pannes'],
    required_inputs: ['base_url', 'dependency_control'],
    required_datasets_types: [],
    tags: ['resilience', 'circuit-breaker', 'availability'],
    min_scope: 'MINIMAL',
    domains: ['API'],
    test_types: ['VSR'],
    profile_types: ['REST', 'GRPC'],
  },
  {
    template_id: 'API_VSR_RETRY',
    title: 'Résilience — Retry et backoff',
    priority: 'P1',
    rationale: 'Vérifie la politique de retry avec backoff exponentiel pour les erreurs transitoires.',
    steps_outline: [
      { action: 'SIMULATE', description: 'Configurer des erreurs 503 intermittentes', expected_result: 'Erreurs simulées' },
      { action: 'GET', description: 'Appeler l\'endpoint', expected_result: 'Retry automatique avec succès' },
      { action: 'ASSERT', description: 'Vérifier le backoff exponentiel', expected_result: 'Délai croissant entre retries' },
      { action: 'ASSERT', description: 'Vérifier le max retries', expected_result: 'Abandon après N tentatives' },
    ],
    expected_results_outline: ['Retry avec backoff fonctionnel', 'Pas de retry storm'],
    required_inputs: ['base_url', 'target_endpoint'],
    required_datasets_types: [],
    tags: ['resilience', 'retry', 'backoff'],
    min_scope: 'STANDARD',
    domains: ['API'],
    test_types: ['VSR'],
    profile_types: ['REST', 'GRPC'],
  },
];

// ─── TELECOM IMS Templates ─────────────────────────────────────────────────

const TELECOM_IMS_VABF_TEMPLATES: ScenarioTemplate[] = [
  {
    template_id: 'IMS_VABF_REGISTER',
    title: 'Enregistrement IMS (REGISTER)',
    priority: 'P0',
    rationale: 'Valide l\'enregistrement SIP sur le P-CSCF. Prérequis pour tout service IMS.',
    steps_outline: [
      { action: 'SIP_SEND', description: 'Envoyer REGISTER vers P-CSCF', expected_result: '401 Unauthorized (challenge)' },
      { action: 'SIP_SEND', description: 'Répondre au challenge (AKA/Digest)', expected_result: '200 OK' },
      { action: 'ASSERT', description: 'Vérifier le Contact header', expected_result: 'Binding enregistré avec expires' },
      { action: 'SIP_SEND', description: 'Envoyer REGISTER avec expires=0', expected_result: '200 OK (désenregistrement)' },
    ],
    expected_results_outline: ['Enregistrement réussi', 'Désenregistrement propre'],
    required_inputs: ['pcscf_host', 'pcscf_port', 'impu', 'impi', 'password'],
    required_datasets_types: ['subscribers'],
    tags: ['ims', 'sip', 'register'],
    min_scope: 'MINIMAL',
    domains: ['TELECOM_IMS'],
    test_types: ['VABF'],
    profile_types: ['SIP', 'IMS_REG'],
  },
  {
    template_id: 'IMS_VABF_CALL',
    title: 'Appel VoLTE basique (INVITE → BYE)',
    priority: 'P0',
    rationale: 'Valide le flux d\'appel complet VoLTE. Test fondamental pour la validation IMS.',
    steps_outline: [
      { action: 'SIP_SEND', description: 'Enregistrer l\'appelant (A)', expected_result: '200 OK REGISTER' },
      { action: 'SIP_SEND', description: 'Enregistrer l\'appelé (B)', expected_result: '200 OK REGISTER' },
      { action: 'SIP_SEND', description: 'A envoie INVITE vers B', expected_result: '100 Trying, 180 Ringing' },
      { action: 'SIP_SEND', description: 'B répond 200 OK', expected_result: 'Session établie (SDP négocié)' },
      { action: 'WAIT', description: 'Maintenir l\'appel 10s', expected_result: 'RTP bidirectionnel stable' },
      { action: 'SIP_SEND', description: 'A envoie BYE', expected_result: '200 OK BYE' },
    ],
    expected_results_outline: ['Appel établi et raccroché proprement', 'SDP négocié correctement'],
    required_inputs: ['pcscf_host', 'caller_uri', 'callee_uri', 'codec'],
    required_datasets_types: ['subscribers'],
    tags: ['ims', 'volte', 'call', 'invite'],
    min_scope: 'MINIMAL',
    domains: ['TELECOM_IMS'],
    test_types: ['VABF'],
    profile_types: ['IMS_CALL', 'SIP'],
  },
];

// ─── TELECOM 5GC Templates ─────────────────────────────────────────────────

const TELECOM_5GC_VABF_TEMPLATES: ScenarioTemplate[] = [
  {
    template_id: '5GC_VABF_REGISTRATION',
    title: 'Enregistrement 5G (Registration)',
    priority: 'P0',
    rationale: 'Valide la procédure d\'enregistrement 5G auprès de l\'AMF. Prérequis pour tout service 5G.',
    steps_outline: [
      { action: 'NAS_SEND', description: 'Envoyer Registration Request', expected_result: 'Authentication Request reçu' },
      { action: 'NAS_SEND', description: 'Répondre Authentication Response', expected_result: 'Security Mode Command reçu' },
      { action: 'NAS_SEND', description: 'Répondre Security Mode Complete', expected_result: 'Registration Accept reçu' },
      { action: 'ASSERT', description: 'Vérifier le 5G-GUTI assigné', expected_result: 'GUTI valide dans le message' },
    ],
    expected_results_outline: ['Enregistrement 5G réussi', '5G-GUTI assigné'],
    required_inputs: ['amf_host', 'supi', 'plmn'],
    required_datasets_types: ['subscribers_5g'],
    tags: ['5gc', 'registration', 'amf'],
    min_scope: 'MINIMAL',
    domains: ['TELECOM_5GC'],
    test_types: ['VABF'],
    profile_types: ['REGISTRATION'],
  },
  {
    template_id: '5GC_VABF_PDU_SESSION',
    title: 'Établissement PDU Session',
    priority: 'P0',
    rationale: 'Valide l\'établissement d\'une session de données 5G. Essentiel pour la connectivité data.',
    steps_outline: [
      { action: 'NAS_SEND', description: 'Envoyer PDU Session Establishment Request', expected_result: 'PDU Session Establishment Accept' },
      { action: 'ASSERT', description: 'Vérifier l\'adresse IP assignée', expected_result: 'IP valide dans le message' },
      { action: 'ASSERT', description: 'Vérifier le QoS Flow', expected_result: 'QFI et règles QoS conformes' },
      { action: 'DATA', description: 'Envoyer un ping via la session', expected_result: 'Réponse ICMP reçue' },
    ],
    expected_results_outline: ['Session PDU établie', 'Connectivité data fonctionnelle'],
    required_inputs: ['smf_host', 'dnn', 'sst', 'sd'],
    required_datasets_types: ['subscribers_5g'],
    tags: ['5gc', 'pdu-session', 'smf', 'data'],
    min_scope: 'MINIMAL',
    domains: ['TELECOM_5GC'],
    test_types: ['VABF'],
    profile_types: ['PDU_SESSION'],
  },
];

// ─── TELECOM EPC Templates ─────────────────────────────────────────────────

const TELECOM_EPC_VABF_TEMPLATES: ScenarioTemplate[] = [
  {
    template_id: 'EPC_VABF_ATTACH',
    title: 'Attach EPC (Initial Attach)',
    priority: 'P0',
    rationale: 'Valide la procédure d\'attachement au réseau EPC. Prérequis pour tout service 4G.',
    steps_outline: [
      { action: 'S1AP_SEND', description: 'Envoyer Initial UE Message (Attach Request)', expected_result: 'Authentication Request reçu' },
      { action: 'S1AP_SEND', description: 'Répondre Authentication Response', expected_result: 'Security Mode Command reçu' },
      { action: 'S1AP_SEND', description: 'Répondre Security Mode Complete', expected_result: 'Attach Accept reçu' },
      { action: 'ASSERT', description: 'Vérifier le GUTI et l\'APN', expected_result: 'GUTI assigné, bearer par défaut créé' },
    ],
    expected_results_outline: ['Attach réussi', 'Bearer par défaut établi'],
    required_inputs: ['mme_host', 'imsi', 'apn'],
    required_datasets_types: ['subscribers_4g'],
    tags: ['epc', 'attach', 'mme', '4g'],
    min_scope: 'MINIMAL',
    domains: ['TELECOM_EPC'],
    test_types: ['VABF'],
    profile_types: ['ATTACH'],
  },
];

// ─── MOBILE Templates ──────────────────────────────────────────────────────

const MOBILE_VABF_TEMPLATES: ScenarioTemplate[] = [
  {
    template_id: 'MOBILE_VABF_LAUNCH',
    title: 'Lancement de l\'application',
    priority: 'P0',
    rationale: 'Vérifie que l\'application se lance correctement et affiche l\'écran principal.',
    steps_outline: [
      { action: 'LAUNCH', description: 'Lancer l\'application', expected_result: 'Splash screen puis écran principal' },
      { action: 'ASSERT', description: 'Vérifier le temps de démarrage', expected_result: 'Cold start < 3s' },
      { action: 'ASSERT', description: 'Vérifier l\'écran principal', expected_result: 'Éléments UI principaux visibles' },
    ],
    expected_results_outline: ['Application se lance sans crash', 'Écran principal affiché'],
    required_inputs: ['app_package', 'device_name'],
    required_datasets_types: [],
    tags: ['mobile', 'launch', 'smoke'],
    min_scope: 'MINIMAL',
    domains: ['MOBILE'],
    test_types: ['VABF'],
    profile_types: ['APPIUM'],
  },
  {
    template_id: 'MOBILE_VABF_LOGIN',
    title: 'Authentification mobile',
    priority: 'P0',
    rationale: 'Valide le flux de connexion sur l\'application mobile.',
    steps_outline: [
      { action: 'LAUNCH', description: 'Lancer l\'application', expected_result: 'Écran de login affiché' },
      { action: 'INPUT', description: 'Saisir les identifiants', expected_result: 'Champs remplis' },
      { action: 'TAP', description: 'Appuyer sur Se connecter', expected_result: 'Redirection vers l\'écran principal' },
      { action: 'ASSERT', description: 'Vérifier la session', expected_result: 'Utilisateur connecté' },
    ],
    expected_results_outline: ['Connexion réussie', 'Session persistante'],
    required_inputs: ['app_package', 'credentials_valid'],
    required_datasets_types: ['users'],
    tags: ['mobile', 'auth', 'login'],
    min_scope: 'MINIMAL',
    domains: ['MOBILE'],
    test_types: ['VABF'],
    profile_types: ['APPIUM'],
  },
];

// ─── Catalogue complet ─────────────────────────────────────────────────────

export const ALL_TEMPLATES: ScenarioTemplate[] = [
  ...WEB_VABF_TEMPLATES,
  ...WEB_VSR_TEMPLATES,
  ...WEB_VABE_TEMPLATES,
  ...API_VABF_TEMPLATES,
  ...API_VABE_TEMPLATES,
  ...API_VSR_TEMPLATES,
  ...TELECOM_IMS_VABF_TEMPLATES,
  ...TELECOM_5GC_VABF_TEMPLATES,
  ...TELECOM_EPC_VABF_TEMPLATES,
  ...MOBILE_VABF_TEMPLATES,
];

/**
 * Retourne les templates compatibles avec un profil donné.
 */
export function getTemplatesForProfile(
  domain: string,
  testType: string,
  profileType: string,
): ScenarioTemplate[] {
  return ALL_TEMPLATES.filter(t =>
    t.domains.includes(domain as ProfileDomain) &&
    t.test_types.includes(testType as TestType) &&
    (t.profile_types.length === 0 || t.profile_types.includes(profileType as ProfileType))
  );
}

/**
 * Filtre les templates par scope level.
 */
export function filterByScope(templates: ScenarioTemplate[], scope: ScopeLevel): ScenarioTemplate[] {
  const scopeOrder: Record<ScopeLevel, number> = { MINIMAL: 0, STANDARD: 1, FULL: 2 };
  const maxScope = scopeOrder[scope];
  return templates.filter(t => scopeOrder[t.min_scope] <= maxScope);
}
