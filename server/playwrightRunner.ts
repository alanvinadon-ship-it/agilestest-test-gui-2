/**
 * playwrightRunner.ts — Worker Playwright pour le mode RÉEL
 *
 * Traduit chaque étape du scénario AgilesTest en commandes Playwright :
 *   NAVIGATE  → page.goto(url)
 *   FILL      → page.locator(target).fill(value)
 *   CLICK     → page.locator(target).click()
 *   SELECT    → page.locator(target).selectOption(value)
 *   ASSERT    → page.locator(target).waitFor() + visibility check
 *   CHECK     → page.locator(target).check()
 *   UNCHECK   → page.locator(target).uncheck()
 *   UPLOAD    → page.locator(target).setInputFiles(filePath)
 *   WAIT      → page.waitForTimeout(ms) or page.waitForSelector(target)
 *
 * Collecte un screenshot après chaque étape et un screenshot d'erreur en cas d'échec.
 */

import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import type { ExecutionStep, ExecutionResult } from "./executionEngine";

// ─── Types ───────────────────────────────────────────────────────────────

export interface PlaywrightRunnerOptions {
  /** URL de base du site cible (ex: https://myapp.example.com) */
  baseUrl: string;
  /** Timeout par étape en ms (défaut: 15000) */
  stepTimeout?: number;
  /** Prendre un screenshot après chaque étape (défaut: true) */
  screenshotPerStep?: boolean;
  /** Résolutions de bindings : clé (ex: "users.email") → valeur réelle */
  bindings?: Record<string, string>;
  /** Viewport width (défaut: 1280) */
  viewportWidth?: number;
  /** Viewport height (défaut: 720) */
  viewportHeight?: number;
  /** Mode headless (défaut: true) */
  headless?: boolean;
}

export interface StepResult {
  index: number;
  action: string;
  target: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
  durationMs: number;
  error?: string;
  screenshotBuffer?: Buffer;
}

export interface PlaywrightExecutionResult extends ExecutionResult {
  stepResults: StepResult[];
}

// ─── Locator Strategy ───────────────────────────────────────────────────

/**
 * Construit un sélecteur Playwright à partir de la stratégie de localisation.
 * Supporte : role, label, text, ref (data-testid), placeholder, css, xpath
 */
function buildLocator(page: Page, target: string, locatorStrategy?: string): ReturnType<Page["locator"]> {
  const strategy = (locatorStrategy || "").toLowerCase().trim();

  switch (strategy) {
    case "role":
      return page.getByRole(target as any);
    case "label":
      return page.getByLabel(target);
    case "text":
      return page.getByText(target);
    case "placeholder":
      return page.getByPlaceholder(target);
    case "ref":
    case "testid":
    case "data-testid":
      return page.getByTestId(target);
    case "xpath":
      return page.locator(`xpath=${target}`);
    case "css":
      return page.locator(target);
    default:
      // Auto-detect: si ça commence par / ou // c'est xpath, sinon CSS
      if (target.startsWith("//") || target.startsWith("/")) {
        return page.locator(`xpath=${target}`);
      }
      // Si ça contient des sélecteurs CSS classiques
      if (target.match(/^[#.\[\w]/)) {
        return page.locator(target);
      }
      // Fallback: chercher par data-testid, puis par texte
      return page.getByTestId(target).or(page.getByText(target));
  }
}

// ─── Action Executor ────────────────────────────────────────────────────

/**
 * Exécute une action Playwright pour une étape donnée.
 */
async function executeAction(
  page: Page,
  step: ExecutionStep & { locatorStrategy?: string },
  options: PlaywrightRunnerOptions,
): Promise<void> {
  const timeout = options.stepTimeout ?? 15000;
  const action = step.action.toUpperCase();
  const target = step.target;

  // Résoudre les bindings dans le target (ex: web_urls.full.login → https://...)
  const resolvedTarget = resolveBindingValue(target, options.bindings);

  switch (action) {
    case "NAVIGATE": {
      // Construire l'URL complète
      let url = resolvedTarget;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        // C'est une clé de binding ou un chemin relatif
        url = options.baseUrl.replace(/\/$/, "") + (url.startsWith("/") ? url : "/" + url);
      }
      await page.goto(url, { timeout, waitUntil: "domcontentloaded" });
      break;
    }

    case "FILL": {
      const locator = buildLocator(page, resolvedTarget, step.locatorStrategy);
      // Résoudre la valeur à remplir depuis le binding
      const fillValue = step.inputBinding
        ? resolveBindingValue(step.inputBinding, options.bindings)
        : "";
      await locator.waitFor({ state: "visible", timeout });
      await locator.clear();
      await locator.fill(fillValue);
      break;
    }

    case "CLICK": {
      const locator = buildLocator(page, resolvedTarget, step.locatorStrategy);
      await locator.waitFor({ state: "visible", timeout });
      await locator.click({ timeout });
      break;
    }

    case "SELECT": {
      const locator = buildLocator(page, resolvedTarget, step.locatorStrategy);
      const selectValue = step.inputBinding
        ? resolveBindingValue(step.inputBinding, options.bindings)
        : "";
      await locator.selectOption(selectValue, { timeout });
      break;
    }

    case "ASSERT": {
      const locator = buildLocator(page, resolvedTarget, step.locatorStrategy);
      await locator.waitFor({ state: "visible", timeout });
      const isVisible = await locator.isVisible();
      if (!isVisible) {
        throw new Error(`Assertion échouée: l'élément "${resolvedTarget}" n'est pas visible`);
      }
      break;
    }

    case "CHECK": {
      const locator = buildLocator(page, resolvedTarget, step.locatorStrategy);
      await locator.waitFor({ state: "visible", timeout });
      await locator.check({ timeout });
      break;
    }

    case "UNCHECK": {
      const locator = buildLocator(page, resolvedTarget, step.locatorStrategy);
      await locator.waitFor({ state: "visible", timeout });
      await locator.uncheck({ timeout });
      break;
    }

    case "UPLOAD": {
      const locator = buildLocator(page, resolvedTarget, step.locatorStrategy);
      const filePath = step.inputBinding
        ? resolveBindingValue(step.inputBinding, options.bindings)
        : "";
      await locator.setInputFiles(filePath);
      break;
    }

    case "WAIT": {
      // Si le target est un nombre, attendre ce nombre de ms
      const ms = parseInt(resolvedTarget, 10);
      if (!isNaN(ms)) {
        await page.waitForTimeout(ms);
      } else {
        // Sinon attendre l'élément
        const locator = buildLocator(page, resolvedTarget, step.locatorStrategy);
        await locator.waitFor({ state: "visible", timeout });
      }
      break;
    }

    default:
      throw new Error(`Action non supportée: ${action}`);
  }
}

// ─── Binding Resolution ─────────────────────────────────────────────────

/**
 * Résout une valeur de binding.
 * Ex: "users.email" → "john@example.com" si bindings["users.email"] existe.
 * Si pas de binding trouvé, retourne la valeur telle quelle.
 */
function resolveBindingValue(value: string, bindings?: Record<string, string>): string {
  if (!bindings || !value) return value;

  // Chercher une correspondance exacte
  if (bindings[value]) return bindings[value];

  // Chercher avec le préfixe (ex: "users.email" dans les bindings)
  const trimmed = value.trim();
  if (bindings[trimmed]) return bindings[trimmed];

  return value;
}

// ─── Main Runner ────────────────────────────────────────────────────────

/**
 * Exécute un scénario complet avec Playwright.
 * Retourne les résultats détaillés par étape, avec les screenshots.
 */
export async function runWithPlaywright(
  steps: (ExecutionStep & { locatorStrategy?: string })[],
  options: PlaywrightRunnerOptions,
): Promise<PlaywrightExecutionResult> {
  const startTime = Date.now();
  const stepResults: StepResult[] = [];
  let stepsPassed = 0;
  let stepsFailed = 0;
  let hasFailed = false;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Lancer le navigateur
    browser = await chromium.launch({
      headless: options.headless !== false,
    });

    context = await browser.newContext({
      viewport: {
        width: options.viewportWidth ?? 1280,
        height: options.viewportHeight ?? 720,
      },
      ignoreHTTPSErrors: true,
    });

    page = await context.newPage();

    // Exécuter chaque étape
    for (const step of steps) {
      if (hasFailed) {
        // Marquer les étapes restantes comme SKIPPED
        stepResults.push({
          index: step.index,
          action: step.action,
          target: step.target,
          status: "SKIPPED",
          durationMs: 0,
        });
        continue;
      }

      const stepStart = Date.now();
      try {
        await executeAction(page, step, options);
        const durationMs = Date.now() - stepStart;
        stepsPassed++;

        // Screenshot après l'étape (si activé)
        let screenshotBuffer: Buffer | undefined;
        if (options.screenshotPerStep !== false) {
          try {
            screenshotBuffer = await page.screenshot({ type: "png", fullPage: false }) as Buffer;
          } catch {
            // Ignorer les erreurs de screenshot
          }
        }

        stepResults.push({
          index: step.index,
          action: step.action,
          target: step.target,
          status: "PASSED",
          durationMs,
          screenshotBuffer,
        });
      } catch (error: any) {
        const durationMs = Date.now() - stepStart;
        stepsFailed++;
        hasFailed = true;

        // Screenshot d'erreur
        let screenshotBuffer: Buffer | undefined;
        try {
          screenshotBuffer = await page.screenshot({ type: "png", fullPage: false }) as Buffer;
        } catch {
          // Ignorer
        }

        stepResults.push({
          index: step.index,
          action: step.action,
          target: step.target,
          status: "FAILED",
          durationMs,
          error: error.message || String(error),
          screenshotBuffer,
        });
      }
    }
  } catch (error: any) {
    // Erreur fatale (lancement navigateur, etc.) — propager pour logging
    console.error("[PlaywrightRunner] Fatal error:", error.message);
    throw error;
  } finally {
    // Nettoyage
    try { if (context) await context.close(); } catch { /* ignore */ }
    try { if (browser) await browser.close(); } catch { /* ignore */ }
  }

  const durationMs = Date.now() - startTime;
  const finalStatus = stepsFailed > 0 ? "FAILED" : "PASSED";

  return {
    status: finalStatus,
    durationMs,
    stepsTotal: steps.length,
    stepsPassed,
    stepsFailed,
    stepResults,
  };
}

// ─── Export pour tests ──────────────────────────────────────────────────

export { buildLocator, resolveBindingValue, executeAction };
