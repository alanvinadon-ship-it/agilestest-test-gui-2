/**
 * ESLint config — Gate anti-régression localStorage
 *
 * OBJECTIF : Empêcher tout import de localStore ou repositoryApi dans le code source.
 * Le fichier localStore.ts a été supprimé. Cette gate empêche toute réintroduction.
 *
 * Scope : GLOBAL — tous les fichiers .ts/.tsx sous client/src/
 */
import tsParser from "typescript-eslint";

export default [
  {
    files: ["client/src/**/*.{ts,tsx}"],
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
          patterns: [
            {
              group: ["**/localStore", "**/localStore.*"],
              message:
                "❌ localStore.ts a été supprimé. Utiliser les hooks tRPC (trpc.*.useQuery/useMutation).",
            },
            {
              group: ["**/repositoryApi", "**/repositoryApi.*"],
              message:
                "❌ repositoryApi.ts a été supprimé. Utiliser les hooks tRPC (trpc.*.useQuery/useMutation).",
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
