-- FinTwin: esquema de la base del sitio (SQLite de YaDominios Cloud).
-- Se ejecuta ENTERO cada vez que cambia: todo idempotente, nunca DROP ni DELETE.
-- Las columnas nuevas se agregan AL FINAL con ALTER TABLE ... ADD COLUMN.
-- Fechas en milisegundos desde 1970 (INTEGER). Dinero en centavos (INTEGER).

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  clave_hash TEXT NOT NULL,
  idioma TEXT NOT NULL DEFAULT 'en',
  confirmado_en INTEGER,
  borrado_en INTEGER,
  creado_en INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  expira_en INTEGER NOT NULL,
  creado_en INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones (usuario_id);

-- Enlaces de un solo uso que viajan por correo: confirmar el correo y cambiar la contraseña.
CREATE TABLE IF NOT EXISTS tokens (
  token_hash TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('confirmar', 'restablecer')),
  expira_en INTEGER NOT NULL,
  usado_en INTEGER,
  creado_en INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tokens_usuario ON tokens (usuario_id, tipo);

-- Límite de intentos (no hay KV): contraseñas, PIN, correos.
CREATE TABLE IF NOT EXISTS intentos (
  clave TEXT PRIMARY KEY,
  fallos INTEGER NOT NULL DEFAULT 0,
  ventana_desde INTEGER NOT NULL,
  bloqueado_hasta INTEGER NOT NULL DEFAULT 0
);

-- Cada cuenta es un negocio, sucursal o área. El link de pago es su slug.
CREATE TABLE IF NOT EXISTS cuentas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  comision_pct REAL NOT NULL DEFAULT 0,
  link_slug TEXT NOT NULL UNIQUE,
  dueno_id TEXT NOT NULL,
  archivada_en INTEGER,
  creado_en INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cuentas_dueno ON cuentas (dueno_id);

-- Equipo de cada cuenta. Cada persona tiene SU PIN (hash), nunca compartido.
CREATE TABLE IF NOT EXISTS miembros (
  cuenta_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('dueno', 'validador')),
  pin_hash TEXT NOT NULL,
  creado_en INTEGER NOT NULL,
  PRIMARY KEY (cuenta_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS miembros_usuario ON miembros (usuario_id);

CREATE TABLE IF NOT EXISTS invitaciones (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  cuenta_id TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('validador')),
  creado_por TEXT NOT NULL,
  expira_en INTEGER NOT NULL,
  usada_por TEXT,
  usada_en INTEGER,
  anulada_en INTEGER,
  creado_en INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS invitaciones_cuenta ON invitaciones (cuenta_id);

-- Comprobantes (ingresos que sube quien pagó) y salidas (las anota la empresa).
CREATE TABLE IF NOT EXISTS comprobantes (
  id TEXT PRIMARY KEY,
  cuenta_id TEXT NOT NULL,
  subido_por TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'salida')),
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  monto_cent INTEGER NOT NULL,
  comision_cent INTEGER NOT NULL DEFAULT 0,
  fecha_pago TEXT,
  confirmacion TEXT,
  confirmacion_norm TEXT,
  pagador TEXT,
  beneficiario TEXT,
  motivo TEXT,
  lectura TEXT CHECK (lectura IN ('ia', 'manual')),
  archivo_clave TEXT,
  archivo_hash TEXT,
  archivo_tipo TEXT,
  revisado_por TEXT,
  revisado_en INTEGER,
  creado_en INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comprobantes_cuenta ON comprobantes (cuenta_id, estado, creado_en);
CREATE INDEX IF NOT EXISTS comprobantes_subido ON comprobantes (subido_por, creado_en);
-- Freno de repetidos en TODAS las cuentas: el mismo número de confirmación o la
-- misma imagen no entran dos veces mientras el primero no esté rechazado.
CREATE UNIQUE INDEX IF NOT EXISTS comprobantes_confirmacion_unica
  ON comprobantes (confirmacion_norm) WHERE confirmacion_norm IS NOT NULL AND estado <> 'rechazado';
CREATE UNIQUE INDEX IF NOT EXISTS comprobantes_archivo_unico
  ON comprobantes (archivo_hash) WHERE archivo_hash IS NOT NULL AND estado <> 'rechazado';

-- «A quién le pago»: las empresas a las que cada persona les ha subido capturas.
CREATE TABLE IF NOT EXISTS beneficiarios (
  usuario_id TEXT NOT NULL,
  cuenta_id TEXT NOT NULL,
  agregado_en INTEGER NOT NULL,
  PRIMARY KEY (usuario_id, cuenta_id)
);

-- Las excepciones del servidor no llegan al registro del panel: se guardan aquí.
CREATE TABLE IF NOT EXISTS errores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ruta TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  creado_en INTEGER NOT NULL
);

-- 28 oct 2026: toda salida lleva su factura; la IA lee el comercio y la categoría.
ALTER TABLE comprobantes ADD COLUMN comercio TEXT;
ALTER TABLE comprobantes ADD COLUMN categoria TEXT;

-- Gastos pagados con la comisión de la empresa: cada uno con su ticket.
CREATE TABLE IF NOT EXISTS gastos_comision (
  id TEXT PRIMARY KEY,
  cuenta_id TEXT NOT NULL,
  registrado_por TEXT NOT NULL,
  monto_cent INTEGER NOT NULL,
  comercio TEXT,
  categoria TEXT,
  fecha TEXT,
  nota TEXT,
  archivo_clave TEXT NOT NULL,
  archivo_tipo TEXT NOT NULL,
  archivo_hash TEXT NOT NULL UNIQUE,
  creado_en INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gastos_comision_cuenta ON gastos_comision (cuenta_id, creado_en);

-- 31 oct 2026: celulares que reciben avisos (app de iPhone/Android). Un token por celular.
CREATE TABLE IF NOT EXISTS dispositivos (
  token TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  plataforma TEXT,
  actualizado_en INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS dispositivos_usuario ON dispositivos (usuario_id);
