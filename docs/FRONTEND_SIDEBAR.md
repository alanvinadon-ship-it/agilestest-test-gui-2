# Sidebar Accordion — État persistant

## Résumé

L'état open/closed des sections accordéon de la sidebar est persisté dans `localStorage` via le module `uiStorage` (clé `agilestest.ui.sidebarAccordions`). La section contenant la route active s'ouvre automatiquement, même si elle était mémorisée comme fermée.

## Sections accordéon

| Label sidebar   | Clé état        | Routes couvertes                                    |
|-----------------|-----------------|-----------------------------------------------------|
| Configuration   | `configuration` | `/profiles`, `/scenarios`, `/datasets`, `/bundles`… |
| Exécution       | `execution`     | `/executions`, `/captures`, `/probes`               |
| Drive Test      | `driveTest`     | `/drive/campaigns`, `/drive/reporting`              |
| Administration  | `administration`| `/admin/users`, `/admin/roles`, `/admin/rbac`…      |

Les sections **Général** et **Aide** sont `flat` (pas d'accordéon).

## Priorité logique

1. **Mount** — Charger l'état depuis `uiGet("sidebarAccordions")`.
2. **Route active** — Si la route courante appartient à une section, forcer `open=true` (même si mémorisée fermée).
3. **Toggle utilisateur** — Sauvegarder immédiatement via `uiSet("sidebarAccordions", ...)`.

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `client/src/lib/uiStorage.ts` | Whitelist + schéma Zod `sidebarAccordions` |
| `client/src/hooks/useSidebarAccordionState.ts` | Hook dédié (state + persistence + auto-open) |
| `client/src/components/DashboardLayout.tsx` | Intégration du hook dans la sidebar |
| `server/sidebar-accordion.test.ts` | 29 tests unitaires |

## Schéma Zod

```ts
z.object({
  configuration: z.boolean(),
  execution: z.boolean(),
  driveTest: z.boolean(),
  administration: z.boolean(),
})
```

Valeur par défaut : toutes les sections fermées (`false`).

## Ajouter une nouvelle section accordéon

1. Ajouter la clé dans `sidebarAccordionsSchema` et `DEFAULTS` dans `uiStorage.ts`.
2. Ajouter le mapping label → clé dans `LABEL_TO_KEY` dans `useSidebarAccordionState.ts`.
3. Mettre à jour les tests dans `sidebar-accordion.test.ts`.
