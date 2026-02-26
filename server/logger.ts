// ============================================================================
// AgilesTest — Structured Logger (pino)
// JSON logs, PII redaction, request-id correlation
// ============================================================================

import pino from "pino";
import { ENV } from "./_core/env";

export const logger = pino({
  level: ENV.logLevel,
  ...(ENV.isProduction
    ? {
        // Production: JSON only, no pretty-print
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "password",
            "token",
            "secret",
            "accessToken",
            "refreshToken",
            "*.password",
            "*.token",
            "*.secret",
          ],
          censor: "[REDACTED]",
        },
      }
    : {
        // Development: pretty-print
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
});

export type Logger = typeof logger;
export default logger;
