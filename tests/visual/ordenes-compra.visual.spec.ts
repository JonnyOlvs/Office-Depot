import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';
import { assertNoMantenimiento } from '../../utils/mantenimiento';

/** Mismos selectores que `Ordenes` (búsqueda en sitio). Sin checkout: evita fallos por inventario / flujo de pago. */
const INPUT_BUSQUEDA = "input[id='js-site-search-input']";
const BTN_BUSCAR = "button[id='js_search_button']";
const PRIMER_RESULTADO = "(//div[@class='product-cnt clearfix'])[1]";

test.describe('@visual Órdenes — búsqueda Percy', () => {
  test('resultados al buscar SKU 1', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await assertNoMantenimiento(page);
    await page.locator(INPUT_BUSQUEDA).waitFor({ state: 'visible', timeout: 15000 });
    await page.locator(INPUT_BUSQUEDA).fill('1');
    await page.locator(BTN_BUSCAR).click();
    await page.locator(PRIMER_RESULTADO).waitFor({ state: 'visible', timeout: 60000 });
    await percySnapshot(page, 'Office Depot - Resultados búsqueda SKU 1');
  });
});
