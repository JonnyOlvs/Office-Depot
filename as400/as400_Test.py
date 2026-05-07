import os, time, ctypes, csv, traceback, logging

# ====================================================
# =============== CONFIG TRANSPORTE AS400 ============
# ====================================================
AS400_TRANSPORT = os.getenv("AS400_TRANSPORT", "UI").strip().upper()  # UI | TN5250
USE_TN5250 = AS400_TRANSPORT == "TN5250"

# Parámetros TN5250 (se configuran vía variables de entorno en CI)
TN5250_HOST = os.getenv("AS400_HOST", "").strip()           # ej. "mi-as400.empresa.com"
TN5250_PORT = os.getenv("AS400_PORT", "").strip() or "23"   # por defecto telnet 23
# En TN5250 debemos usar una code page EBCDIC válida.
# Para HostCodePage=284-L en el .WS corresponde "cp284" (spanish, Latin América).
TN5250_CODEPAGE = os.getenv("AS400_CODEPAGE", "cp284").strip() or "cp284"
TN5250_S3270_PATH = os.getenv("S3270_PATH", "").strip() or None  # ruta opcional a s3270 / wc3270

# Importaciones específicas de Windows solo si usamos emulador con UI
if not USE_TN5250 and os.name == "nt":
    import win32gui, win32con, win32api, win32clipboard as cb
else:
    win32gui = win32con = win32api = cb = None

USERPROFILE = os.path.expanduser("~")
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = os.path.join(
    USERPROFILE,
    "AppData",
    "Local",
    "ms-playwright",
)

# ===== RUTAS DINÁMICAS DENTRO DEL PROYECTO =====
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # carpeta Regresion
DATA_AS400_DIR = os.path.join(BASE_DIR, "data", "as400")

# Mantengo los mismos nombres de archivo pero ahora en data/as400
WS_PATH        = os.path.join(DATA_AS400_DIR, "AS400 MEXICO 49.ws")
INPUT_CSV      = os.path.join(DATA_AS400_DIR, "input.csv")           # para facturación AS400
INPUT_ORDENES  = os.path.join(DATA_AS400_DIR, "inputOrdenes.csv")    # para flujo Web
LOG_PATH       = os.path.join(DATA_AS400_DIR, "as400_automation.log")

# ===== LOGGING (consola + .log en Escritorio, con fallback) =====
handlers = [logging.StreamHandler()]  # siempre consola

try:
    # Nos aseguramos de que la carpeta de datos de AS400 exista
    os.makedirs(DATA_AS400_DIR, exist_ok=True)
    file_handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
    handlers.insert(0, file_handler)   # primero archivo, luego consola
except Exception as e:
    # Si falla (permiso, ruta rara, etc.), no rompemos el programa
    print(f"[AVISO] No se pudo crear el log en '{LOG_PATH}': {e}")
    print("        Se continuará solo con log en consola.")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=handlers
)

log      = logging.info
log_warn = logging.warning
log_err  = logging.error


# ==== CONFIG DEL SCRIPT ====
DELAY_BETWEEN_PASTE = 0.18
DELAY_BETWEEN_TABS  = 0.10
DELAY_BEFORE_TYPE   = 0.25
DELAY_AFTER_OPEN    = 3.5

DEFAULT_LOCALIDAD = "0190"

if not USE_TN5250 and os.name == "nt":
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
else:
    user32 = None
    kernel32 = None

# ====== FIRMAS DE PANTALLAS ======
# Estas firmas se usan en:
# - UI: detect_screen() vía get_screen_text (copy de la pantalla del emulador).
# - TN5250: t_detect_screen_name() como apoyo para MASTER_MENU.
SCREENS = {
    "MASTER_MENU": [
        "Menu: MASTER",
        "Sistemas de Mercancías",
    ],
    "PROGRAM_MESSAGES": [
        "Visualizar Mensajes de Programa",
        "Pulse Intro para continuar.",
    ],
    "JDA_SPLASH": [
        "J D A  S O F T W A R E",
        "P O R T F O L I O   M E R C H A N D I S E",
    ],
    "FACT_MENU": [
        "Office Depot de México, S.A. de C.V.",
        "MENU DE FACTURACIÓN VERSIÓN 2004",
    ],
    "FACT_BY_ORDER": [
        "Office Depot de México, S.A. de C.V.",
        "Facturación Por Número de Orden",
    ],
}

# Texto genérico de error de estatus de orden (subcadena laxa para cubrir
# variantes con/sin acento: "estatus de la orden invalido/ inválido", etc.)
ORDER_STATUS_INVALID_SUBSTR = "estatus de la orden inval"

# ====================================================
# =============== SECCIÓN AS400 / VENTANAS (UI) ======
# ====================================================
def find_as400_window():
    """
    Solo aplica para modo UI en Windows.
    """
    if USE_TN5250 or not win32gui:
        return None

    targets = []

    def enum_cb(hwnd, _):
        title = win32gui.GetWindowText(hwnd) or ""
        cls   = win32gui.GetClassName(hwnd) or ""
        if ("IBM" in title) or ("iSeries" in title) or ("AS400" in title) or ("PCSWS" in cls):
            targets.append(hwnd)
        return True

    win32gui.EnumWindows(enum_cb, None)
    return targets[0] if targets else None


def bring_foreground(hwnd):
    """
    Solo aplica para modo UI en Windows.
    """
    if USE_TN5250 or not win32gui or not hwnd:
        return

    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    win32gui.ShowWindow(hwnd, win32con.SW_MAXIMIZE)
    try:
        win32gui.SetForegroundWindow(hwnd)
    except Exception:
        if not user32 or not kernel32:
            return
        fg_thread = user32.GetWindowThreadProcessId(win32gui.GetForegroundWindow(), None)
        this_thread = kernel32.GetCurrentThreadId()
        user32.AttachThreadInput(this_thread, fg_thread, True)
        try:
            win32gui.SetForegroundWindow(hwnd)
        finally:
            user32.AttachThreadInput(this_thread, fg_thread, False)

# ====================================================
# =============== SECCIÓN TECLAS / PORTAPAPELES (UI) =
# ====================================================
def _set_clip(text: str):
    if USE_TN5250 or not cb:
        return
    cb.OpenClipboard()
    try:
        cb.EmptyClipboard()
        cb.SetClipboardText(str(text))
    finally:
        cb.CloseClipboard()


def _key_down(vk):
    if USE_TN5250 or not win32api:
        return
    win32api.keybd_event(vk, 0, 0, 0)


def _key_up(vk):
    if USE_TN5250 or not win32api:
        return
    win32api.keybd_event(vk, 0, win32con.KEYEVENTF_KEYUP, 0)


def _send_ctrl_v():
    if USE_TN5250:
        return
    _key_down(win32con.VK_CONTROL)
    _key_down(0x56)
    _key_up(0x56)
    _key_up(win32con.VK_CONTROL)


def _send_shift_insert():
    if USE_TN5250:
        return
    _key_down(win32con.VK_SHIFT)
    _key_down(win32con.VK_INSERT)
    _key_up(win32con.VK_INSERT)
    _key_up(win32con.VK_SHIFT)


def _send_menu_paste_no_enter():
    if USE_TN5250:
        return
    _key_down(win32con.VK_MENU)
    _key_down(0x45)  # Alt+E
    _key_up(0x45)
    _key_up(win32con.VK_MENU)
    time.sleep(0.08)
    _key_down(0x50)
    _key_up(0x50)  # 'P'


def _wm_paste_foreground():
    if USE_TN5250 or not win32gui:
        return
    hwnd = win32gui.GetForegroundWindow()
    if hwnd:
        win32gui.SendMessage(hwnd, win32con.WM_PASTE, 0, 0)


def _send_tab():
    if USE_TN5250:
        return
    _key_down(win32con.VK_TAB)
    _key_up(win32con.VK_TAB)


def _send_enter():
    if USE_TN5250:
        return
    _key_down(win32con.VK_RETURN)
    _key_up(win32con.VK_RETURN)


# ====================================================
# =============== SECCIÓN LECTURA PANTALLA (UI) ======
# ====================================================
def _send_alt_letter(letter_vk):
    if USE_TN5250:
        return
    _key_down(win32con.VK_MENU)
    _key_down(letter_vk)
    _key_up(letter_vk)
    _key_up(win32con.VK_MENU)
    time.sleep(0.08)


def get_screen_text():
    if USE_TN5250:
        return ""

    _send_alt_letter(0x45)  # Alt+E
    time.sleep(0.05)
    _key_down(0x41)
    _key_up(0x41)  # 'A'
    time.sleep(0.10)
    _send_alt_letter(0x45)  # Alt+E
    time.sleep(0.05)
    _key_down(0x43)
    _key_up(0x43)  # 'C'
    time.sleep(0.15)

    try:
        cb.OpenClipboard()
        try:
            data = cb.GetClipboardData()
        finally:
            cb.CloseClipboard()
    except Exception:
        data = ""
    return (data or "").replace("\r\n", "\n")

def detect_screen(text=None):
    if text is None:
        text = get_screen_text()

    tlow = text.lower()
    for name, markers in SCREENS.items():
        if all(m.lower() in tlow for m in markers):
            return name, text
    return "UNKNOWN", text

# ====================================================
# =============== SECCIÓN MÉTODOS PÚBLICOS AS400 =====
# ====================================================
def write(text):
    """
    En modo UI usa portapapeles/teclas; en TN5250 solo es un wrapper
    alrededor de sendText, implementado en run_job_tn5250.
    """
    if USE_TN5250:
        # En modo TN5250 no se usa este helper global
        log(f"✍️  write() llamado en modo TN5250 (ignorado a nivel global).")
        return

    _set_clip(text)
    time.sleep(0.10)
    _send_ctrl_v()
    time.sleep(DELAY_BETWEEN_PASTE)
    _send_shift_insert()
    time.sleep(DELAY_BETWEEN_PASTE)
    _send_menu_paste_no_enter()
    time.sleep(DELAY_BETWEEN_PASTE)
    _wm_paste_foreground()
    time.sleep(DELAY_BETWEEN_PASTE)
    log(f"✍️  write(): '{text}' pegado.")


def tabs(count=1):
    if USE_TN5250:
        log("⇥ tabs() llamado en modo TN5250 (ignorado a nivel global).")
        return

    count = int(count)
    for _ in range(count):
        _send_tab()
        time.sleep(DELAY_BETWEEN_TABS)
    log(f"⇥ tabs(): {count} TAB(s).")


def enter(count=1, delay_between=0.15):
    if USE_TN5250:
        log("↩ enter() llamado en modo TN5250 (ignorado a nivel global).")
        return

    count = int(count)
    delay_between = float(delay_between)
    for _ in range(count):
        _send_enter()
        time.sleep(delay_between)
    log(f"↩ enter(): {count} ENTER(s) con delay {delay_between:.2f}s.")


def wait(seconds):
    seconds = float(seconds)
    time.sleep(seconds)
    log(f"⏳ wait(): {seconds:.2f}s.")


def close_window():
    if USE_TN5250 or not win32gui or not win32api:
        return

    hwnd = win32gui.GetForegroundWindow()
    if hwnd:
        log("🧩 Cerrando ventana con ALT+F4...")
        win32api.keybd_event(win32con.VK_MENU, 0, 0, 0)
        win32api.keybd_event(win32con.VK_F4, 0, 0, 0)
        win32api.keybd_event(win32con.VK_F4, 0, win32con.KEYEVENTF_KEYUP, 0)
        win32api.keybd_event(win32con.VK_MENU, 0, win32con.KEYEVENTF_KEYUP, 0)
        time.sleep(1)


def send_key(vk_code, delay=0.15):
    if USE_TN5250:
        log(f"🧩 send_key() llamado en modo TN5250 (ignorado a nivel global).")
        return

    _key_down(vk_code)
    time.sleep(0.05)
    _key_up(vk_code)
    time.sleep(delay)
    log(f"🧩 Tecla enviada (vk={vk_code}).")


def press_key(name):
    if USE_TN5250:
        log(f"🧩 press_key() llamado en modo TN5250 (ignorado a nivel global).")
        return

    keys = {
        "F1": win32con.VK_F1, "F2": win32con.VK_F2, "F3": win32con.VK_F3,
        "F4": win32con.VK_F4, "F5": win32con.VK_F5, "F6": win32con.VK_F6,
        "F7": win32con.VK_F7, "F8": win32con.VK_F8, "F9": win32con.VK_F9,
        "F10": win32con.VK_F10, "F11": win32con.VK_F11, "F12": win32con.VK_F12,
    }
    vk = keys.get(name.upper())
    if not vk:
        raise ValueError(f"Tecla desconocida: {name}")
    send_key(vk)


def backspace(count=1, delay=0.12):
    """
    Presiona Backspace 'count' veces para borrar caracteres.
    """
    if USE_TN5250 or not win32api:
        log(f"⌫ backspace() llamado en modo TN5250 (ignorado a nivel global).")
        return

    count = int(count)
    for _ in range(count):
        win32api.keybd_event(win32con.VK_BACK, 0, 0, 0)
        time.sleep(0.05)
        win32api.keybd_event(win32con.VK_BACK, 0, win32con.KEYEVENTF_KEYUP, 0)
        time.sleep(delay)

    log(f"⌫ backspace(): {count} borrados.")


# ====================================================
# =============== SECCIÓN FLUJO AS400 (TN5250) =======
# ====================================================
def _create_tn5250_client():
    """
    Crea y conecta un cliente TN5250 usando p5250.
    """
    if not TN5250_HOST:
        raise RuntimeError(
            "AS400_HOST no está configurado. "
            "Configura AS400_HOST (y opcionalmente AS400_PORT / AS400_CODEPAGE / S3270_PATH) en el entorno."
        )

    try:
        from p5250 import P5250Client
    except ImportError as e:
        raise RuntimeError(
            "No se encontró la librería 'p5250'. "
            "Instálala con 'pip install p5250' en el runner de GitHub Actions."
        ) from e

    host = TN5250_HOST
    if TN5250_PORT:
        host = f"{TN5250_HOST}:{TN5250_PORT}"

    client = P5250Client(
        hostName=host,
        path=TN5250_S3270_PATH,
        codePage=TN5250_CODEPAGE,
    )

    if not client.connect():
        raise RuntimeError(f"No se pudo conectar al host AS400 vía TN5250 ({host}).")

    log(f"🔌 Conectado a AS400 vía TN5250: {host}")
    return client


def run_job_tn5250(USER: str, PASS: str, ORDER: str, LOCALIDAD: str, login_times: int = 1):
    """
    Mismo flujo de negocio que run_job UI, pero usando TN5250 headless.
    Pensado para ejecutarse en CI (GitHub Actions, runner self-hosted).
    """
    log("\n" + "=" * 70)
    log(
        f"▶ [TN5250] Iniciando job | user='{USER}' | order='{ORDER}' "
        f"| localidad='{LOCALIDAD}' | login={login_times} vez(es)"
    )
    log("=" * 70)

    client = _create_tn5250_client()

    def t_write(text):
        client.sendText(str(text))
        time.sleep(DELAY_BETWEEN_PASTE)

    def t_tabs(count=1):
        count_local = int(count)
        for _ in range(count_local):
            client.sendTab()
            time.sleep(DELAY_BETWEEN_TABS)

    def t_enter(count=1, delay_between=0.15):
        count_local = int(count)
        delay_local = float(delay_between)
        for _ in range(count_local):
            client.sendEnter()
            time.sleep(delay_local)

    def t_backspace(count=1, delay=0.12):
        count_local = int(count)
        for _ in range(count_local):
            client.sendBackSpace()
            time.sleep(delay)

    def t_press_key(name: str):
        n = name.upper()
        if n.startswith("F"):
            try:
                num = int(n[1:])
            except ValueError:
                raise ValueError(f"Tecla desconocida para TN5250: {name}")
            client.sendF(num)
        else:
            raise ValueError(f"Tecla no soportada en TN5250: {name}")

    def t_wait(seconds):
        time.sleep(float(seconds))

    def t_read_screen_raw():
        try:
            return client.getScreen() or ""
        except Exception as e:
            log_warn(f"⚠ [TN5250] No se pudo leer pantalla: {e}")
            return ""

    def t_debug_log_screen(label: str, max_lines: int = 27):
        """
        Log auxiliar para entender exactamente qué texto devuelve getScreen()
        en ciertos puntos (por ejemplo justo después de login).
        """
        raw = t_read_screen_raw()
        if not raw:
            log_warn(f"🔎 [TN5250] {label}: pantalla vacía o no legible.")
            return
        lines = raw.splitlines()
        # max_lines controla cuántas filas mostramos; por defecto, la pantalla completa (27 filas típicas).
        snippet = "\n".join(lines[:max_lines]) if max_lines else raw
        log(
            f"🔎 [TN5250] {label} - primeras {min(max_lines, len(lines))} lineas de pantalla:\n"
            f"{snippet}"
        )

    def t_detect_screen_name():
        """
        Detecta la pantalla actual a partir del texto devuelto por getScreen.
        - PROGRAM_MESSAGES: 'Visualizar Mensajes de Programa' / 'Pulse Intro para continuar.'
        - JDA_SPLASH: pantalla splash de JDA (texto con letras separadas por espacios)
        - MASTER_MENU: usa firmas de SCREENS (UI/TN5250)
        """
        raw = t_read_screen_raw()
        tlow = raw.lower()
        tcompact = tlow.replace(" ", "")

        # 1) Pantalla de mensajes de programa
        if (
            "visualizar mensajes de programa" in tlow
            or "pulse intro para continuar" in tlow
        ):
            return "PROGRAM_MESSAGES"

        # 2) Pantalla splash de JDA (texto viene con letras separadas por espacios)
        if "jdasoftwaregroup" in tcompact or "portfoliomerchandisemanagementi" in tcompact:
            return "JDA_SPLASH"

        # 3) Resto de pantallas conocidas (por ahora solo MASTER_MENU)
        for name, markers in SCREENS.items():
            if all(m.lower() in tlow for m in markers):
                return name

        return "UNKNOWN"

    def t_check_invalid_order_status(order: str):
        """
        Lee la pantalla actual y detecta si aparece el mensaje
        de estatus de orden inválido. Si lo encuentra, lanza
        una excepción para que el flujo de CI marque la fila
        como fallida.
        Además, loguea un snippet de la pantalla en cada intento
        para poder ajustar la firma si cambia el texto.
        """
        for intento in range(3):
            try:
                raw = client.getScreen() or ""
            except Exception as e:
                log_warn(
                    f"⚠ [TN5250] No se pudo leer pantalla para validar estatus de orden "
                    f"(intento {intento+1}): {e}"
                )
                raw = ""

            # Logueamos las primeras líneas para depurar el texto real
            if raw:
                lines = (raw or "").splitlines()
                snippet = "\n".join(lines[:6])
                log(
                    f"🔎 [TN5250] Pantalla al validar estatus de orden "
                    f"(orden='{order}', intento {intento+1}):\n{snippet}"
                )

            tlow = (raw or "").lower()
            if ORDER_STATUS_INVALID_SUBSTR in tlow:
                log_err(
                    f"❌ [TN5250] Estatus de la orden inválido para orden '{order}' "
                    f"(intento {intento+1})."
                )
                raise RuntimeError(f"Estatus de la orden inválido para orden '{order}'")

            t_wait(1.0)

    def t_expect_screen(expected_name: str, context: str):
        """
        Valida la pantalla actual en TN5250 usando t_detect_screen_name.
        Solo loguea advertencias; no interrumpe el flujo.
        """
        try:
            screen_name = t_detect_screen_name()
        except Exception as e:
            log_warn(f"⚠ [TN5250] No se pudo detectar la pantalla {context}: {e}")
            return

        log(f"📺 [TN5250] Pantalla {context}: {screen_name}")
        if screen_name != expected_name:
            log_warn(
                f"⚠ [TN5250] Pantalla inesperada {context}. "
                f"Esperada='{expected_name}', obtenida='{screen_name}'."
            )

    def t_skip_program_messages_if_any(max_retries: int = 10, delay: float = 1.0):
        """
        Algunos usuarios, después del login, ven una pantalla intermedia
        'Visualizar Mensajes de Programa' con el texto 'Pulse Intro para continuar.'.
        Si detectamos esa pantalla, mandamos un ENTER extra para continuar.
        Hacemos varios reintentos breves porque la pantalla puede tardar en aparecer.
        """
        # Espera inicial para dar tiempo a que aparezca la pantalla intermedia
        t_wait(delay)

        for i in range(max_retries):
            raw = t_read_screen_raw()
            tlow = raw.lower()
            # Detección laxa de la pantalla de mensajes de programa:
            # buscamos palabras clave en vez de la frase exacta porque
            # suelen venir con varios espacios intermedios.
            if (
                ("visualizar" in tlow and "mensajes" in tlow and "programa" in tlow)
                or ("pulse" in tlow and "intro" in tlow and "continuar" in tlow)
            ):
                log(
                    f"ℹ️ [TN5250] Pantalla 'Visualizar Mensajes de Programa' detectada "
                    f"(intento {i+1}). Enviando ENTER para continuar a pantalla JDA..."
                )
                # 1) Cerrar la pantalla de mensajes
                t_enter(1, delay_between=delay)
                t_wait(2.0)

                # 2) Esperar explícitamente a la pantalla JDA y enviar ENTER ahí
                for j in range(max_retries):
                    raw_jda = t_read_screen_raw()
                    tlow_jda = raw_jda.lower()
                    if (
                        "jda" in tlow_jda
                        and "software" in tlow_jda
                        and "group" in tlow_jda
                    ):
                        log(
                            f"ℹ️ [TN5250] Pantalla JDA detectada (intento {j+1} tras mensajes). "
                            "Enviando ENTER para continuar al menú principal..."
                        )
                        t_enter(1, delay_between=delay)
                        t_wait(2.0)
                        return
                    t_wait(delay)

                # Si no vimos JDA pero sí la pantalla de mensajes, salimos igual
                return

            # Caso alterno: no hubo pantalla de mensajes pero ya estamos en JDA,
            # enviamos un solo ENTER para avanzar al menú.
            if "jda" in tlow and "software" in tlow and "group" in tlow:
                log(
                    f"ℹ️ [TN5250] Pantalla JDA detectada sin mensajes previos (intento {i+1}). "
                    "Enviando ENTER para continuar al menú principal..."
                )
                t_enter(1, delay_between=delay)
                t_wait(2.0)
                return
            t_wait(delay)

    try:
        # Damos un pequeño tiempo para que la primera pantalla esté lista
        t_wait(DELAY_BEFORE_TYPE)

        # Log de depuración: cómo se ve la pantalla ANTES de intentar login
        t_debug_log_screen("Pantalla antes de login (TN5250)")

        # Login simple (sin TAB explícito; asumimos que el host mueve el cursor
        # al campo de contraseña después de escribir el usuario, tal como hace el emulador UI).
        log("🔐 [TN5250] Ejecutando login...")
        t_wait(3.0)
        t_write(USER)
        t_wait(0.4)
        t_debug_log_screen("Pantalla TN5250 después de escribir USER")
        t_write(PASS)
        t_debug_log_screen("Pantalla TN5250 después de escribir PASS")
        t_enter(2, delay_between=1.5)
        log("✅ [TN5250] Login completado.")

        # Normalizamos la pantalla después del login:
        # - Si es PROGRAM_MESSAGES → ENTER para ir a JDA
        # - Si es JDA_SPLASH → ENTER para ir a MASTER_MENU
        # - Si es MASTER_MENU o cualquier otra → seguimos sin ENTER extra
        for step in range(3):
            label = f"Pantalla después de login (paso {step+1})"
            t_debug_log_screen(label)
            try:
                screen_name = t_detect_screen_name()
            except Exception as e:
                log_warn(f"⚠ [TN5250] No se pudo detectar la pantalla en {label}: {e}")
                break

            log(f"📺 [TN5250] {label}: {screen_name}")

            if screen_name in ("PROGRAM_MESSAGES", "JDA_SPLASH"):
                log(
                    f"ℹ️ [TN5250] Pantalla intermedia '{screen_name}' detectada "
                    "después de login. Enviando ENTER para avanzar..."
                )
                t_enter(1, delay_between=1.5)
                t_wait(2.0)
                # seguimos el loop para reevaluar la nueva pantalla
                continue

            # Ya no estamos en pantallas intermedias; continuamos flujo normal
            break

        # Log de contexto antes de empezar el flujo de negocio
        t_debug_log_screen("Pantalla lista para flujo de negocio (después de login/normalización)")

        # Cambio de Localidad
        t_wait(2.0)
        t_tabs(1)
        t_write("MENOP1")
        t_enter(1, delay_between=1.5)
        t_debug_log_screen("Pantalla después de MENOP1")

        t_write("27")
        t_enter(1, delay_between=1.5)
        t_debug_log_screen("Pantalla después de opción 27 (menú cambio de localidad)")

        t_write("MUD001")
        t_tabs(4)

        loc = (LOCALIDAD or "").strip() or DEFAULT_LOCALIDAD
        t_write(f"'{loc}'")
        t_enter(1, delay_between=1.5)
        t_debug_log_screen(f"Pantalla después de MUD001/localidad (loc='{loc}')")

        # Facturación
        t_tabs(1)
        t_write("MENFAC")
        t_enter(1, delay_between=1.5)
        t_debug_log_screen("Pantalla después de MENFAC (antes de validar FACT_MENU)")
        # Validar menú principal de facturación
        t_expect_screen("FACT_MENU", "después de MENFAC (menú principal de Facturación)")

        t_write("5")
        t_enter(1, delay_between=1.5)
        t_debug_log_screen("Pantalla después de opción 5 (antes de validar FACT_BY_ORDER)")
        # Validar pantalla 'Facturación Por Número de Orden'
        t_expect_screen("FACT_BY_ORDER", "después de opción 5 (Facturación por número de orden)")

        t_write(ORDER)
        t_enter(1, delay_between=1.5)
        t_wait(2.0)
        # Log y validación de estatus de orden antes de continuar
        t_debug_log_screen("Pantalla después de ingresar orden (TN5250)")
        t_check_invalid_order_status(ORDER or "")
        t_press_key("F7")
        t_wait(5.0)
        t_debug_log_screen("Pantalla después de F7 (resultado de facturación)")
        t_wait(15.0)

        log("✅ [TN5250] Job finalizado.")
    finally:
        try:
            client.disconnect()
        except Exception:
            pass
        try:
            client.endSession()
        except Exception:
            pass


# ====================================================
# =============== SECCIÓN FLUJO AS400 (UI) ===========
# ====================================================
def run_job_ui(USER: str, PASS: str, ORDER: str, LOCALIDAD: str, login_times: int = 1):
    log("\n" + "=" * 70)
    log(
        f"▶ Iniciando job (UI) | user='{USER}' | order='{ORDER}' "
        f"| localidad='{LOCALIDAD}' | login={login_times} vez(es)"
    )
    log("=" * 70)

    if not os.path.exists(WS_PATH):
        raise FileNotFoundError(f"No existe el archivo .WS:\n{WS_PATH}")

    os.startfile(WS_PATH)
    time.sleep(DELAY_AFTER_OPEN)

    hwnd = find_as400_window()
    if hwnd:
        bring_foreground(hwnd)
    else:
        raise RuntimeError("No se encontró la ventana del emulador AS400.")

    time.sleep(DELAY_BEFORE_TYPE)

    # Helper local para validar pantallas en UI usando SCREENS/detect_screen
    def ui_expect_screen(expected_name: str, contexto: str):
        try:
            screen_name, _ = detect_screen()
            log(f"📺 (UI) Pantalla {contexto}: {screen_name}")
        except Exception as e:
            log_warn(f"⚠ (UI) No se pudo detectar la pantalla {contexto}: {e}")
            return

        if screen_name != expected_name:
            log_warn(
                f"⚠ (UI) Pantalla inesperada {contexto}. "
                f"Esperada='{expected_name}', obtenida='{screen_name}'."
            )

    # Login simple
    log("🔐 Ejecutando login (UI)...")
    wait(3.0)
    write(USER)
    wait(0.4)
    tabs(1)
    wait(0.3)
    write(PASS)
    enter(2, delay_between=1.5)
    log("✅ Login completado (UI).")

    # Normalizamos la pantalla después del login para el emulador UI:
    # - PROGRAM_MESSAGES → ENTER para ir a JDA
    # - JDA_SPLASH → ENTER para ir a MASTER_MENU
    # - MASTER_MENU u otra → seguimos sin ENTER extra
    for step in range(3):
        try:
            screen_name, _ = detect_screen()
        except Exception as e:
            log_warn(f"⚠ No se pudo detectar la pantalla (UI) después de login en paso {step+1}: {e}")
            break

        log(f"📺 (UI) Pantalla después de login (paso {step+1}): {screen_name}")

        if screen_name in ("PROGRAM_MESSAGES", "JDA_SPLASH"):
            log(
                f"ℹ️ (UI) Pantalla intermedia '{screen_name}' detectada después de login. "
                "Enviando ENTER para avanzar..."
            )
            enter(1, delay_between=1.5)
            wait(2.0)
            # Re-evaluamos la nueva pantalla en la siguiente iteración
            continue

        # Ya no estamos en pantallas intermedias; continuamos flujo normal
        break

    # Cambio de Localidad
    wait(2.0)
    tabs(1)
    write("MENOP1")
    enter(1, delay_between=1.5)
    write("27")
    enter(1, delay_between=1.5)
    write("MUD001")
    tabs(4)

    loc = (LOCALIDAD or "").strip() or DEFAULT_LOCALIDAD
    write(f"'{loc}'")
    enter(1, delay_between=1.5)

    # Facturación
    tabs(1)
    write("MENFAC")
    enter(1, delay_between=1.5)
    # Validar que estamos en el MENÚ PRINCIPAL DE FACTURACIÓN
    ui_expect_screen("FACT_MENU", "después de MENFAC (menú principal de Facturación)")

    write("5")
    enter(1, delay_between=1.5)
    # Validar que estamos en 'Facturación Por Número de Orden'
    ui_expect_screen("FACT_BY_ORDER", "después de opción 5 (Facturación por número de orden)")

    write(ORDER)
    enter(1, delay_between=1.5)

    # Validar si aparece mensaje de estatus de orden inválido antes de continuar
    # Hacemos varias lecturas seguidas porque el mensaje puede parpadear.
    ui_error_detected = False
    for intento in range(3):
        try:
            full_screen = get_screen_text()
        except Exception as e:
            log_warn(f"⚠ (UI) Error al leer pantalla para validar estatus de orden (intento {intento+1}): {e}")
            full_screen = ""

        if ORDER_STATUS_INVALID_SUBSTR in full_screen.lower():
            ui_error_detected = True
            log_err(
                f"❌ (UI) Estatus de la orden inválido detectado para orden '{ORDER}' "
                f"en intento {intento+1}."
            )
            break

        wait(1.0)

    if ui_error_detected:
        msg = f"Estatus de la orden inválido para orden '{ORDER}' (UI)."
        raise RuntimeError(msg)

    wait(3.0)
    press_key("F7")
    wait(20.0)

    try:
        close_window()
    except Exception as e:
        log_warn(f"⚠ No se pudo cerrar con ALT+F4: {e}")
    log("✅ Job finalizado (UI).")


def run_job(USER: str, PASS: str, ORDER: str, LOCALIDAD: str, login_times: int = 1):
    """
    Punto de entrada único para el flujo AS400.
    - Modo UI (por defecto): usa emulador gráfico y automatización de teclado.
    - Modo TN5250 (AS400_TRANSPORT=TN5250): usa p5250 headless, apto para CI.
    """
    if USE_TN5250:
        return run_job_tn5250(USER, PASS, ORDER, LOCALIDAD, login_times)
    return run_job_ui(USER, PASS, ORDER, LOCALIDAD, login_times)

# ====================================================
# =============== SECCIÓN FLUJO CSV (AS400) ==========
# ====================================================
def process_csv(csv_path: str, login_times: int = 1):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"No se encontró el CSV: {csv_path}")

    log(f"📄 Leyendo: {csv_path}")
    log(f"🔐 Tipo de login: {login_times} vez(es)")
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        def getcol(row, *names, default=""):
            for n in names:
                if n in row and row[n] is not None:
                    return row[n]
            return default

        row_count = 0
        ok_count = 0
        fail_count = 0

        for idx, row in enumerate(reader, start=1):
            USER  = getcol(row, "user", "usuario", "User", "Usuario").strip()
            PASS  = getcol(row, "password", "psw", "pass", "Password").strip()
            ORDER = getcol(row, "order", "orden", "Order", "Orden").strip()
            LOCA  = getcol(row, "localidad", "loc", "Localidad").strip()

            # Saltar filas vacías o de ejemplo/comentario
            if not any([USER, PASS, ORDER, LOCA]):
                continue
            if USER.startswith("#") or ORDER.startswith("#"):
                continue

            row_count += 1
            log(f"\n🧾 Fila {idx}: user='{USER}' | order='{ORDER}' | loc='{LOCA}'")

            try:
                run_job(USER, PASS, ORDER, LOCA, login_times)
                ok_count += 1
            except Exception as e:
                fail_count += 1
                log_err(f"❌ Error en la fila {idx} -> {e}")
                traceback.print_exc()
                try:
                    close_window()
                except:
                    pass

        log("\n" + "="*60)
        log(f"Resumen: procesadas={row_count} | OK={ok_count} | Fallas={fail_count}")
        log("="*60)

        # En modo CI queremos que el proceso falle si hubo al menos una fila fallida,
        # para que GitHub Actions marque el job en rojo.
        if fail_count > 0 and (
            os.getenv("GITHUB_ACTIONS", "").lower() == "true"
            or os.getenv("CI", "").lower() == "true"
            or os.getenv("AS400_NON_INTERACTIVE", "").lower() == "true"
        ):
            raise RuntimeError(
                f"Se encontraron {fail_count} fila(s) fallida(s) en AS400. "
                "Revisa el log para más detalles (mensajes como 'Estatus de la orden inválido')."
            )

# ====================================================
# =============== FLUJO CSV PARA ÓRDENES WEB =========
# ====================================================

def process_ordenes_csv(csv_path: str):
    """
    Lee inputOrdenes.csv (user, pswUser, SKU, cantidad) desde el Escritorio
    y ejecuta web_flow por cada fila válida (una sesión por fila).
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"No se encontró el CSV de órdenes web: {csv_path}")

    log(f"📄 Leyendo (órdenes web): {csv_path}")

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        def getcol(row, *names, default=""):
            for n in names:
                if n in row and row[n] is not None:
                    return row[n]
            return default

        row_count = 0
        ok_count = 0
        fail_count = 0

        for idx, row in enumerate(reader, start=1):
            USER      = getcol(row, "user", "User", "usuario", "Usuario").strip()
            PSW       = getcol(row, "pswUser", "psw", "password", "Password").strip()
            SKU       = getcol(row, "SKU", "sku", "Sku").strip()
            CANTIDAD  = getcol(row, "cantidad", "Cantidad", "qty", "Qty").strip()

            if not any([USER, PSW, SKU, CANTIDAD]):
                continue

            row_count += 1
            log(f"\n🧾 Fila Web {idx}: user='{USER}' | SKU='{SKU}' | cantidad='{CANTIDAD}'")

            try:
                web_flow(USER, PSW, SKU, CANTIDAD)   # 🔴 UNA SESIÓN POR FILA
                ok_count += 1
            except Exception as e:
                fail_count += 1
                log_err(f"❌ Error en la fila Web {idx} -> {e}")
                traceback.print_exc()

        log("\n" + "="*60)
        log(f"Resumen Web: procesadas={row_count} | OK={ok_count} | Fallas={fail_count}")
        log("="*60)

        

# ====================================================
# =============== PAGE OBJECT PARA WEB ===============
# ====================================================

class WebPage:
    """
    Page Object para mapear selectores web y permitir acciones genéricas.
    """

    def __init__(self, page):
        self.page = page

        self.FIELDS = {
            "buttonIniciaSesion": "(//a[@aria-label='login'])[1]",
            "inputCorreo": "input[id='usernamelogin']",
            "inputContrasena": "input[id='j_passwordexpress']",
            "buttonIniciarSesion": "button[id='loginButtonMaterial']",
            "labelArticulosTotales" : "span[class='nav-items-total']",
            "labelEliminarTodo":"a[class='link-turquesa']",
            "inputArticulo": "input[id='js-site-search-input']",
            "buttonLupaBusqueda": "button[id='js_search_button']",
            "objectProductoBusqueda": "(//div[@class='product-cnt clearfix'])[1]",
            "buttonAnadirCarrito": "button[id='addToCartButton']",
            "buttonGarantia": "(//button[contains(text(),'Continuar sin protección')])[2]",
            "buttonEnvioDomicilio" : "//div[text()='Domicilio']",
            "buttonCarrito": "div[class='glyphicon-carrito']",
            "buttonFinalizarPedido": "a[class='submit btn btn-secondary-theme font-bold']",
            "radioButtonContraEntrega": "input[id='payondelivery']",
            "radioButtonPaypal": "input[id='paypal']",
            "buttonPagarPaypal": "input[id='submitPaypal']",
            "inputCorreoPaypal": "input[id='email']",
            "inputPSWPaypal": "input[id='password']",
            "buttonSiguiente": "button[id='btnNext']",
            "buttonIniciarSesionPaypal": "button[id='btnLogin']",
            "buttonContinuarPedido": "//button[text()='Continuar y revisar pedido']",
            "buttonFinalizarCompra": "button[id='lastInTheForm123']",
            "buttonSeguirBusando": "a[class='continue-searching btn btn-rojo-theme btn-block ']",
            "buttonMiCuenta": "div[class='myAccountLinksHeader miCuenta']",
            "buttonMisPedidos": "(//span[text()='Mis Pedidos'])[1]",
            "labelOrden": "(//span[@class='right font-bold'])[1]",
            "buttonSelectorCantidad": "div#flecha-cantidad-mb",
        }

    # ====== Métodos genéricos para Web ======

    def locator(self, name: str):
        selector = self.FIELDS.get(name)
        if not selector:
            raise ValueError(f"El elemento '{name}' no está definido en FIELDS.")
        return self.page.locator(selector)

    def click(self, name: str):
        self.locator(name).click()

    def fill(self, name: str, value: str):
        self.locator(name).fill(value)

    def get_text(self, name: str):
        return self.locator(name).inner_text()

    def wait_for(self, name: str, timeout=30000):
        self.locator(name).wait_for(timeout=timeout)

    def press(self, name: str, key: str):
        self.locator(name).press(key)

    def type(self, name: str, value: str):
        """Escribe simulando tecleo humano."""
        self.locator(name).fill("")
        self.locator(name).type(value)

    def exists(self, name: str, timeout=2000):
        """
        Verifica si un elemento existe en la página.
        Retorna True si existe, False si no.
        """
        try:
            self.locator(name).wait_for(state="visible", timeout=timeout)
            return True
        except Exception:
            return False

    def select_cantidad(self, cantidad):
        """
        Abre el selector de cantidad y elige el <li> cuyo data-valor=cantidad.
        Si cantidad == 1, NO hace nada porque es el valor por defecto.
        """
        cantidad_str = str(cantidad).strip()

        # ✅ Si viene vacío o es 1, no hacemos nada
        if not cantidad_str or cantidad_str == "1":
            log("ℹ️ Cantidad = 1 (por defecto). No se abre selector.")
            return

        log(f"🔢 Seleccionando cantidad: {cantidad_str}")

        # Abrir el combo de cantidad
        try:
            self.click("buttonSelectorCantidad")
            time.sleep(1)
        except Exception:
            # Si ya está abierto, seguimos
            log_warn("⚠ No se pudo hacer click en selector (puede ya estar abierto).")

        # Click en el li correspondiente
        selector_li = f"ul#elementos-select-mb li[data-valor='{cantidad_str}']"
        self.page.locator(selector_li).click()
        time.sleep(1)


# ====================================================
# =============== SECCIÓN PLAYWRIGHT (WEB) ===========
# ====================================================

def web_flow(USER: str, PSW: str, SKU: str, CANTIDAD: str):
    """
    Flujo web para crear UNA orden:
    - Login con USER / PSW
    - Buscar SKU
    - Seleccionar cantidad
    - Añadir al carrito, finalizar y obtener número de orden
    - Guardar la orden en TXT
    """
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
    except ImportError:
        log_err("Playwright no está instalado.")
        return

    log(f"🌐 Iniciando flujo web para usuario '{USER}' | SKU='{SKU}' | cantidad='{CANTIDAD}'")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=False,
                args=["--start-maximized"]
            )
            context = browser.new_context(no_viewport=True)
            page = context.new_page()

            #TimeOuts
            page.set_default_timeout(90000)              # 60s para acciones (click, fill, etc.)
            page.set_default_navigation_timeout(120000)  # 120s para navegaciones/cargas

            web = WebPage(page)

            url = "https://ecqa.officedepot.com.mx/"
            log(f"🌐 Navegando a: {url}")
            page.goto(url, wait_until="load", timeout=60000)
            log("🌐 Página cargada.")

            # ===== Login =====
            web.click("buttonIniciaSesion")
            web.fill("inputCorreo", USER)
            web.fill("inputContrasena", PSW)
            web.click("buttonIniciarSesion")
            log("Login 🟢")

            # ===== Búsqueda por SKU =====
            web.type("inputArticulo", SKU)
            web.press("inputArticulo", "Enter")
            log("Búsqueda de artículo 🟢")

            # ===== Seleccionar producto y cantidad =====
            web.click("objectProductoBusqueda")
            time.sleep(3)
            web.select_cantidad(CANTIDAD)
            web.click("buttonEnvioDomicilio")
            log("Selección y cantidad de artículo 🟢")

            # ===== Flujo de compra =====
            web.click("buttonAnadirCarrito")
            time.sleep(2.0)
            
            # Validar si aparece el botón de garantía (solo con ciertos artículos)
            if web.exists("buttonGarantia"):
                log("🛡️ Botón de garantía detectado. Haciendo click...")
                web.click("buttonGarantia")
                log("✅ Garantía omitida.")
            else:
                log("ℹ️ No se detectó botón de garantía. Continuando flujo...")
            
            web.click("buttonCarrito")
            web.click("buttonFinalizarPedido")
            web.click("radioButtonPaypal")
            web.click("buttonPagarPaypal")
            web.fill("inputCorreoPaypal", "angelica.concepcion@officedepot.com.mx")
            web.click("buttonSiguiente")
            web.fill("inputPSWPaypal", "PONCHIS26")
            web.click("buttonIniciarSesionPaypal")
            web.click("buttonContinuarPedido")
            time.sleep(5)
            web.click("buttonFinalizarCompra")
            web.click("buttonSeguirBusando")
            web.click("buttonMiCuenta")
            web.click("buttonMisPedidos")
            log("Compra 🟢")

            # ===== Obtener número de orden con reintentos =====
            ordenNumero = ""
            for intento in range(1, 6):
                ordenNumero = web.get_text("labelOrden").strip()

                if ordenNumero:
                    log(f"🧾 Orden generada (intento {intento}): {ordenNumero}")
                    print(f"Orden generada: {ordenNumero}")
                    break
                else:
                    log_warn(f"⚠ Orden vacía en intento {intento}. Recargando página...")
                    time.sleep(3)
                    page.reload(wait_until="load")
                    time.sleep(3)
                    web.click("buttonMiCuenta")
                    web.click("buttonMisPedidos")

            if not ordenNumero:
                log_warn("⚠ No se pudo obtener el número de orden después de varios intentos.")
                print("Orden generada: (vacía)")

            # ===== Guardar orden en archivo TXT =====
            if ordenNumero:
                ordenes_txt_path = os.path.join(DATA_AS400_DIR, "ordenes_generadas.txt")
                with open(ordenes_txt_path, "a", encoding="utf-8") as f:
                    f.write(f"{ordenNumero}\n")

                log(f"💾 Orden guardada en archivo: {ordenes_txt_path}")
                print(f"Orden guardada en: {ordenes_txt_path}")

            time.sleep(5)
            browser.close() 
            log("🌐 Prueba Web finalizada 🟢")

    except PlaywrightTimeoutError as e:
        log_err(f"⏰ Timeout en flujo web: {e}")
        raise
    except Exception as e:
        log_err(f"⚠ Error en flujo web: {e}")
        raise


# ====================================================
# =============== MAIN / FLUJO PRINCIPAL =============
# ====================================================
if __name__ == "__main__":
    log(f"🟢 Script iniciado. Carpeta de datos AS400: {DATA_AS400_DIR}")
    log(f"WS_PATH:        {WS_PATH}")
    log(f"INPUT_CSV:      {INPUT_CSV}")
    log(f"INPUT_ORDENES:  {INPUT_ORDENES}")
    log(f"LOG_PATH:       {LOG_PATH}")

    # Modo no interactivo (CI / GitHub Actions)
    ci_flag = (os.getenv("GITHUB_ACTIONS", "").lower() == "true") or (
        os.getenv("CI", "").lower() == "true"
    ) or (os.getenv("AS400_NON_INTERACTIVE", "").lower() == "true")

    if ci_flag:
        # En CI siempre usamos login simple (1 vez)
        login_times = 1
        log("▶ Modo no interactivo (CI): Login simple (1 vez)")
        process_csv(INPUT_CSV, login_times)

    else:
        # Modo interactivo local: siempre login simple (1 vez)
        print("======================================")
        print("   Facturación AS400")
        print("======================================")
        print("Login simple (1 vez)")
        login_times = 1
        log("▶ Tipo de login: Simple (1 vez)")
        process_csv(INPUT_CSV, login_times)

