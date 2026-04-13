import { test, expect } from '@playwright/test';
import { readInputRegresion } from '../utils/csv';
import { assertNoMantenimiento } from '../utils/mantenimiento';
import { validarFilaOrden } from '../utils/ordenesValidacion';
import { guardarOrdenGenerada } from '../utils/ordenesGuardado';
import { UsuariosLogin } from '../pages/UsuariosLogin';
import { Ordenes } from '../pages/Ordenes';

/**
 * Módulo: Órdenes
 *
 * Cada fila de data/inputRegresion.csv define un caso: user, password, SKU (C) o Cat Ext (E), cantidad (D),
 * y exactamente una opción de envío: F (Domicilio), H (Express), I (Tienda).
 * La validación de todas las filas se ejecuta antes de correr ningún test; si alguna falla, se reportan todos los errores al inicio.
 *
 * Ejecutar: npx playwright test Ordenes.spec.ts
 */
const todasLasFilas = readInputRegresion();
const filasEjecutables = todasLasFilas.filter((row) => {
  const tieneLogin = (row.user ?? '').trim() !== '' && (row.password ?? '').trim() !== '';
  const tieneSku = (row.sku ?? '').trim() !== '' || (row.catExtValor ?? '').trim() !== '';
  const tieneCantidad = (row.cantidad ?? '').trim() !== '';
  return tieneLogin && tieneSku && tieneCantidad;
});

/** Validación previa: se ejecuta al cargar y se falla en beforeAll para no romper el IDE. */
const erroresValidacion: { fila: number; mensaje: string }[] = [];
const filasValidas: (typeof filasEjecutables)[number][] = [];
const validadasPorFila: ReturnType<typeof validarFilaOrden>[] = [];
for (let i = 0; i < filasEjecutables.length; i++) {
  try {
    const v = validarFilaOrden(filasEjecutables[i]);
    filasValidas.push(filasEjecutables[i]);
    validadasPorFila.push(v);
  } catch (e) {
    erroresValidacion.push({ fila: i + 1, mensaje: e instanceof Error ? e.message : String(e) });
  }
}

test.describe.serial('@mod_ordenes Órdenes', () => {
  test.beforeAll(() => {
    // Si hay errores y además hay filas válidas, fallar al inicio para no ejecutar tests válidos con datos inválidos en el CSV
    if (erroresValidacion.length > 0 && filasValidas.length > 0) {
      const resumen = erroresValidacion
        .map((e) => `  Fila ${e.fila}: ${e.mensaje}`)
        .join('\n');
      throw new Error(`Validación previa fallida (${erroresValidacion.length} fila(s) con error):\n${resumen}`);
    }
  });

  // Si todas las filas fallaron validación, registrar un test que falle para mostrar el error (evita "No tests found")
  if (filasValidas.length === 0 && filasEjecutables.length > 0) {
    test('@TC_ORD_001 Validación CSV (todas las filas tienen errores)', () => {
      const resumen = erroresValidacion
        .map((e) => `  Fila ${e.fila}: ${e.mensaje}`)
        .join('\n');
      throw new Error(`Validación previa fallida (${erroresValidacion.length} fila(s) con error):\n${resumen}`);
    });
  }

  filasValidas.forEach((row, index) => {
    const validada = validadasPorFila[index];
    test(`@TC_ORD_001 Generar orden (fila ${index + 1}: ${validada.resumen})`, async ({ page }) => {
      await page.goto('/');
      await assertNoMantenimiento(page);
      const usuariosLogin = new UsuariosLogin(page);
      await usuariosLogin.login(row.user, row.password);

      const ordenes = new Ordenes(page);
      const numeroOrden = await ordenes.generarOrden({
        sku: validada.sku,
        cantidad: validada.cantidad,
        tipoEnvio: validada.tipoEnvio,
        foraneo: row.foraneo,
      });

      expect(numeroOrden, 'Debe generarse un número de orden').toBeTruthy();
      guardarOrdenGenerada(numeroOrden, {
        user: row.user,
        sku: validada.sku,
        cantidad: validada.cantidad,
      });
    });
  });
});
