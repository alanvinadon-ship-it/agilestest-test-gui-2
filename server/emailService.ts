/**
 * emailService.ts — Envoi SMTP réel via Nodemailer
 *
 * Utilisé par le tRPC router notifications pour envoyer des emails de test
 * et des notifications réelles.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: 'NONE' | 'STARTTLS' | 'TLS';
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  reply_to?: string;
  timeout_ms?: number;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  message_id?: string;
  response?: string;
  error?: string;
  duration_ms: number;
}

/**
 * Crée un transporter Nodemailer à partir de la config SMTP.
 */
function createTransporter(config: SmtpConfig): Transporter {
  const isImplicitTLS = config.secure === 'TLS';
  const useStartTLS = config.secure === 'STARTTLS';

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // secure=true → TLS implicite (port 465 typiquement)
    // secure=false + requireTLS → STARTTLS (port 587 typiquement)
    secure: isImplicitTLS,
    ...(useStartTLS ? { requireTLS: true } : {}),
    auth: {
      user: config.username,
      pass: config.password,
    },
    connectionTimeout: config.timeout_ms || 15000,
    greetingTimeout: config.timeout_ms || 15000,
    socketTimeout: config.timeout_ms || 15000,
    tls: {
      // En production, mettre à false pour vérifier les certificats
      rejectUnauthorized: false,
    },
  });
}

/**
 * Vérifie la connexion SMTP (EHLO + auth).
 */
export async function verifySmtpConnection(config: SmtpConfig): Promise<{
  success: boolean;
  error?: string;
  duration_ms: number;
}> {
  const start = Date.now();
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    transporter.close();
    return { success: true, duration_ms: Date.now() - start };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || String(err),
      duration_ms: Date.now() - start,
    };
  }
}

/**
 * Envoie un email via SMTP.
 */
export async function sendEmail(
  config: SmtpConfig,
  params: SendEmailParams
): Promise<SendEmailResult> {
  const start = Date.now();
  try {
    const transporter = createTransporter(config);

    const info = await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      replyTo: config.reply_to || config.from_email,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text || params.html.replace(/<[^>]*>/g, ''),
    });

    transporter.close();

    return {
      success: true,
      message_id: info.messageId,
      response: info.response,
      duration_ms: Date.now() - start,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || String(err),
      duration_ms: Date.now() - start,
    };
  }
}

/**
 * Envoie un email de test standardisé.
 */
export async function sendTestEmail(
  config: SmtpConfig,
  recipientEmail: string
): Promise<SendEmailResult> {
  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  return sendEmail(config, {
    to: recipientEmail,
    subject: `[AgilesTest] Email de test — ${now}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a1a2e; color: #e0e0e0; padding: 20px; border-radius: 8px;">
          <h2 style="color: #f97316; margin-top: 0;">AgilesTest — Email de test</h2>
          <p>Cet email confirme que la configuration SMTP est <strong style="color: #22c55e;">fonctionnelle</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #333; color: #999;">Serveur SMTP</td>
              <td style="padding: 8px; border-bottom: 1px solid #333;">${config.host}:${config.port}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #333; color: #999;">Sécurité</td>
              <td style="padding: 8px; border-bottom: 1px solid #333;">${config.secure}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #333; color: #999;">Expéditeur</td>
              <td style="padding: 8px; border-bottom: 1px solid #333;">${config.from_name} &lt;${config.from_email}&gt;</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #333; color: #999;">Date d'envoi</td>
              <td style="padding: 8px; border-bottom: 1px solid #333;">${now}</td>
            </tr>
          </table>
          <p style="font-size: 12px; color: #666; margin-bottom: 0;">
            Cet email a été envoyé automatiquement par la plateforme AgilesTest.
          </p>
        </div>
      </div>
    `,
  });
}
