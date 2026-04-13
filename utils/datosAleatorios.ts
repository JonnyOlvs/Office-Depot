/**
 * Datos aleatorios para formularios (Crear Cuenta, etc.).
 * - Nombre y apellidos: una palabra cada uno.
 * - Teléfono: 10 dígitos, siempre empieza con 777.
 * - Correo: automatizacion_regresion_XXXXX@hotmail.com (XXXXX = 5 dígitos aleatorios).
 * - Contraseña fija: automatizacion_regresion.
 */

const NOMBRES = [
  'Ana', 'Luis', 'Carlos', 'María', 'José', 'Rosa', 'Miguel', 'Laura', 'Juan', 'Sofia',
  'Pedro', 'Elena', 'Diego', 'Carmen', 'Antonio', 'Isabel', 'Francisco', 'Lucía', 'Jorge', 'Paula',
];

const APELLIDOS = [
  'García', 'López', 'Martínez', 'González', 'Rodríguez', 'Fernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres',
  'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales', 'Reyes', 'Ortiz', 'Chávez', 'Ruiz',
];

function aleatorio<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function digitosAleatorios(cantidad: number): string {
  let s = '';
  for (let i = 0; i < cantidad; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export interface DatosCrearCuenta {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  telefono: string;
  correo: string;
  contraseña: string;
}

/**
 * Genera un set de datos para el flujo "Crear Cuenta desde Login".
 * Teléfono: 777 + 7 dígitos. Correo: automatizacion_regresion_XXXXX@hotmail.com.
 */
export function generarDatosCrearCuenta(): DatosCrearCuenta {
  return {
    nombre: aleatorio(NOMBRES),
    apellidoPaterno: aleatorio(APELLIDOS),
    apellidoMaterno: aleatorio(APELLIDOS),
    telefono: '777' + digitosAleatorios(7),
    correo: `automatizacion_regresion_${digitosAleatorios(5)}@hotmail.com`,
    contraseña: 'automatizacion_regresion',
  };
}
