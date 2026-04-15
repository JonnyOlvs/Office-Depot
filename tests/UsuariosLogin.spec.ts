import { test, expect } from '@playwright/test';
import { loginGeneralPage } from '../utils/loginHelper';
import { UsuariosLogin } from '../pages/UsuariosLogin';

/**
 * Módulo: Usuarios y Login
 *
 * Formato de nombres (usar en todos los specs):
 * - test.describe: "@mod_<nombre_modulo>" + nombre legible. Ej: @mod_usuarios_login Usuarios y Login
 *   (nombre_modulo = nombre principal en minúsculas, espacios → _)
 * - test: "@TC_<siglas>_<consecutivo> <nombre del escenario>". Ej: @TC_UYL_001 ...
 *   (siglas = iniciales del módulo, ej. Usuarios y Login → UYL)
 *
 * Selectores: se declaran en pages/UsuariosLogin.ts (fields) y se usan en métodos del Page. En el spec solo se llama a esos métodos (ej. usuariosLogin.crearCuentaDesdeLogin()).
 * Login: loginGeneralPage(page). Para empezar ya logueado: test desde '../fixtures/loggedIn', { loggedInPage }.
 *
 * Ejecutar: npx playwright test UsuariosLogin.spec.ts
 * Un TC:    npx playwright test UsuariosLogin.spec.ts -g "@TC_UYL_003"
 *
 * Los TC son independientes (sin describe.serial): un fallo no cancela los demás; el reintento solo aplica al test fallido (ver retries en playwright.config).
 */
test.describe('@mod_usuarios_login Usuarios y Login', () => {
  test('@TC_UYL_001 Usuario General Crear Cuenta desde Login', async ({ page }) => {
    const usuariosLogin = new UsuariosLogin(page);
    await usuariosLogin.crearCuentaDesdeLogin();
  });

  test('@TC_UYL_002 Usuario General Registro desde el Checkout', async ({ page }) => {
    const usuariosLogin = new UsuariosLogin(page);
    await usuariosLogin.crearCuentaDesdeCheckout();
  });

  test('@TC_UYL_003 Login Normal', async ({ page }) => {
    await loginGeneralPage(page);
    await expect(page.locator('body')).toBeVisible();
  });

  test('@TC_UYL_004 Restablecer password Web', async ({ page }) => {
    const usuariosLogin = new UsuariosLogin(page);
    await usuariosLogin.restablecerPasswordWeb();
  });

  test('@TC_UYL_005 Correo recuperación de contraseña', async ({ page }) => {
    
  });

  test('@TC_UYL_006 Búsqueda y navegación', async ({ page }) => {
    
  });

  test('@TC_UYL_007 Categorías', async ({ page }) => {
    await loginGeneralPage(page);
    const usuariosLogin = new UsuariosLogin(page);
    await usuariosLogin.validarLabelsMenuYEntrarSubmenusCategorias();
  });
});
