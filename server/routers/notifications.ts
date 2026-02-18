/**
 * notifications.ts — tRPC router pour l'envoi d'emails SMTP réel
 *
 * Endpoints :
 * - notifications.testEmail : envoie un email de test via SMTP
 * - notifications.verifySmtp : vérifie la connexion SMTP (EHLO + auth)
 * - notifications.sendEmail  : envoie un email custom via SMTP
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { sendTestEmail, verifySmtpConnection, sendEmail } from '../emailService';
import type { SmtpConfig } from '../emailService';

const SmtpConfigSchema = z.object({
  host: z.string().min(1, 'Hôte SMTP requis'),
  port: z.number().int().min(1).max(65535),
  secure: z.enum(['NONE', 'STARTTLS', 'TLS']),
  username: z.string().min(1, 'Nom d\'utilisateur requis'),
  password: z.string().min(1, 'Mot de passe requis'),
  from_email: z.string().email('Adresse expéditeur invalide'),
  from_name: z.string().default('AgilesTest'),
  reply_to: z.string().optional(),
  timeout_ms: z.number().int().min(1000).max(60000).default(15000),
});

export const notificationsRouter = router({
  /**
   * Vérifie la connexion SMTP (EHLO + authentification)
   */
  verifySmtp: publicProcedure
    .input(SmtpConfigSchema)
    .mutation(async ({ input }) => {
      const config: SmtpConfig = {
        host: input.host,
        port: input.port,
        secure: input.secure,
        username: input.username,
        password: input.password,
        from_email: input.from_email,
        from_name: input.from_name,
        reply_to: input.reply_to,
        timeout_ms: input.timeout_ms,
      };

      const result = await verifySmtpConnection(config);
      return result;
    }),

  /**
   * Envoie un email de test standardisé AgilesTest
   */
  testEmail: publicProcedure
    .input(z.object({
      smtp: SmtpConfigSchema,
      to_email: z.string().email('Adresse destinataire invalide'),
    }))
    .mutation(async ({ input }) => {
      // Validation combinaison port/sécurité
      if (input.smtp.port === 465 && input.smtp.secure === 'STARTTLS') {
        return {
          success: false,
          error: 'Combinaison invalide : port 465 nécessite TLS (pas STARTTLS)',
          duration_ms: 0,
        };
      }
      if (input.smtp.port === 587 && input.smtp.secure === 'TLS') {
        return {
          success: false,
          error: 'Combinaison invalide : port 587 nécessite STARTTLS (pas TLS)',
          duration_ms: 0,
        };
      }

      const config: SmtpConfig = {
        host: input.smtp.host,
        port: input.smtp.port,
        secure: input.smtp.secure,
        username: input.smtp.username,
        password: input.smtp.password,
        from_email: input.smtp.from_email,
        from_name: input.smtp.from_name,
        reply_to: input.smtp.reply_to,
        timeout_ms: input.smtp.timeout_ms,
      };

      const result = await sendTestEmail(config, input.to_email);
      return result;
    }),

  /**
   * Envoie un email personnalisé via SMTP
   */
  sendEmail: publicProcedure
    .input(z.object({
      smtp: SmtpConfigSchema,
      to: z.string().email('Adresse destinataire invalide'),
      subject: z.string().min(1, 'Sujet requis'),
      html: z.string().min(1, 'Corps HTML requis'),
      text: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const config: SmtpConfig = {
        host: input.smtp.host,
        port: input.smtp.port,
        secure: input.smtp.secure,
        username: input.smtp.username,
        password: input.smtp.password,
        from_email: input.smtp.from_email,
        from_name: input.smtp.from_name,
        reply_to: input.smtp.reply_to,
        timeout_ms: input.smtp.timeout_ms,
      };

      const result = await sendEmail(config, {
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return result;
    }),
});
