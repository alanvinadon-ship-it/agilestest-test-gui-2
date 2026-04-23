/**
 * playwrightActions.ts — Fonctions partagées entre PlaywrightLocalRunner et PlaywrightRemoteRunner.
 *
 * Contient la logique de :
 *   - Construction de locators Playwright
 *   - Résolution des bindings
 *   - Exécution d'une action individuelle
 */

import type { Page } from "playwright";
import type { ExecutionStep } from "../executionEngine";

// ─── Options pour executeAction ─────────────────────────────────────────

export interface ActionOptions {
  baseUrl: string;
  bindings?: Record<string, string>;
  stepTimeout?: number;
}

// ─── Locator Strategy ───────────────────────────────────────────────────

/**
 * Construit un sélecteur Playwright à partir de la stratégie de localisation.
 * Supporte : role, label, text, ref (data-testid), placeholder, css, xpath
 */
export function buildLocator(page: Page, target: string, locatorStrategy?: string): ReturnType<Page["locator"]> {
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

// ─── Binding Resolution ─────────────────────────────────────────────────

/**
 * Résout une valeur de binding.
 * Ex: "users.email" → "john@example.com" si bindings["users.email"] existe.
 */
export function resolveBindingValue(value: string, bindings?: Record<string, string>): string {
  if (!bindings || !value) return value;
  if (bindings[value]) return bindings[value];
  const trimmed = value.trim();
  if (bindings[trimmed]) return bindings[trimmed];
  return value;
}

// ─── Action Executor ────────────────────────────────────────────────────

/**
 * Exécute une action Playwright pour une étape donnée.
 */
export { executeAction as executeStepAction };

export async function executeAction(
  page: Page,
  step: ExecutionStep & { locatorStrategy?: string },
  options: ActionOptions,
): Promise<void> {
  const timeout = options.stepTimeout ?? 15000;
  const action = step.action.toUpperCase();
  const target = step.target;

  // Résoudre les bindings dans le target
  const resolvedTarget = resolveBindingValue(target, options.bindings);

  switch (action) {
    case "NAVIGATE": {
      let url = resolvedTarget;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = options.baseUrl.replace(/\/$/, "") + (url.startsWith("/") ? url : "/" + url);
      }
      await page.goto(url, { timeout, waitUntil: "domcontentloaded" });
      break;
    }

    case "FILL": {
      const locator = buildLocator(page, resolvedTarget, step.locatorStrategy);
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
      const ms = parseInt(resolvedTarget, 10);
      if (!isNaN(ms)) {
        await page.waitForTimeout(ms);
      } else {
        const locator = buildLocator(page, resolvedTarget, step.locatorStrategy);
        await locator.waitFor({ state: "visible", timeout });
      }
      break;
    }

    default:
      throw new Error(`Action non supportée: ${action}`);
  }
}
