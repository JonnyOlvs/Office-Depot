import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'output');
const ARCHIVO_ORDENES = path.join(OUTPUT_DIR, 'ordenes_generadas.csv');
const ENCABEZADO = 'fecha,numero_orden,user,sku,cantidad\n';

/**
 * Guarda una orden generada en output/ordenes_generadas.csv.
 * Siempre añade al final; no borra órdenes ya existentes.
 * Formato CSV: fecha (ISO), numero_orden, user, sku, cantidad.
 */
export function guardarOrdenGenerada(
  numeroOrden: string,
  contexto?: { user?: string; sku?: string; cantidad?: string }
): void {
  const fecha = new Date().toISOString();
  const user = contexto?.user ?? '';
  const sku = contexto?.sku ?? '';
  const cantidad = contexto?.cantidad ?? '';
  const linea = `${fecha},${numeroOrden},${user},${sku},${cantidad}\n`;

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const existeArchivo = fs.existsSync(ARCHIVO_ORDENES);
  if (!existeArchivo) {
    fs.writeFileSync(ARCHIVO_ORDENES, ENCABEZADO, 'utf-8');
  }
  fs.appendFileSync(ARCHIVO_ORDENES, linea, 'utf-8');
}
