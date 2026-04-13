import * as fs from 'fs';
import * as path from 'path';

/**
 * Fila del CSV de flujo de pedidos.
 * Cada fila = un camino distinto del TC.
 * SKU: solo una de columnas C (SKU) o E (Cat Ext) debe tener valor; la que tenga se usa para búsqueda.
 * Envío: solo una de F (Domicilio), H (Express), I (Tienda) debe estar marcada con "x".
 */
export interface FlujoPedidosRow {
  user: string;
  password: string;
  order: string;
  localidad: string;
  sku: string;
  cantidad: string;
  /** Valor raw columna E (Cat Ext); si tiene valor se usa como SKU en lugar de columna C */
  catExtValor: string;
  /** F = Regular envio a domicilio */
  domicilio: boolean;
  /** H = Regular envío Express */
  express: boolean;
  /** I = Regular Pickup (Recoger en tienda) */
  tienda: boolean;
  /** G = Regular envio a Foraneo: si está marcado, antes de buscar SKU se abre CP y se elige Local o Foráneo según F/H o I */
  foraneo: boolean;
  catExt: boolean;
  regularEnv1: boolean;
  regularEnv2: boolean;
  regularEnvioExpress: boolean;
}

/** Carpeta data/ respecto a la raíz del proyecto (donde está playwright.config.ts). */
function getDataDir(): string {
  const fromCwd = path.join(process.cwd(), 'data');
  const fromUtils = path.join(__dirname, '..', 'data');
  if (fs.existsSync(fromCwd)) return path.resolve(fromCwd);
  if (fs.existsSync(fromUtils)) return path.resolve(fromUtils);
  return path.resolve(fromCwd);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || (c === '\r' && !inQuotes)) {
      result.push(current.trim());
      current = '';
      if (c === '\r') break;
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function toBool(value: string): boolean {
  return value.trim().toLowerCase() === 'x';
}

/**
 * Lee un CSV desde la carpeta data/ y devuelve las filas como objetos.
 * Primera fila = cabeceras.
 */
export function readCsvRows<T = Record<string, string>>(
  filename: string,
  mapRow?: (raw: Record<string, string>) => T
): T[] {
  const dataDir = getDataDir();
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo CSV: ${filePath} (cwd: ${process.cwd()}, dataDir: ${dataDir})`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((h, j) => {
      raw[h] = values[j] ?? '';
    });
    rows.push((mapRow ? mapRow(raw) : raw) as T);
  }
  return rows;
}

/**
 * Lee inputRegresion.csv con el mismo formato (cada fila = un camino).
 * Opciones de camino: "x" en la celda = true, sino false.
 */
const COL_CAT_EXT = 'Cat Ext';
const COL_DOMICILIO = 'Regular envio a domicilio';
const COL_FORANEO = 'Regular envio a Foraneo';
const COL_EXPRESS = 'Regular envío Express';
const COL_TIENDA = 'Regular Pickup';

export function readInputRegresion(): FlujoPedidosRow[] {
  return readCsvRows<FlujoPedidosRow>('inputRegresion.csv', (raw) => ({
    user: raw['user'] ?? '',
    password: raw['password'] ?? '',
    order: raw['order'] ?? '',
    localidad: raw['localidad'] ?? '',
    sku: (raw['SKU'] ?? raw['sku'] ?? '').trim(),
    cantidad: (raw['cantidad'] ?? raw['Cantidad'] ?? '1').trim(),
    catExtValor: (raw[COL_CAT_EXT] ?? '').trim(),
    domicilio: toBool(raw[COL_DOMICILIO] ?? ''),
    foraneo: toBool(raw[COL_FORANEO] ?? ''),
    express:
      toBool(raw[COL_EXPRESS] ?? '') ||
      toBool(raw['Regular envio Express'] ?? '') ||
      (() => {
        const k = Object.keys(raw).find((key) => /regular.*env[ií]o.*express/i.test(key));
        return k ? toBool(raw[k] ?? '') : false;
      })(),
    tienda: toBool(raw[COL_TIENDA] ?? ''),
    catExt: toBool(raw['Cat Ext'] ?? ''),
    regularEnv1: toBool(raw['Regular env 1'] ?? ''),
    regularEnv2: toBool(raw['Regular env 2'] ?? ''),
    regularEnvioExpress: toBool(raw['Regular envío Express'] ?? ''),
  }));
}

/**
 * Devuelve user, password, sku y cantidad de la primera fila (para flujo Generar Orden).
 */
export function getDatosOrdenPrimeraFila(): { user: string; password: string; sku: string; cantidad: string } {
  const rows = readInputRegresion();
  if (rows.length === 0) throw new Error('inputRegresion.csv no tiene filas de datos.');
  const r = rows[0];
  return { user: r.user, password: r.password, sku: r.sku, cantidad: r.cantidad };
}

/** Mismo contenido que readInputRegresion(); se mantiene por compatibilidad. */
export function readFlujoPedidos(): FlujoPedidosRow[] {
  return readInputRegresion();
}

/**
 * Devuelve user y password de la primera fila de datos de inputRegresion.csv.
 * Usar para login en los tests.
 */
export function getLoginCredentialsFromInputRegresion(): { user: string; password: string } {
  const rows = readInputRegresion();
  if (rows.length === 0) throw new Error('inputRegresion.csv no tiene filas de datos.');
  const first = rows[0];
  return { user: first.user, password: first.password };
}
