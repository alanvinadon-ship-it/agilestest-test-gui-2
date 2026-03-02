# Sidebar — Modes et état persistant

## Résumé

La sidebar supporte deux modes de fonctionnement : **normal** (étendu) et **mini** (réduit). Les deux modes sont persistés dans `localStorage` via le module `uiStorage`. En mode normal, les sections accordéon s'ouvrent/ferment avec persistance. En mode mini, les icônes affichent des tooltips et des popovers pour la navigation rapide.

## Modes de la sidebar

| Mode | Largeur | Navigation | Persistance |
|------|---------|------------|-------------|
| **Normal** | 224px (`w-56`) | Accordéons dépliables avec sous-items visibles | `agilestest.ui.sidebarAccordions` |
| **Mini** | 60px (`w-[60px]`) | Icônes + tooltips + popovers au clic | `agilestest.ui.sidebarMini` |

Le toggle entre les deux modes se fait via le bouton dans l'en-tête de la sidebar (icône `PanelLeftClose` / clic sur le logo AT en mini).

## Mode mini — Comportement

En mode mini, chaque section de navigation est représentée par son icône uniquement. L'interaction se fait de deux manières selon le type de section :

**Sections flat** (Général, Aide) : chaque item est une icône individuelle avec un tooltip affichant le nom de la route au survol.

**Sections accordéon** (Configuration, Exécution, Drive Test, Administration) : l'icône de la section ouvre un popover (Radix UI) contenant la liste complète des sous-items. Le popover se ferme automatiquement après navigation ou via la touche Escape.

Les badges de compteurs (exécutions en cours, invitations pending) restent visibles sur les icônes en mode mini, positionnés en haut à droite.

Le nom d'utilisateur et le rôle sont accessibles via un tooltip sur l'avatar en bas de la sidebar.

## Sections accordéon (mode normal)

| Label sidebar   | Clé état        | Routes couvertes                                    |
|-----------------|-----------------|-----------------------------------------------------|
| Configuration   | `configuration` | `/profiles`, `/scenarios`, `/datasets`, `/bundles`… |
| Exécution       | `execution`     | `/executions`, `/captures`, `/probes`               |
| Drive Test      | `driveTest`     | `/drive/campaigns`, `/drive/reporting`              |
| Administration  | `administration`| `/admin/users`, `/admin/roles`, `/admin/rbac`…      |

Les sections **Général** et **Aide** sont `flat` (pas d'accordéon).

## Priorité logique (accordéons)

1. **Mount** — Charger l'état depuis `uiGet("sidebarAccordions")`.
2. **Route active** — Si la route courante appartient à une section, forcer `open=true` (même si mémorisée fermée).
3. **Toggle utilisateur** — Sauvegarder immédiatement via `uiSet("sidebarAccordions", ...)`.

## Accessibilité

Le mode mini respecte les standards d'accessibilité suivants :

| Attribut | Usage |
|----------|-------|
| `aria-label` | Nom de la section sur le bouton popover, labels sur toggle et logout |
| `aria-haspopup` | Indique qu'un popover est disponible |
| `aria-expanded` | Reflète l'état ouvert/fermé du popover |
| `Escape` | Ferme le popover actif |
| Focus clavier | Enter/Space ouvre le popover via Radix UI |

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `client/src/lib/uiStorage.ts` | Whitelist + schéma Zod (`sidebarAccordions`, `sidebarMini`) |
| `client/src/hooks/useSidebarAccordionState.ts` | Hook accordéon (state + persistence + auto-open) |
| `client/src/hooks/useSidebarCounts.ts` | Hook compteurs badges (tRPC `ui.sidebarCounts`) |
| `client/src/components/DashboardLayout.tsx` | Layout principal avec les deux modes |
| `server/sidebar-accordion.test.ts` | 29 tests unitaires (accordéons) |
| `server/sidebar-counts.test.ts` | 33 tests unitaires (badges) |
| `server/sidebar-mini.test.ts` | 33 tests unitaires (mode mini) |

## Schémas Zod

```ts
// Accordéons
z.object({
  configuration: z.boolean(),
  execution: z.boolean(),
  driveTest: z.boolean(),
  administration: z.boolean(),
})

// Mini mode
z.boolean()  // true = mini, false = normal
```

## Ajouter une nouvelle section accordéon

1. Ajouter la clé dans `sidebarAccordionsSchema` et `DEFAULTS` dans `uiStorage.ts`.
2. Ajouter le mapping label → clé dans `LABEL_TO_KEY` dans `useSidebarAccordionState.ts`.
3. Mettre à jour les tests dans `sidebar-accordion.test.ts`.
