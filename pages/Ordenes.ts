import { Page } from '@playwright/test';
import { assertNoMantenimiento } from '../utils/mantenimiento';

/**
 * Módulo: Órdenes.
 * Page Object para el flujo de compra y generación de orden (búsqueda por SKU, carrito, pago PayPal, obtener número de orden).
 */
export class Ordenes {
  /** Selectores web para el flujo de órdenes (búsqueda, carrito, checkout, PayPal). */
  private readonly fields = {
    inputArticulo: "input[id='js-site-search-input']",
    listCoincidencias: "//div[contains(text(),'Caja de Gises Blancos Vinci 150 piezas')]",
    buttonHomeCP: "div[id='changeCPHeader']",
    radioButtonCPLocal: "(//input[@id=//label[contains(.,'14100')]/@for])[2]",
    radioButtonCPForaneo: "(//input[@id=//label[contains(.,'64000')]/@for])[2]",
    buttonCloseCP: "button[id='closeListAddres']",
    objectProductoBusqueda: "(//div[@class='product-cnt clearfix'])[1]",
    buttonSelectorCantidad: "div#flecha-cantidad-mb",
    buttonEnvioDomicilio: "//div[text()='Domicilio']",
    buttonEnvioExpress: "//div[contains(text(),'Express') or contains(text(),'Exprés')]",
    buttonEnvioTienda: "//div[text()='Tienda']",
    buttonAnadirCarrito: "button[id='addToCartButton']",
    buttonGarantia: "(//button[contains(text(),'Continuar sin protección')])[2]",
    buttonCarrito: "div[class='glyphicon-carrito']",
    buttonFinalizarPedido: "a[class='submit btn btn-secondary-theme font-bold']",
    buttonVerDirecciones: "div[id='show-address-saved']",
    buttonContinuarDirecciones: "button[class='btn-changeDirection content-button']",
    buttonContinuarPago: "button[id='selectDeliveryAddressStepDesktop']",
    radioButtonPaypal: "input[id='paypal']",
    buttonPagarPaypal: "input[id='submitPaypal']",
    inputCorreoPaypal: "input[id='email']",
    buttonSiguiente: "button[id='btnNext']",
    inputPSWPaypal: "input[id='password']",
    buttonIniciarSesionPaypal: "button[id='btnLogin']",
    buttonContinuarPedido: "//button[text()='Continuar y revisar pedido']",
    buttonFinalizarCompra: "button[id='lastInTheForm123']",
    buttonSeguirBusando: "a[class='continue-searching btn btn-rojo-theme btn-block ']",
    buttonMiCuenta: "div[class='myAccountLinksHeader miCuenta']",
    buttonMisPedidos: "(//span[text()='Mis Pedidos'])[1]",
    labelOrden: "(//span[@class='right font-bold'])[1]",
  };

  constructor(private readonly page: Page) {}

  private async delay(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Selector dinámico para cantidad en el dropdown (li con data-valor).
   */
  private selectorCantidadLi(cantidad: string): string {
    return `ul#elementos-select-mb li[data-valor='${cantidad}']`;
  }

  private async existeElemento(selector: string, timeout = 2000): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Selecciona cantidad en el dropdown. Si cantidad es 1 o vacío, no hace nada.
   */
  private async selectCantidad(cantidad: string): Promise<void> {
    const c = String(cantidad || '1').trim();
    if (c === '1') return;
    await this.page.locator(this.fields.buttonSelectorCantidad).click();
    await this.delay(1000);
    await this.page.locator(this.selectorCantidadLi(c)).click();
    await this.delay(1000);
  }

  /**
   * Después de buttonFinalizarPedido: siempre hace click en buttonVerDirecciones, luego selecciona CP según columna G
   * (Local 14100 si G no está marcada, Foráneo 64000 si G está marcada), click en buttonContinuarDirecciones y buttonContinuarPago.
   */
  private async seleccionarDireccionEnCheckout(foraneo: boolean): Promise<void> {
    await this.page.locator(this.fields.buttonVerDirecciones).waitFor({ state: 'visible', timeout: 15000 });
    await this.delay(500);
    await this.page.locator(this.fields.buttonVerDirecciones).click();
    await this.delay(2000);
    const selectorRadio = foraneo ? this.fields.radioButtonCPForaneo : this.fields.radioButtonCPLocal;
    await this.page.locator(selectorRadio).waitFor({ state: 'visible', timeout: 10000 });
    await this.delay(300);
    await this.page.locator(selectorRadio).click();
    await this.delay(500);
    await this.page.locator(this.fields.buttonContinuarDirecciones).click();
    await this.delay(1000);
    await this.page.locator(this.fields.buttonContinuarPago).click();
    await this.delay(1000);
  }

  /**
   * Sin login: busca SKU, añade al carrito y llega hasta el click en "Finalizar Pedido" (pantalla de checkout).
   * Para uso en TC_UYL_002 (registro desde checkout). tipoEnvio por defecto domicilio.
   */
  async llevarHastaFinalizarPedidoSinLogin(sku: string, cantidad: string): Promise<void> {
    await assertNoMantenimiento(this.page);
    const inputBusqueda = this.page.locator(this.fields.inputArticulo);
    await inputBusqueda.click();
    await inputBusqueda.clear();
    await inputBusqueda.pressSequentially(sku, { delay: 50 });
    await this.delay(800);
    // Búsqueda original con Enter (temporalmente deshabilitada):
    // await this.page.keyboard.press('Enter');
    // await this.delay(3000);
    // Nuevo flujo temporal: esperar coincidencias y seleccionar la primera opción de la lista
    const coincidencia = this.page.locator(this.fields.listCoincidencias).first();
    await coincidencia.waitFor({ state: 'visible', timeout: 8000 });
    await coincidencia.click();
    await this.delay(3000);
    await this.page.locator(this.fields.objectProductoBusqueda).click();
    await this.delay(3000);
    await this.selectCantidad(cantidad);
    const locatorEnvio = this.page.locator(this.fields.buttonEnvioDomicilio);
    await locatorEnvio.waitFor({ state: 'visible', timeout: 10000 });
    await this.delay(300);
    await locatorEnvio.click();
    await this.page.locator(this.fields.buttonAnadirCarrito).click();
    await this.delay(2000);
    const hayGarantia = await this.existeElemento(this.fields.buttonGarantia);
    if (hayGarantia) {
      await this.page.locator(this.fields.buttonGarantia).click();
    }
    await this.page.locator(this.fields.buttonCarrito).click();
    await this.page.locator(this.fields.buttonFinalizarPedido).click();
    await this.delay(2000);
  }

  private async pasoBusquedaSkuEnter(sku: string): Promise<void> {
    await assertNoMantenimiento(this.page);
    const inputBusqueda = this.page.locator(this.fields.inputArticulo);
    await inputBusqueda.click();
    await inputBusqueda.clear();
    await inputBusqueda.pressSequentially(sku, { delay: 50 });
    await this.delay(800);
    // Búsqueda original con Enter (temporalmente deshabilitada):
    // await this.page.keyboard.press('Enter');
    // await this.delay(3000);
    // Nuevo flujo temporal: esperar coincidencias y seleccionar la primera opción de la lista
    const coincidencia = this.page.locator(this.fields.listCoincidencias).first();
    await coincidencia.waitFor({ state: 'visible', timeout: 8000 });
    await coincidencia.click();
    await this.delay(3000);
  }

  private async pasoProductoCantidadYEnvio(
    cantidad: string,
    tipoEnvio: 'domicilio' | 'express' | 'tienda',
  ): Promise<void> {
    //await this.page.locator(this.fields.objectProductoBusqueda).click();
    await this.delay(3000);
    await this.selectCantidad(cantidad);
    const botonEnvio =
      tipoEnvio === 'domicilio'
        ? this.fields.buttonEnvioDomicilio
        : tipoEnvio === 'express'
          ? this.fields.buttonEnvioExpress
          : this.fields.buttonEnvioTienda;
    const locatorEnvio = this.page.locator(botonEnvio);
    await locatorEnvio.waitFor({ state: 'visible', timeout: 10000 });
    await this.delay(300);
    await locatorEnvio.click();
  }

  private async pasoAnadirCarritoYGarantia(): Promise<void> {
    await this.page.locator(this.fields.buttonAnadirCarrito).click();
    await this.delay(2000);
    const hayGarantia = await this.existeElemento(this.fields.buttonGarantia);
    if (hayGarantia) {
      await this.page.locator(this.fields.buttonGarantia).click();
    }
  }

  private async pasoCarritoYFinalizarPedido(): Promise<void> {
    await this.page.locator(this.fields.buttonCarrito).click();
    await this.page.locator(this.fields.buttonFinalizarPedido).click();
    await this.delay(2000);
  }

  private async pasoRadioPaypalYClickPagar(): Promise<void> {
    await this.page.locator(this.fields.radioButtonPaypal).click();
    await this.page.locator(this.fields.buttonPagarPaypal).click();
  }

  private async pasoPaypalLoginYFinalizarCompra(): Promise<void> {
    //const paypalEmail = 'angelica.concepcion@officedepot.com.mx';
    //const paypalPassword = 'PONCHIS26';
    const paypalEmail = 'compraspetco@gmail.com';
    const paypalPassword = '123456789';
    await this.page.locator(this.fields.inputCorreoPaypal).fill(paypalEmail);
    await this.page.locator(this.fields.buttonSiguiente).click();
    await this.page.locator(this.fields.inputPSWPaypal).fill(paypalPassword);
    await this.page.locator(this.fields.buttonIniciarSesionPaypal).click();
    await this.page.locator(this.fields.buttonContinuarPedido).click();
    await this.delay(5000);
    await this.page.locator(this.fields.buttonFinalizarCompra).click();
    await this.page.locator(this.fields.buttonSeguirBusando).click();
  }

  private async pasoMisPedidosDesdeHeader(): Promise<void> {
    await this.page.locator(this.fields.buttonMiCuenta).click();
    await this.page.locator(this.fields.buttonMisPedidos).click();
  }

  private async pasoLeerNumeroOrdenConReintentos(): Promise<string> {
    let ordenNumero = '';
    for (let intento = 1; intento <= 5; intento++) {
      ordenNumero = (await this.page.locator(this.fields.labelOrden).innerText()).trim();
      if (ordenNumero) break;
      await this.delay(3000);
      await this.page.reload({ waitUntil: 'load' });
      await this.delay(3000);
      await this.page.locator(this.fields.buttonMiCuenta).click();
      await this.page.locator(this.fields.buttonMisPedidos).click();
    }
    return ordenNumero;
  }

  /**
   * Flujo completo para generar una orden: búsqueda por SKU, añadir al carrito, checkout con PayPal, obtener número de orden.
   * Requiere que la página esté cargada y el usuario ya logueado.
   * sku: valor a buscar (columna C o E según CSV). tipoEnvio: domicilio (F), express (H) o tienda (I).
   * foraneo (G): si true, en checkout selecciona CP Foráneo (64000); si false, CP Local (14100).
   */
  async generarOrden(datosFila: {
    sku: string;
    cantidad: string;
    tipoEnvio: 'domicilio' | 'express' | 'tienda';
    foraneo?: boolean;
  }): Promise<string> {
    const { sku, cantidad, tipoEnvio, foraneo = false } = datosFila;
    await this.pasoBusquedaSkuEnter(sku);
    await this.pasoProductoCantidadYEnvio(cantidad, tipoEnvio);
    await this.pasoAnadirCarritoYGarantia();
    await this.pasoCarritoYFinalizarPedido();
    await this.seleccionarDireccionEnCheckout(foraneo);
    await this.pasoRadioPaypalYClickPagar();
    await this.pasoPaypalLoginYFinalizarCompra();
    await this.pasoMisPedidosDesdeHeader();
    return await this.pasoLeerNumeroOrdenConReintentos();
  }
}
