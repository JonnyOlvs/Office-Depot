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
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://ecqa.officedepot.com.mx',
    headless: process.env.CI === 'true' || process.env.HEADLESS === 'true',
    viewport: null,
    actionTimeout: 60 * 1000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...desktopChrome,
        viewport: null,
        launchOptions: {
          args: ['--start-maximized'],
        },
      },
    },
  ],
  timeout: 0, // sin límite de tiempo para el test completo
  expect: { timeout: 10 * 1000 },
});
