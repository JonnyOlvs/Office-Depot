import { Page, expect } from '@playwright/test';

/** Selector del mensaje de página en mantenimiento (503). */
export const SELECTOR_PAGINA_MANTENIMIENTO =
  "//h1[contains(text(),'503: This service is down for maintenance')]";

/**
 * Falla el test si la página muestra el mensaje de mantenimiento (503).
 * Llamar después de page.goto() o al inicio de un flujo que dependa de que el sitio esté disponible.
 */
export async function assertNoMantenimiento(page: Page): Promise<void> {
  await expect(
    page.locator(SELECTOR_PAGINA_MANTENIMIENTO),
    { message: 'La página está en mantenimiento (503). No se puede ejecutar el flujo.' }
  ).not.toBeVisible({ timeout: 5000 });
}
