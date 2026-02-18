/**
 * notifications.ts — tRPC router pour l'envoi d'emails SMTP réel
 *
 * Endpoints :
 * - notifications.testEmail      : envoie un email de test via SMTP
 * - notifications.verifySmtp     : vérifie la connexion SMTP (EHLO + auth)
 * - notifications.sendEmail      : envoie un email custom via SMTP
 * - notifications.sendInviteEmail: envoie un email d'invitation utilisateur via SMTP
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

function buildSmtpConfig(input: z.infer<typeof SmtpConfigSchema>): SmtpConfig {
  return {
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
}

/**
 * Génère le HTML de l'email d'invitation utilisateur.
 */
function buildInviteEmailHtml(params: {
  invitee_email: string;
  inviter_name: string;
  role: string;
  invite_link: string;
  expires_at: string;
  app_name: string;
}): string {
  const expiresFormatted = new Date(params.expires_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a1a2e; color: #e0e0e0; padding: 30px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: #f97316; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 18px;">
            ${params.app_name}
          </div>
        </div>

        <h2 style="color: #f97316; margin-top: 0; text-align: center;">Vous êtes invité(e) !</h2>

        <p style="font-size: 15px; line-height: 1.6;">
          Bonjour,
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          <strong style="color: #f97316;">${params.inviter_name}</strong> vous invite à rejoindre la plateforme
          <strong>${params.app_name}</strong> avec le rôle <strong style="color: #22c55e;">${params.role}</strong>.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.invite_link}"
             style="display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Accepter l'invitation
          </a>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #333; color: #999; font-size: 13px;">Email</td>
            <td style="padding: 8px; border-bottom: 1px solid #333; font-size: 13px;">${params.invitee_email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #333; color: #999; font-size: 13px;">Rôle attribué</td>
            <td style="padding: 8px; border-bottom: 1px solid #333; font-size: 13px;">${params.role}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #333; color: #999; font-size: 13px;">Invité par</td>
            <td style="padding: 8px; border-bottom: 1px solid #333; font-size: 13px;">${params.inviter_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #333; color: #999; font-size: 13px;">Expire le</td>
            <td style="padding: 8px; border-bottom: 1px solid #333; font-size: 13px;">${expiresFormatted}</td>
          </tr>
        </table>

        <p style="font-size: 12px; color: #666; text-align: center;">
          Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.<br>
          Ce lien expire le ${expiresFormatted}.
        </p>

        <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;" />

        <p style="font-size: 11px; color: #555; text-align: center; margin-bottom: 0;">
          Cet email a été envoyé automatiquement par ${params.app_name}.
        </p>
      </div>
    </div>
  `;
}

function buildInviteEmailText(params: {
  invitee_email: string;
  inviter_name: string;
  role: string;
  invite_link: string;
  expires_at: string;
  app_name: string;
}): string {
  const expiresFormatted = new Date(params.expires_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  return [
    `Bonjour,`,
    ``,
    `${params.inviter_name} vous invite à rejoindre ${params.app_name} avec le rôle ${params.role}.`,
    ``,
    `Cliquez sur le lien suivant pour accepter l'invitation :`,
    `${params.invite_link}`,
    ``,
    `Ce lien expire le ${expiresFormatted}.`,
    ``,
    `Cordialement,`,
    `L'équipe ${params.app_name}`,
  ].join('\n');
}

export const notificationsRouter = router({
  /**
   * Vérifie la connexion SMTP (EHLO + authentification)
   */
  verifySmtp: publicProcedure
    .input(SmtpConfigSchema)
    .mutation(async ({ input }) => {
      const config = buildSmtpConfig(input);
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

      const config = buildSmtpConfig(input.smtp);
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
      const config = buildSmtpConfig(input.smtp);
      const result = await sendEmail(config, {
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return result;
    }),

  /**
   * Envoie un email d'invitation utilisateur via SMTP
   */
  sendInviteEmail: publicProcedure
    .input(z.object({
      smtp: SmtpConfigSchema,
      invitee_email: z.string().email('Adresse destinataire invalide'),
      inviter_name: z.string().min(1),
      role: z.string().min(1),
      invite_link: z.string().min(1),
      expires_at: z.string().min(1),
      app_name: z.string().default('AgilesTest'),
    }))
    .mutation(async ({ input }) => {
      const config = buildSmtpConfig(input.smtp);

      const htmlBody = buildInviteEmailHtml({
        invitee_email: input.invitee_email,
        inviter_name: input.inviter_name,
        role: input.role,
        invite_link: input.invite_link,
        expires_at: input.expires_at,
        app_name: input.app_name,
      });

      const textBody = buildInviteEmailText({
        invitee_email: input.invitee_email,
        inviter_name: input.inviter_name,
        role: input.role,
        invite_link: input.invite_link,
        expires_at: input.expires_at,
        app_name: input.app_name,
      });

      const result = await sendEmail(config, {
        to: input.invitee_email,
        subject: `[${input.app_name}] Vous êtes invité(e) à rejoindre la plateforme`,
        html: htmlBody,
        text: textBody,
      });

      return result;
    }),
});
