/**
 * seedFormData.ts — Endpoint tRPC temporaire pour insérer le dataset FORM_DATA
 * 
 * Usage (depuis le frontend ou curl):
 *   POST /api/trpc/seed.formData
 * 
 * Ce endpoint :
 * 1. Crée un dataset type FORM_DATA s'il n'existe pas
 * 2. Crée une instance de dataset FORM_DATA dans le premier projet
 * 3. Ajoute l'instance au bundle BUNDLE_WEB_PROD_V1
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { adminProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { datasetTypes, datasetInstances, bundleItems, datasetBundles, projects } from '../../drizzle/schema';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
  return db;
}

export const seedRouter = {
  seedFormData: adminProcedure
    .meta({ openapi: { method: 'POST', path: '/seed/form-data', tags: ['admin'] } })
    .input(z.void())
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
      datasetTypeUid: z.string().optional(),
      datasetInstanceUid: z.string().optional(),
      bundleId: z.string().optional(),
    }))
    .mutation(async ({ ctx }) => {
      try {
        const db = await requireDb();
        
        // 1. Vérifier/créer le dataset type FORM_DATA
        const [datasetType] = await db.select().from(datasetTypes).where(eq(datasetTypes.datasetTypeId, 'form_data')).limit(1);

        let datasetTypeUid = datasetType?.uid;

        if (!datasetType) {
          datasetTypeUid = randomUUID();
          await db.insert(datasetTypes).values({
            uid: datasetTypeUid,
            datasetTypeId: 'form_data',
            domain: 'WEB',
            testType: 'VABF',
            name: 'Données de formulaire',
            description: 'Jeu de données pour les tests de soumission de formulaires (inscription, contact, commande).',
            schemaFields: [
              { name: 'field_name', type: 'string', required: true, description: 'Nom du champ', example: 'nom_complet' },
              { name: 'field_value', type: 'string', required: true, description: 'Valeur à saisir', example: 'Marie Bamba' },
              { name: 'field_type', type: 'enum', required: false, description: 'Type de champ HTML', example: 'text', enum_values: ['text', 'email', 'number', 'tel', 'select', 'checkbox', 'textarea', 'date'] },
              { name: 'is_required', type: 'boolean', required: false, description: 'Champ obligatoire', example: 'true' },
              { name: 'validation_regex', type: 'string', required: false, description: 'Pattern de validation', example: '^[A-Za-z ]+$' },
              {
                name: 'user_info',
                type: 'object',
                required: true,
                description: 'Informations utilisateur imbriquées',
                nested: [
                  { name: 'firstName', type: 'string', required: true, description: 'Prénom', example: 'Jean' },
                  { name: 'lastName', type: 'string', required: true, description: 'Nom', example: 'Kouassi' },
                  { name: 'email', type: 'email', required: true, description: 'Email', example: 'jean@example.com' },
                  { name: 'phone', type: 'phone', required: false, description: 'Téléphone', example: '+225 07 01 02 03 04' },
                ]
              },
              {
                name: 'address',
                type: 'object',
                required: true,
                description: 'Adresse complète',
                nested: [
                  { name: 'street', type: 'string', required: true, description: 'Rue', example: '123 Rue de la Paix' },
                  { name: 'city', type: 'string', required: true, description: 'Ville', example: 'Abidjan' },
                  { name: 'zipCode', type: 'string', required: false, description: 'Code postal', example: '01 BP 1234' },
                  { name: 'country', type: 'string', required: true, description: 'Pays', example: 'Côte d\'Ivoire' },
                ]
              },
            ] as any,
            examplePlaceholders: {
              field_name: 'champ_{{index}}',
              field_value: 'Valeur test {{index}}',
              field_type: 'text',
              is_required: 'true',
            },
            tags: ['formulaire', 'saisie', 'validation', 'object'],
          });
        }

        // 2. Récupérer le premier projet
        const [firstProject] = await db.select().from(projects).limit(1);
        if (!firstProject) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Aucun projet trouvé dans la base de données',
          });
        }

        // 3. Créer une instance de dataset FORM_DATA
        const datasetInstanceUid = randomUUID();
        await db.insert(datasetInstances).values({
          uid: datasetInstanceUid,
          projectId: firstProject.uid,
          datasetTypeId: 'form_data',
          env: 'PROD',
          version: 1,
          status: 'ACTIVE',
          valuesJson: {
            field_name: 'nom_complet',
            field_value: 'Jean Kouassi',
            field_type: 'text',
            is_required: 'true',
            validation_regex: '^[A-Za-z ]+$',
            user_info: {
              firstName: 'Jean',
              lastName: 'Kouassi',
              email: 'jean.kouassi@test.ci',
              phone: '+225 07 01 02 03 04',
            },
            address: {
              street: '123 Rue de la Paix',
              city: 'Abidjan',
              zipCode: '01 BP 1234',
              country: 'Côte d\'Ivoire',
            },
          },
          notes: 'Dataset FORM_DATA avec champs object - Environnement PROD',
          createdBy: ctx.user?.openId || 'system',
        });

        // 4. Récupérer le bundle BUNDLE_WEB_PROD_V1
        const [bundle] = await db.select().from(datasetBundles)
          .where(eq(datasetBundles.name, 'BUNDLE_WEB_PROD_V1'))
          .limit(1);

        if (bundle) {
          // Vérifier si l'item existe déjà
          const [existingItem] = await db.select().from(bundleItems)
            .where(eq(bundleItems.bundleId, bundle.uid))
            .limit(1);

          if (!existingItem) {
            await db.insert(bundleItems).values({
              bundleId: bundle.uid,
              datasetId: datasetInstanceUid,
            });
          }
        }

        return {
          success: true,
          message: 'Dataset FORM_DATA créé avec succès (avec champs object)',
          datasetTypeUid,
          datasetInstanceUid,
          bundleId: bundle?.uid,
        };
      } catch (error) {
        console.error('Seed error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Erreur lors du seed',
        });
      }
    }),
};
