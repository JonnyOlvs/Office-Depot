import { test, expect } from '@playwright/test';
import percySnapshot from '@percy/playwright';
import { assertNoMantenimiento } from '../../utils/mantenimiento';
import { generarDatosCrearCuenta } from '../../utils/datosAleatorios';

/** TC_UYL_001 visual; Percy: `PERCY_TOKEN` + `npm run test:visual:usuarios` (sin `percy exec` no sube snapshots). */
const SEL = {
  buttonIniciaSesion: "xpath=(//a[@aria-label='login'])[1]",
  buttonCrearCuenta: "a[id='loginbuttonLinkRegister']",
  inputNombre: "input[id='firstNameMaterial']",
  inputApellidoPa: "input[id='middleNameMaterial']",
  inputApellidoMa: "input[id='lastNameMaterial']",
  inputTelefono: "input[id='phoneMaterial']",
  inputCorreoElec: "input[id='emailMaterial']",
  inputContrasena: "input[id='passwordMaterial']",
  checkBoxTerminos: "(//span[@class='checkmark'])[1]",
  buttonCrearCuentaRegistro: "button[id='registerButtonMaterial']",
  buttonMiCuenta: "div[class='myAccountLinksHeader miCuenta']",
} as const;

test.describe('@visual Usuarios y Login — TC_UYL_001 Percy', () => {
  test('crear cuenta: home, formulario registro, inicio logueado', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await assertNoMantenimiento(page);
    await percySnapshot(page, 'OD-UYL001-01-pagina-principal');

    const { nombre, apellidoPaterno, apellidoMaterno, telefono, correo, contraseña } = generarDatosCrearCuenta();

    await page.locator(SEL.buttonIniciaSesion).waitFor({ state: 'visible', timeout: 15000 });
    await page.locator(SEL.buttonIniciaSesion).click();

    await page.locator(SEL.buttonCrearCuenta).waitFor({ state: 'visible', timeout: 15000 });
    await page.locator(SEL.buttonCrearCuenta).click();

    await page.locator(SEL.inputNombre).waitFor({ state: 'visible', timeout: 15000 });
    await percySnapshot(page, 'OD-UYL001-02-formulario-registro');

    await page.locator(SEL.inputNombre).fill(nombre);
    await page.locator(SEL.inputApellidoPa).fill(apellidoPaterno);
    await page.locator(SEL.inputApellidoMa).fill(apellidoMaterno);
    await page.locator(SEL.inputTelefono).fill(telefono);
    await page.locator(SEL.inputCorreoElec).fill(correo);
    await page.locator(SEL.inputContrasena).fill(contraseña);
    await page.locator(SEL.checkBoxTerminos).click();
    await page.locator(SEL.buttonCrearCuentaRegistro).click();

    await page.waitForLoadState('domcontentloaded');
    await page.locator(SEL.buttonMiCuenta).waitFor({ state: 'visible', timeout: 45000 });
    await expect(page.locator(SEL.buttonMiCuenta)).toBeVisible();
    await percySnapshot(page, 'OD-UYL001-03-inicio-logueado-logo');
  });
});
