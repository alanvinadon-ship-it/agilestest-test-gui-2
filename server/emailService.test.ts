import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock nodemailer pour les tests unitaires (pas de serveur SMTP réel)
vi.mock('nodemailer', () => {
  const mockTransporter = {
    sendMail: vi.fn().mockResolvedValue({
      messageId: '<test-123@agilestest.io>',
      response: '250 2.0.0 OK',
    }),
    verify: vi.fn().mockResolvedValue(true),
    close: vi.fn(),
  };
  return {
    default: {
      createTransport: vi.fn().mockReturnValue(mockTransporter),
    },
  };
});

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

const validSmtpConfig = {
  host: 'mail.agileslab.com',
  port: 587,
  secure: 'STARTTLS' as const,
  username: 'testuser',
  password: 'testpass',
  from_email: 'noreply@agilestest.io',
  from_name: 'AgilesTest',
  timeout_ms: 15000,
};

describe("notifications.testEmail", () => {
  it("envoie un email de test avec une config SMTP valide", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.testEmail({
      smtp: validSmtpConfig,
      to_email: 'recipient@example.com',
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.message_id).toBeDefined();
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("rejette une combinaison port 465 + STARTTLS", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.testEmail({
      smtp: { ...validSmtpConfig, port: 465, secure: 'STARTTLS' },
      to_email: 'recipient@example.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Combinaison invalide');
  });

  it("rejette une combinaison port 587 + TLS", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.testEmail({
      smtp: { ...validSmtpConfig, port: 587, secure: 'TLS' },
      to_email: 'recipient@example.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Combinaison invalide');
  });

  it("rejette un email destinataire invalide", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.notifications.testEmail({
        smtp: validSmtpConfig,
        to_email: 'not-an-email',
      })
    ).rejects.toThrow();
  });

  it("rejette un host SMTP vide", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.notifications.testEmail({
        smtp: { ...validSmtpConfig, host: '' },
        to_email: 'recipient@example.com',
      })
    ).rejects.toThrow();
  });
});

describe("notifications.verifySmtp", () => {
  it("vérifie la connexion SMTP avec succès", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.verifySmtp(validSmtpConfig);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

describe("notifications.sendEmail", () => {
  it("envoie un email personnalisé", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.sendEmail({
      smtp: validSmtpConfig,
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Hello World</p>',
      text: 'Hello World',
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.message_id).toBeDefined();
  });
});

describe("notifications.sendInviteEmail", () => {
  it("envoie un email d'invitation utilisateur via SMTP", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.sendInviteEmail({
      smtp: validSmtpConfig,
      invitee_email: 'newuser@example.com',
      inviter_name: 'Admin Test',
      role: 'Administrateur',
      invite_link: 'https://agilestest.io/invite/accept?token=tok_abc123',
      expires_at: '2026-03-01T23:59:59Z',
      app_name: 'AgilesTest',
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.message_id).toBeDefined();
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("rejette un email invité invalide", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.notifications.sendInviteEmail({
        smtp: validSmtpConfig,
        invitee_email: 'not-valid',
        inviter_name: 'Admin',
        role: 'Lecteur',
        invite_link: 'https://agilestest.io/invite/accept?token=tok_abc',
        expires_at: '2026-03-01T23:59:59Z',
        app_name: 'AgilesTest',
      })
    ).rejects.toThrow();
  });

  it("utilise le nom d'app par défaut si non fourni", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.sendInviteEmail({
      smtp: validSmtpConfig,
      invitee_email: 'user@example.com',
      inviter_name: 'Admin',
      role: 'Manager',
      invite_link: 'https://agilestest.io/invite/accept?token=tok_xyz',
      expires_at: '2026-03-01T23:59:59Z',
    });

    expect(result.success).toBe(true);
  });
});
