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
            ] as any,
            examplePlaceholders: {
              field_name: 'champ_{{index}}',
              field_value: 'Valeur test {{index}}',
              field_type: 'text',
              is_required: 'true',
            },
            tags: ['formulaire', 'saisie', 'validation'],
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
            nom_complet: 'Jean Kouassi',
            email: 'jean.kouassi@test.ci',
            telephone: '+225 07 01 02 03 04',
            adresse: '123 Rue de la Paix, Abidjan',
            code_postal: '01 BP 1234',
            ville: 'Abidjan',
            pays: 'Côte d\'Ivoire',
            champ_1: 'Valeur test 1',
            champ_2: 'Valeur test 2',
            champ_3: 'Valeur test 3',
            titre: 'M.',
            civilite: 'Monsieur',
            secteur_activite: 'Télécommunications',
            password: 'Test@Secure!2026',
            password_confirm: 'Test@Secure!2026',
            accepte_conditions: 'true',
            accepte_newsletter: 'false',
          },
          notes: 'Dataset FORM_DATA pour les tests de soumission de formulaires - Environnement PROD',
          createdBy: ctx.user.id.toString(),
        });

        // 4. Récupérer le bundle BUNDLE_WEB_PROD_V1
        const [bundle] = await db.select().from(datasetBundles).where(eq(datasetBundles.name, 'BUNDLE_WEB_PROD_V1')).limit(1);

        let bundleId: string | undefined;

        if (bundle) {
          // 5. Ajouter l'instance au bundle
          try {
            await db.insert(bundleItems).values({
              bundleId: bundle.uid,
              datasetId: datasetInstanceUid,
            });
            bundleId = bundle.uid;
          } catch (e) {
            // L'item pourrait déjà exister, continuer quand même
            console.log('Note: Bundle item may already exist');
          }
        }

        return {
          success: true,
          message: 'Dataset FORM_DATA créé et ajouté au bundle avec succès',
          datasetTypeUid,
          datasetInstanceUid,
          bundleId,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Erreur lors de la création du dataset FORM_DATA: ${error.message}`,
        });
      }
    }),
};
