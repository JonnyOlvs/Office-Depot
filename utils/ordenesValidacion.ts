import type { FlujoPedidosRow } from './csv';

export type TipoEnvio = 'domicilio' | 'express' | 'tienda';

export interface FilaOrdenValida {
  sku: string;
  cantidad: string;
  tipoEnvio: TipoEnvio;
  resumen: string;
  row: FlujoPedidosRow;
}

function tieneValor(s: string): boolean {
  return (s ?? '').trim() !== '';
}

/**
 * Valida que solo una de C (SKU) o E (Cat Ext) tenga valor y devuelve ese SKU.
 * Si ambas tienen valor, lanza error.
 */
function validarYObtenerSku(row: FlujoPedidosRow): string {
  const tieneC = tieneValor(row.sku);
  const tieneE = tieneValor(row.catExtValor);
  if (tieneC && tieneE) {
    throw new Error(
      'Tiene valores en ambas columnas (C=SKU y E=Cat Ext). Solo una debe tener valor.'
    );
  }
  if (!tieneC && !tieneE) {
    throw new Error('Debe haber info en columna C (SKU) o en columna E (Cat Ext) para la búsqueda.');
  }
  return tieneE ? row.catExtValor.trim() : row.sku.trim();
}

/**
 * Valida que exactamente una de F (Domicilio), H (Express), I (Tienda) esté seleccionada.
 */
function validarYObtenerTipoEnvio(row: FlujoPedidosRow): TipoEnvio {
  const n = [row.domicilio, row.express, row.tienda].filter(Boolean).length;
  if (n > 1) {
    throw new Error(
      'Tiene valores en dos o más opciones de envío (F=Domicilio, H=Express, I=Tienda). Solo una puede tener valor.'
    );
  }
  if (n === 0) {
    throw new Error(
      'Debe seleccionarse exactamente una opción de envío: F (Domicilio), H (Express) o I (Tienda).'
    );
  }
  if (row.domicilio) return 'domicilio';
  if (row.express) return 'express';
  return 'tienda';
}

/**
 * Construye el resumen de la fila: todas las columnas con información.
 */
export function resumenFila(row: FlujoPedidosRow): string {
  const partes: string[] = [];
  if (tieneValor(row.user)) partes.push(`user=${row.user}`);
  if (tieneValor(row.password)) partes.push('password=***');
  if (tieneValor(row.sku)) partes.push(`SKU=${row.sku}`);
  if (tieneValor(row.cantidad)) partes.push(`cantidad=${row.cantidad}`);
  if (tieneValor(row.catExtValor)) partes.push(`Cat Ext=${row.catExtValor}`);
  if (row.domicilio) partes.push('Domicilio');
  if (row.foraneo) partes.push('Foráneo (G)');
  if (row.express) partes.push('Express');
  if (row.tienda) partes.push('Tienda');
  if (tieneValor(row.order)) partes.push(`order=${row.order}`);
  if (tieneValor(row.localidad)) partes.push(`localidad=${row.localidad}`);
  return partes.join(', ');
}

/**
 * Valida que las columnas obligatorias A (user), B (password) y D (cantidad) tengan información.
 */
function validarColumnasObligatorias(row: FlujoPedidosRow): void {
  const faltantes: string[] = [];
  if (!tieneValor(row.user)) faltantes.push('A (user)');
  if (!tieneValor(row.password)) faltantes.push('B (password)');
  if (!tieneValor(row.cantidad)) faltantes.push('D (cantidad)');
  if (faltantes.length > 0) {
    throw new Error(
      `Las columnas A (user), B (password) y D (cantidad) deben contener información. Faltan: ${faltantes.join(', ')}.`
    );
  }
}

/**
 * Valida la fila para el flujo de órdenes y devuelve sku, cantidad, tipoEnvio y resumen.
 * Lanza si la fila no cumple: A, B, D con valor; solo C o E con valor para SKU; solo F, H o I para envío.
 */
export function validarFilaOrden(row: FlujoPedidosRow): FilaOrdenValida {
  validarColumnasObligatorias(row);
  const sku = validarYObtenerSku(row);
  const tipoEnvio = validarYObtenerTipoEnvio(row);
  return {
    sku,
    cantidad: row.cantidad.trim(),
    tipoEnvio,
    resumen: resumenFila(row),
    row,
  };
}
