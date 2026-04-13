# Regresión - Playwright + TypeScript

Proyecto de pruebas de regresión con **Playwright** y **TypeScript**, preparado para integrarse con **GitHub** (CI con GitHub Actions).

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
npx playwright install
```

El segundo comando descarga los navegadores (Chromium, Firefox, WebKit) necesarios para ejecutar las pruebas.

## Estructura del proyecto

```
Regresion/
├── .github/workflows/   # CI en GitHub Actions
├── data/                # Archivos CSV con datos de prueba (usuarios, órdenes, opciones por camino)
├── tests/               # Especificaciones de pruebas (*.spec.ts); cada Page tiene tests/NombrePage.spec.ts
├── pages/               # Page Objects (cada pages/NombrePage.ts ↔ tests/NombrePage.spec.ts)
├── fixtures/            # Fixtures de Playwright
├── utils/               # Helpers (lectura CSV, etc.)
├── playwright.config.ts # Configuración de Playwright
├── tsconfig.json
└── package.json
```

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm test` | Ejecutar todas las pruebas (headless) |
| `npm run test:headed` | Ejecutar con navegador visible |
| `npm run test:ui` | Abrir la UI de Playwright |
| `npm run test:debug` | Modo debug |
| `npm run report` | Ver el último reporte HTML |

## Formato de nombres en specs

En todos los archivos `*.spec.ts` se usa esta convención:

- **test.describe:** `@mod_<nombre_modulo> <Nombre del módulo>`
  - `nombre_modulo` = nombre del módulo en minúsculas, espacios → `_`. Ej: "Usuarios y Login" → `usuarios_login`.
  - Ejemplo: `test.describe('@mod_usuarios_login Usuarios y Login', () => { ... });`

- **test (cada caso):** `@TC_<siglas>_<consecutivo> <Nombre del escenario>`
  - `siglas` = iniciales del módulo (ej. Usuarios y Login → **UYL**).
  - `consecutivo` = 001, 002, 003...
  - Ejemplo: `test('@TC_UYL_001 Usuario General Crear Cuenta desde Login', async ({ page }) => { ... });`

Así puedes ejecutar un TC concreto: `npx playwright test -g "@TC_UYL_003"`.

## Configuración

- **baseURL**: Por defecto `https://ecqa.officedepot.com.mx`. Puedes cambiarla con la variable de entorno `BASE_URL` o en `playwright.config.ts`.
- **Datos de entrada (CSV)**: Usuarios, contraseñas, pedidos y opciones de camino se leen desde archivos en `data/`. Cada **fila del CSV = un camino distinto** del mismo caso de prueba; las celdas con **`x`** indican qué opción tomar en la página (ver `data/README.md`).
- **Mostrar navegador**: Por defecto las pruebas **muestran el navegador** (headless: false). Para ocultarlo:
  - Define la variable de entorno: `HEADLESS=true npm test`
  - O usa el flag directamente: `playwright test --headed` siempre muestra el navegador (sobrescribe la config)
- En **GitHub**: puedes definir `BASE_URL` en *Settings → Secrets and variables → Actions → Variables* para apuntar a tu entorno de staging/producción.

## Integración con GitHub

El workflow `.github/workflows/playwright.yml` se ejecuta en cada *push* y *pull request* a `main`/`master`. Si las pruebas fallan, se sube el reporte HTML como artifact para descargar y revisar.

## Próximos pasos

1. **baseURL** está en `https://ecqa.officedepot.com.mx`. Puedes cambiarlo en `playwright.config.ts` o con `BASE_URL`.
2. Los datos de prueba están en `data/flujo-pedidos.csv`. Cada fila es un camino del TC; las columnas con `x` definen la opción (Cat Ext, Regular env 1/2, Regular envío Express).
3. En los tests usa `readFlujoPedidos()` de `utils/csv.ts` y, según `row.catExt`, `row.regularEnv1`, etc., toma el camino correspondiente en la página.
4. Añade Page Objects en `pages/` para reutilizar selectores y acciones.
5. (Opcional) Crea variables/secrets en el repo de GitHub para `BASE_URL` u otras configuraciones.
