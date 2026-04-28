import { defineConfig, devices } from '@playwright/test';

// Desktop Chrome sin deviceScaleFactor para poder usar viewport: null (no son compatibles)
const { deviceScaleFactor: _ds, ...desktopChrome } = devices['Desktop Chrome'];

/**
 * Configuración de Playwright para pruebas de regresión.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  tsconfig: './tsconfig.playwright.json',
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /** Solo reintenta el test que falló (1 vez en CI). */
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['allure-playwright', { outputFolder: 'allure-results', detail: true }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://ecqa.officedepot.com.mx',
    headless: process.env.CI === 'true' || process.env.HEADLESS === 'true',
    /** En CI `null` suele verse como móvil; tamaño fijo evita layout drawer. */
    viewport:
      process.env.CI === 'true' || process.env.HEADLESS === 'true'
        ? { width: 1920, height: 1080 }
        : null,
    actionTimeout: 60 * 1000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...desktopChrome,
        viewport:
          process.env.CI === 'true' || process.env.HEADLESS === 'true'
            ? { width: 1920, height: 1080 }
            : null,
        launchOptions: {
          args:
            process.env.CI === 'true' || process.env.HEADLESS === 'true'
              ? []
              : ['--start-maximized'],
        },
      },
    },
  ],
  timeout: 0, // sin límite de tiempo para el test completo
  expect: { timeout: 10 * 1000 },
});
