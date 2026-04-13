import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';
import { assertNoMantenimiento } from '../../utils/mantenimiento';

test.describe('@visual Home — Percy', () => {
  test('snapshot de la página de inicio', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await assertNoMantenimiento(page);
    await percySnapshot(page, 'Office Depot - Home QA');
  });
});
