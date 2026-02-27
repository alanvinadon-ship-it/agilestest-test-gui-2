/**
 * ESLint config — Gate anti-régression localStorage → tRPC
 *
 * Objectif : empêcher la réintroduction de localStore / repositoryApi
 * dans les pages déjà migrées vers tRPC/DB.
 *
 * Usage CI : pnpm lint   (échoue si import interdit détecté)
 *
 * Pages migrées (surveillées) :
 *   ProfilesPage, DatasetTypesPage, DatasetsPage, DriveCampaignsPage,
 *   ProjectsPage, ProbesPage, ExecutionsPage, CapturesPage, BundlesPage
 *
 * Pages NON migrées (exclues pour l'instant) :
 *   ScenariosPage (localScenarios, localDatasetTypes, localCapturePolicies)
 *   AdminProjectAccessPage, ProjectSettingsPage, DriveIncidentReportPage,
 *   DriveReportingPage (encore sur localStorage)
 */
import tsParser from "typescript-eslint";

export default [
  {
    files: [
      "client/src/pages/ProfilesPage.tsx",
      "client/src/pages/DatasetTypesPage.tsx",
      "client/src/pages/DatasetsPage.tsx",
      "client/src/pages/DriveCampaignsPage.tsx",
      "client/src/pages/ProjectsPage.tsx",
      "client/src/pages/ProbesPage.tsx",
      "client/src/pages/ExecutionsPage.tsx",
      "client/src/pages/CapturesPage.tsx",
      "client/src/pages/BundlesPage.tsx",
    ],
    languageOptions: {
      parser: tsParser.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "../api/localStore",
              message:
                "⛔ Cette page est migrée vers tRPC/DB. Utilisez trpc.* hooks au lieu de localStore.",
            },
            {
              name: "../api/repositoryApi",
              message:
                "⛔ Cette page est migrée vers tRPC/DB. Utilisez trpc.* hooks au lieu de repositoryApi.",
            },
          ],
          patterns: [
            {
              group: ["**/api/localStore*"],
              message:
                "⛔ Cette page est migrée vers tRPC/DB. Utilisez trpc.* hooks au lieu de localStore.",
            },
            {
              group: ["**/api/repositoryApi*"],
              message:
                "⛔ Cette page est migrée vers tRPC/DB. Utilisez trpc.* hooks au lieu de repositoryApi.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".manus-logs/**",
      "drizzle/migrations/**",
    ],
  },
];
