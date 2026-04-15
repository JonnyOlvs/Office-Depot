import { Page, expect } from '@playwright/test';
import { generarDatosCrearCuenta } from '../utils/datosAleatorios';
import { assertNoMantenimiento } from '../utils/mantenimiento';
import { Ordenes } from './Ordenes';

/**
 * Módulo: Usuarios y Login.
 * Selectores y acciones para los escenarios de login, registro, recuperación de contraseña, etc.
 * user/password se obtienen de data/inputRegresion.csv.
 */
export class UsuariosLogin {
  /** Selectores del módulo Usuarios y Login. Declara aquí todos los identificadores web. */
  private readonly fields = {
    // Login
    buttonIniciaSesion: "xpath=(//a[@aria-label='login'])[1]",
    inputCorreo: "input[id='usernamelogin']",
    inputContrasena: "input[id='j_passwordexpress']",
    buttonIniciarSesion: "button[id='loginButtonMaterial']",
    buttonCrearCuenta: "a[id='loginbuttonLinkRegister']",
    inputNombre: "input[id='firstNameMaterial']",
    inputApellidoPa: "input[id='middleNameMaterial']",
    inputApellidoMa: "input[id='lastNameMaterial']",
    inputTelefono: "input[id='phoneMaterial']",
    inputCorreoElec: "input[id='emailMaterial']",
    buttonCrearContrasena: "input[id='passwordMaterial']",
    checkBoxTerminos: "(//span[@class='checkmark'])[1]",
    buttonCrearCuentaRegistro: "button[id='registerButtonMaterial']",
    imgLogo: "(//img[@title='Logo-Normal.png'])[1]",
    imgLogoCheckOut: "(//a[@href='/officedepot/en/'])[2]",
    buttonMiCuenta: "div[class='myAccountLinksHeader miCuenta']",
    buttonContrasena: "(//span[text()='Contraseña'])[1]",
    inputContrasenaActual: "input[id='profile.currentPassword']",
    inputNuevaContrasena: "input[id='profile-newPassword']",
    inputConfirmContrasena: "input[id='profile.checkNewPassword']",
    buttonGuardarContrasena: "button[id='form-btn-psw']",
    labelContraActualizada: "//div[contains(text(),'Se ha actualizado correctamente tu contraseña.')]",
    buttonSalir: "(//span[text()='Salir'])[1]",

    //
    inputArticulo: "input[id='js-site-search-input']",
    buttonLupaBusqueda: "button[id='js_search_button']",
    objectProductoBusqueda: "(//div[@class='product-cnt clearfix'])[1]",
    buttonAnadirCarrito: "button[id='addToCartButton']",
    buttonGarantia: "(//button[contains(text(),'Continuar sin protección')])[2]",
    buttonEnvioDomicilio : "//div[text()='Domicilio']",
    buttonCarrito: "div[class='glyphicon-carrito']",
    buttonFinalizarPedido: "a[class='submit btn btn-secondary-theme font-bold']",
    radioButtonContraEntrega: "input[id='payondelivery']",
    radioButtonPaypal: "input[id='paypal']",
    buttonPagarPaypal: "input[id='submitPaypal']",
    inputCorreoPaypal: "input[id='email']",
    inputPSWPaypal: "input[id='password']",
    buttonSiguiente: "button[id='btnNext']",
    buttonIniciarSesionPaypal: "button[id='btnLogin']",
    buttonContinuarPedido: "//button[text()='Continuar y revisar pedido']",
    buttonFinalizarCompra: "button[id='lastInTheForm123']",
    buttonSeguirBusando: "a[class='continue-searching btn btn-rojo-theme btn-block ']",
    buttonMisPedidos: "(//span[text()='Mis Pedidos'])[1]",
    labelOrden: "(//span[@class='right font-bold'])[1]",
    buttonSelectorCantidad: "div#flecha-cantidad-mb",

    //menus

    labelCategorias: "//li[contains(@class,'js-btn-menu')][.//a[contains(text(),'Categorías')]]",
    labelComputo: "(//a[contains(text(),'Cómputo')])[1]",
    labelServicios: "(//a[contains(text(),'Servicios')])[1]",
    labelProgramaLealtad: "(//a[contains(text(),'Programa de Lealtad')])[1]",
    labelImpresiones: "(//a[contains(text(),'Facturación')])[1]",
    labelFacturacion: "(//a[contains(text(),'Facturación')])[1]",
    labelOutlet: "(//a[contains(text(),'Outlet')])[1]",
    labelTiendas: "(//a[contains(text(),'Tiendas')])[1]",
    labelAyuda: "(//a[contains(text(),'Ayuda')])[1]",
    labelSubMenuComputo: "(//span[contains(@class,'txt-menu-option')][.//span[normalize-space()='Cómputo']])[2]",
    labelSubMenuMuebles: "(//span[contains(@class,'txt-menu-option')][.//span[normalize-space()='Muebles y Decoración']])[2]",
    labelSubMenuEscolares: "(//span[contains(@class,'txt-menu-option')][.//span[normalize-space()='Escolares Arte y Diseño']])[2]",
    labelSubMenuImpresion: "(//span[contains(@class,'txt-menu-option')][.//span[normalize-space()='Impresión']])[2]",
    labelSubMenuElectronica: "(//span[contains(@class,'txt-menu-option')][.//span[normalize-space()='Electrónica']])[2]",
    labelSubMenuOficina: "(//span[contains(@class,'txt-menu-option')][.//span[normalize-space()='Oficina']])[2]",
    labelSubMenuPapel: "(//span[contains(@class,'txt-menu-option')][.//span[normalize-space()='Papel']])[2]",
    labelSubMenuLibros: "(//span[contains(@class,'txt-menu-option')][.//span[normalize-space()='Libros y Viajes']])[2]",
    labelSubMenuProductosRS: "(//span[contains(@class,'txt-menu-option')][.//span[normalize-space()='Productos RadioShack']])[2]",
  };

  constructor(private readonly page: Page) {}

  private async delay(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Home ya logueado: el primer `imgLogo` en XPath a veces está en DOM pero Playwright lo marca `hidden` (móvil, duplicados).
   * La cabecera «Mi cuenta» sí suele ser visible y equivale a sesión iniciada.
   */
  private async esperarHomeConSesionIniciada(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.locator(this.fields.buttonMiCuenta).waitFor({ state: 'visible', timeout: 60000 });
    await expect(this.page.locator(this.fields.buttonMiCuenta)).toBeVisible();
  }

  /** Desktop: span XPath; móvil/drawer: enlace o texto «Contraseña». */
  private async clickMenuItemContraseña(): Promise<void> {
    await this.delay(800);
    const legacy = this.page.locator(this.fields.buttonContrasena);
    if (await legacy.isVisible().catch(() => false)) {
      await legacy.click();
      return;
    }
    const link = this.page.getByRole('link', { name: 'Contraseña' });
    if ((await link.count()) > 0 && (await link.first().isVisible().catch(() => false))) {
      await link.first().click();
      return;
    }
    const candidates = this.page.getByText('Contraseña', { exact: true });
    const n = await candidates.count();
    for (let i = 0; i < n; i++) {
      const c = candidates.nth(i);
      if (await c.isVisible().catch(() => false)) {
        await c.click();
        return;
      }
    }
    throw new Error('No se encontró «Contraseña» visible en el menú Mi cuenta.');
  }

  /** Desktop: span Salir; menú móvil: mismo texto. */
  private async clickMenuItemSalir(): Promise<void> {
    await this.delay(500);
    const legacy = this.page.locator(this.fields.buttonSalir);
    if (await legacy.isVisible().catch(() => false)) {
      await legacy.click();
      return;
    }
    const candidates = this.page.getByText('Salir', { exact: true });
    const n = await candidates.count();
    for (let i = 0; i < n; i++) {
      const c = candidates.nth(i);
      if (await c.isVisible().catch(() => false)) {
        await c.click();
        return;
      }
    }
    throw new Error('No se encontró «Salir» visible en el menú Mi cuenta.');
  }

  /**
   * Login con user y password (p. ej. desde getLoginCredentialsFromInputRegresion() o fila del CSV).
   */
  async login(user: string, password: string): Promise<void> {
    await this.page.waitForSelector(this.fields.buttonIniciaSesion);
    await this.page.locator(this.fields.buttonIniciaSesion).click();

    await this.page.waitForSelector(this.fields.inputCorreo);
    await this.page.locator(this.fields.inputCorreo).fill(user);

    await this.page.waitForSelector(this.fields.inputContrasena);
    await this.page.locator(this.fields.inputContrasena).fill(password);

    await this.page.waitForSelector(this.fields.buttonIniciarSesion);
    await this.page.locator(this.fields.buttonIniciarSesion).click();
  }

  /**
   * TC_UYL_001 — Usuario General Crear Cuenta desde Login.
   * Nombre/apellidos aleatorios (1 palabra), teléfono 777XXXXXXX, correo automatizacion_regresion_XXXXX@hotmail.com, contraseña fija.
   * Falla si la página muestra mensaje de mantenimiento (503).
   */
  async crearCuentaDesdeLogin(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
    await assertNoMantenimiento(this.page);
    const { nombre, apellidoPaterno, apellidoMaterno, telefono, correo, contraseña } = generarDatosCrearCuenta();

    await this.page.waitForSelector(this.fields.buttonIniciaSesion);
    await this.page.locator(this.fields.buttonIniciaSesion).click();

    await this.page.waitForSelector(this.fields.buttonCrearCuenta);
    await this.page.locator(this.fields.buttonCrearCuenta).click();

    await this.page.waitForSelector(this.fields.inputNombre);
    await this.page.locator(this.fields.inputNombre).fill(nombre);

    await this.page.waitForSelector(this.fields.inputApellidoPa);
    await this.page.locator(this.fields.inputApellidoPa).fill(apellidoPaterno);

    await this.page.waitForSelector(this.fields.inputApellidoMa);
    await this.page.locator(this.fields.inputApellidoMa).fill(apellidoMaterno);

    await this.page.waitForSelector(this.fields.inputTelefono);
    await this.page.locator(this.fields.inputTelefono).fill(telefono);

    await this.page.waitForSelector(this.fields.inputCorreoElec);
    await this.page.locator(this.fields.inputCorreoElec).fill(correo);

    await this.page.waitForSelector(this.fields.buttonCrearContrasena);
    await this.page.locator(this.fields.buttonCrearContrasena).fill(contraseña);

    await this.page.waitForSelector(this.fields.checkBoxTerminos);
    await this.page.locator(this.fields.checkBoxTerminos).click();

    await this.page.waitForSelector(this.fields.buttonCrearCuentaRegistro);
    await this.page.locator(this.fields.buttonCrearCuentaRegistro).click();

    await this.esperarHomeConSesionIniciada();
  }

  /** Contraseña nueva usada al restablecer (TC_UYL_004). */
  private readonly NUEVA_CONTRASENA_RESTABLECER = '87654321';

  /**
   * TC_UYL_004 — Restablecer password Web.
   * Mismo flujo de registro que TC_UYL_001; tras validar sesión (Mi cuenta): Mi Cuenta → Contraseña,
   * cambia contraseña (actual → 87654321), valida mensaje, sale, inicia sesión con correo + nueva contraseña y valida sesión en home.
   */
  async restablecerPasswordWeb(): Promise<void> {
    await this.page.goto('/');
    await assertNoMantenimiento(this.page);
    const datos = generarDatosCrearCuenta();
    const { nombre, apellidoPaterno, apellidoMaterno, telefono, correo, contraseña } = datos;

    // Mismo flujo que TC_UYL_001 (Crear Cuenta desde Login)
    await this.page.waitForSelector(this.fields.buttonIniciaSesion);
    await this.page.locator(this.fields.buttonIniciaSesion).click();

    await this.page.waitForSelector(this.fields.buttonCrearCuenta);
    await this.page.locator(this.fields.buttonCrearCuenta).click();

    await this.page.waitForSelector(this.fields.inputNombre);
    await this.page.locator(this.fields.inputNombre).fill(nombre);

    await this.page.waitForSelector(this.fields.inputApellidoPa);
    await this.page.locator(this.fields.inputApellidoPa).fill(apellidoPaterno);

    await this.page.waitForSelector(this.fields.inputApellidoMa);
    await this.page.locator(this.fields.inputApellidoMa).fill(apellidoMaterno);

    await this.page.waitForSelector(this.fields.inputTelefono);
    await this.page.locator(this.fields.inputTelefono).fill(telefono);

    await this.page.waitForSelector(this.fields.inputCorreoElec);
    await this.page.locator(this.fields.inputCorreoElec).fill(correo);

    await this.page.waitForSelector(this.fields.buttonCrearContrasena);
    await this.page.locator(this.fields.buttonCrearContrasena).fill(contraseña);

    await this.page.waitForSelector(this.fields.checkBoxTerminos);
    await this.page.locator(this.fields.checkBoxTerminos).click();

    await this.page.waitForSelector(this.fields.buttonCrearCuentaRegistro);
    await this.page.locator(this.fields.buttonCrearCuentaRegistro).click();

    await this.esperarHomeConSesionIniciada();

    // Mi Cuenta → Contraseña
    await this.page.locator(this.fields.buttonMiCuenta).click();
    await this.clickMenuItemContraseña();

    await this.page.locator(this.fields.inputContrasenaActual).waitFor({ state: 'visible', timeout: 10000 });
    const inputContrasenaActual = this.page.locator(this.fields.inputContrasenaActual);
    await inputContrasenaActual.click();
    await inputContrasenaActual.clear();
    await inputContrasenaActual.pressSequentially(datos.contraseña, { delay: 50 });
    await this.delay(600);
    const inputNuevaContrasena = this.page.locator(this.fields.inputNuevaContrasena);
    await inputNuevaContrasena.click();
    await inputNuevaContrasena.clear();
    await inputNuevaContrasena.pressSequentially(this.NUEVA_CONTRASENA_RESTABLECER, { delay: 50 });
    await this.delay(600);
    const inputConfirmContrasena = this.page.locator(this.fields.inputConfirmContrasena);
    await inputConfirmContrasena.click();
    await inputConfirmContrasena.clear();
    await inputConfirmContrasena.pressSequentially(this.NUEVA_CONTRASENA_RESTABLECER, { delay: 50 });
    await this.delay(800);
    await this.page.locator(this.fields.buttonGuardarContrasena).click();

    await this.page.locator(this.fields.labelContraActualizada).waitFor({ state: 'visible', timeout: 15000 });
    await expect(this.page.locator(this.fields.labelContraActualizada)).toBeVisible();

    // Salir y volver a entrar con la nueva contraseña
    await this.page.locator(this.fields.buttonMiCuenta).click();
    await this.clickMenuItemSalir();

    await this.page.locator(this.fields.buttonIniciaSesion).waitFor({ state: 'visible', timeout: 10000 });
    await this.page.locator(this.fields.buttonIniciaSesion).click();
    await this.page.locator(this.fields.inputCorreo).waitFor({ state: 'visible', timeout: 10000 });
    await this.page.locator(this.fields.inputCorreo).fill(correo);
    await this.page.locator(this.fields.inputContrasena).fill(this.NUEVA_CONTRASENA_RESTABLECER);
    await this.page.locator(this.fields.buttonIniciarSesion).click();

    await this.esperarHomeConSesionIniciada();
  }

  /**
   * TC_UYL_002 — Registro desde el Checkout.
   * Sin login: va a home, busca SKU "1", cantidad 1, envío domicilio, llega hasta Finalizar Pedido, luego clic en Crear cuenta,
   * llena el formulario con los mismos identificadores y pasos, y al final valida que se muestre el label/radio de PayPal.
   */
  async crearCuentaDesdeCheckout(): Promise<void> {
    await this.page.goto('/');
    await assertNoMantenimiento(this.page);
    const ordenes = new Ordenes(this.page);
    await ordenes.llevarHastaFinalizarPedidoSinLogin('1', '1');

    const { nombre, apellidoPaterno, apellidoMaterno, telefono, correo, contraseña } = generarDatosCrearCuenta();

    await this.page.waitForSelector(this.fields.buttonCrearCuenta, { timeout: 15000 });
    await this.page.locator(this.fields.buttonCrearCuenta).click();

    await this.page.waitForSelector(this.fields.inputNombre, { timeout: 10000 });
    await this.page.locator(this.fields.inputNombre).fill(nombre);
    await this.page.locator(this.fields.inputApellidoPa).fill(apellidoPaterno);
    await this.page.locator(this.fields.inputApellidoMa).fill(apellidoMaterno);
    await this.page.locator(this.fields.inputTelefono).fill(telefono);
    await this.page.locator(this.fields.inputCorreoElec).fill(correo);
    await this.page.locator(this.fields.buttonCrearContrasena).fill(contraseña);
    await this.page.locator(this.fields.checkBoxTerminos).click();
    await this.page.locator(this.fields.buttonCrearCuentaRegistro).click();

    await this.page.locator(this.fields.imgLogoCheckOut).waitFor({ state: 'visible', timeout: 15000 });
    await this.page.locator(this.fields.imgLogoCheckOut).click();
    await this.page.locator(this.fields.buttonMiCuenta).waitFor({ state: 'visible', timeout: 15000 });
    await expect(this.page.locator(this.fields.buttonMiCuenta)).toBeVisible();
  }

  /**
   * TC_UYL_007 — Categorías.
   * Tras login: valida que existan los labels del menú; luego para cada submenú: mueve el mouse a
   * labelCategorias para desplegar, hace click en el submenú, comprueba que entró, vuelve al inicio
   * y repite para el siguiente.
   */
  async validarLabelsMenuYEntrarSubmenusCategorias(): Promise<void> {
    const labelsMenu = [
      this.fields.labelCategorias,
      this.fields.labelComputo,
      this.fields.labelServicios,
      this.fields.labelProgramaLealtad,
      this.fields.labelImpresiones,
      this.fields.labelFacturacion,
      this.fields.labelOutlet,
      this.fields.labelTiendas,
      this.fields.labelAyuda,
    ] as const;
    for (const selector of labelsMenu) {
      await expect(this.page.locator(selector)).toBeVisible({ timeout: 10000 });
    }

    const submenus = [
      this.fields.labelSubMenuComputo,
      this.fields.labelSubMenuMuebles,
      this.fields.labelSubMenuEscolares,
      this.fields.labelSubMenuImpresion,
      this.fields.labelSubMenuElectronica,
      this.fields.labelSubMenuOficina,
      this.fields.labelSubMenuPapel,
      this.fields.labelSubMenuLibros,
      this.fields.labelSubMenuProductosRS,
    ] as const;

    const locatorCategorias = this.page.locator(this.fields.labelCategorias);

    await this.delay(2500);

    for (let i = 0; i < submenus.length; i++) {
      if (i > 0) {
        await this.page.goto('/');
        await this.delay(1500);
      }
      await locatorCategorias.scrollIntoViewIfNeeded();
      await this.delay(i === 0 ? 800 : 300);
      await locatorCategorias.waitFor({ state: 'visible', timeout: 5000 });
      const box = await locatorCategorias.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await locatorCategorias.hover();
      }
      await locatorCategorias.evaluate((el: HTMLElement) => {
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
      });
      await this.delay(i === 0 ? 800 : 500);
      await locatorCategorias.click();
      await this.delay(i === 0 ? 2500 : 1500);
      const submenuLocator = this.page.locator(submenus[i]);
      await submenuLocator.waitFor({ state: 'visible', timeout: 15000 });
      const urlAntes = this.page.url();
      await submenuLocator.click();
      await this.page.waitForLoadState('domcontentloaded');
      await this.delay(800);
      const urlDespues = this.page.url();
      expect(urlDespues, 'Se debe haber navegado al hacer click en el submenú').not.toBe(urlAntes);
      await this.delay(300);
    }
  }
}
