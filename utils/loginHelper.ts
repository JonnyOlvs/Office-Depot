import { Page } from '@playwright/test';
import { getLoginCredentialsFromInputRegresion } from './csv';
import { UsuariosLogin } from '../pages/UsuariosLogin';
import { assertNoMantenimiento } from './mantenimiento';

/**
 * Ejecuta el flujo de login estándar: ir a baseURL, clic en Inicia sesión,
 * rellenar user y password con la primera fila de data/inputRegresion.csv, e Iniciar sesión.
 * Falla si la página muestra mensaje de mantenimiento (503).
 */
export async function loginGeneralPage(page: Page): Promise<void> {
  const { user, password } = getLoginCredentialsFromInputRegresion();
  await page.goto('/');
  await assertNoMantenimiento(page);
  const usuariosLogin = new UsuariosLogin(page);
  await usuariosLogin.login(user, password);
}
