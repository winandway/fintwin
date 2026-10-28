# CLAUDE.md — FinTwin

FinTwin es la app independiente de Windoce LLC para registrar comprobantes de
ingresos de empresas. **No mueve dinero:** es un registro. Nació dentro de
Windoce Hub (windoce.com/app, sobre Supabase) y aquí se reconstruye sola, en
YaDominios Cloud. Las cuentas viejas de los clientes de windoce.com se quedan en
Windoce Hub.

## Perímetro (lo único que esta sesión toca)

- Carpeta: `~/FinTwin`. Repositorio público `winandway/fintwin`.
- Ramas: `main` (código) y `yapanel-build` (lo que publica el panel; la llena el Action).
- Sitio de YaDominios Cloud: `fintwin` (cuenta torplanet1@gmail.com, plan Galaxia).
  Dirección provisional: https://fintwin.sitios.dev
- Llave de Acceso para IA: `~/.config/fintwin/yadominios-llave-ia` (600). Nunca al repo.
- NO se usa Supabase, ni la base de Windoce Hub, ni la llave de Tumbite.

## Cómo se publica

Lee [docs/CONTRATO-YADOMINIOS.md](docs/CONTRATO-YADOMINIOS.md) y
[docs/DECISIONES-YADOMINIOS.md](docs/DECISIONES-YADOMINIOS.md) antes de tocar nada.

## Las tres personas

1. **La empresa:** crea su usuario, sus cuentas con PIN y comparte su link de pago o QR.
2. **Quien pagó:** abre el link, ve la guía de la captura, la sube; sin número de confirmación no entra.
3. **El validador:** PIN propio, aprueba o rechaza en lote.

## Reglas de la casa

Las globales de Richard mandan (español en el chat, publicar por defecto,
blindaje desde el primer commit, borradores en todo formulario, ojito en las
contraseñas, Turnstile, borrar dentro de los 3 puntos, pie con Windoce LLC,
inglés como idioma principal con español en /es).
