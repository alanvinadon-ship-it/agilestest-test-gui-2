/**
 * seedBundleDatasets.ts — Endpoint tRPC pour insérer les datasets avec des valeurs
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../_core/trpc';
import * as db from '../db';
import { datasetTypes, datasetInstances, bundleItems, datasetBundles, projects } from '../../drizzle/schema';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

export const seedBundleDatasetsRouter = {
  bundleDatasets: publicProcedure
    .meta({ openapi: { method: 'POST', path: '/seed/bundle-datasets', tags: ['admin'] } })
    .input(z.void())
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
      datasetsCreated: z.number(),
      bundleId: z.string().optional(),
    }))
    .mutation(async ({ ctx }) => {
      try {
        // 1. Récupérer la base de données
        const dbInstance = await db.getDb();
        if (!dbInstance) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
        }

        // 2. Récupérer le premier projet
        const [project] = await dbInstance.select().from(projects).limit(1);
        if (!project) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Aucun projet trouvé' });
        }

        // 3. Récupérer le bundle BUNDLE_WEB_PROD_V1
        const [bundle] = await dbInstance.select().from(datasetBundles)
          .where(eq(datasetBundles.name, 'BUNDLE_WEB_PROD_V1'))
          .limit(1);
        if (!bundle) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Bundle BUNDLE_WEB_PROD_V1 non trouvé' });
        }

        let datasetsCreated = 0;

        // 3. Configuration des datasets à créer
        const datasetConfigs = [
          {
            typeId: 'search_data',
            name: 'Données de recherche',
            description: 'Jeu de données pour les tests de recherche et filtrage',
            schemaFields: [
              { name: 'search_term', type: 'string', required: true, description: 'Terme de recherche', example: 'Playwright' },
              { name: 'filter_category', type: 'string', required: false, description: 'Catégorie de filtre', example: 'Automation' },
              { name: 'expected_results_count', type: 'number', required: false, description: 'Nombre de résultats attendus', example: 10 }
            ],
            values: {
              search_term_1: 'Playwright',
              search_term_2: 'Cypress',
              search_term_3: 'Selenium',
              filter_category_1: 'Automation',
              filter_category_2: 'Testing',
              expected_results_count_1: '100',
              expected_results_count_2: '50'
            }
          },
          {
            typeId: 'auth_data',
            name: 'Données d\'authentification',
            description: 'Jeu de données pour les tests de connexion et authentification',
            schemaFields: [
              { name: 'username', type: 'string', required: true, description: 'Nom d\'utilisateur', example: 'test_user' },
              { name: 'password', type: 'string', required: true, description: 'Mot de passe', example: 'SecurePass123!' },
              { name: 'email', type: 'string', required: false, description: 'Email', example: 'test@example.com' }
            ],
            values: {
              username: 'test_user_prod',
              password: 'SecurePassword123!',
              email: 'testuser@agilestest.com',
              username_invalid: 'invalid_user',
              password_invalid: 'wrongpass'
            }
          },
          {
            typeId: 'form_data',
            name: 'Données de formulaire',
            description: 'Jeu de données pour les tests de soumission de formulaire',
            schemaFields: [
              { name: 'nom_complet', type: 'string', required: true, description: 'Nom complet', example: 'Jean Kouassi' },
              { name: 'email', type: 'string', required: true, description: 'Email', example: 'jean@test.ci' },
              { name: 'telephone', type: 'string', required: false, description: 'Téléphone', example: '+225 07 01 02 03 04' },
              { name: 'adresse', type: 'string', required: false, description: 'Adresse', example: '123 Rue de la Paix' },
              { name: 'password', type: 'string', required: true, description: 'Mot de passe', example: 'Test@Secure!2026' }
            ],
            values: {
              nom_complet: 'Jean Kouassi',
              email: 'jean.kouassi@test.ci',
              telephone: '+225 07 01 02 03 04',
              adresse: '123 Rue de la Paix, Abidjan',
              code_postal: '01 BP 1234',
              ville: 'Abidjan',
              pays: 'Côte d\'Ivoire',
              password: 'Test@Secure!2026',
              password_confirm: 'Test@Secure!2026'
            }
          }
        ];

        // 4. Créer les dataset types et instances
        for (const config of datasetConfigs) {
          // Vérifier si le type existe
          const [existingType] = await dbInstance.select().from(datasetTypes)
            .where(eq(datasetTypes.datasetTypeId, config.typeId))
            .limit(1);

          let typeUid = existingType?.uid;

          if (!existingType) {
            typeUid = randomUUID();
            await dbInstance.insert(datasetTypes).values({
              uid: typeUid,
              datasetTypeId: config.typeId,
              domain: 'WEB',
              testType: 'VABF',
              name: config.name,
              description: config.description,
              schemaFields: config.schemaFields as any,
              examplePlaceholders: {} as any,
              tags: [config.typeId] as any,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Créer l'instance de dataset (sans projectId pour que ce soit global)
          const datasetId = randomUUID();
          await dbInstance.insert(datasetInstances).values({
            uid: datasetId,
            projectId: project.uid || '',  // Utiliser le premier projet comme default
            datasetTypeId: config.typeId,
            env: 'PROD',
            version: 1,
            status: 'ACTIVE',
            valuesJson: config.values as any,
            notes: `Dataset ${config.typeId} pour tests PROD`,
            createdBy: 'SYSTEM',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Ajouter le dataset au bundle
          await dbInstance.insert(bundleItems).values({
            bundleId: bundle.uid,
            datasetId: datasetId,
          });

          datasetsCreated++;
        }

        return {
          success: true,
          message: `${datasetsCreated} dataset(s) créé(s) et ajouté(s) au bundle BUNDLE_WEB_PROD_V1`,
          datasetsCreated,
          bundleId: bundle.uid,
        };
      } catch (error) {
        console.error('Erreur lors du seed des datasets:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Erreur inconnue lors du seed',
        });
      }
    }),
};
