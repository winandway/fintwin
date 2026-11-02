import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CampoClave } from '../components/CampoClave';
import { Aviso, Boton, Campo, Pagina, Tarjeta } from '../components/ui';
import { api } from '../lib/api';
import { useI18n, useMensajeError } from '../lib/i18n';

interface InfoCodigo {
  cuenta_nombre: string;
  nombre: string;
  rol: 'subidor' | 'validador';
  pide_pin: boolean;
}

/** «abcd2345» → «ABCD-2345» mientras se escribe. */
function formatear(valor: string): string {
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return limpio.length > 4 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio;
}

/**
 * Entrar con el código que dio el dueño: sin correo ni contraseña. El código y el PIN no se
 * guardan en el borrador (son de un solo uso y secretos).
 */
export function Access() {
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState(formatear(params.get('codigo') ?? ''));
  const [info, setInfo] = useState<InfoCodigo | null>(null);
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function ver(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const r = await api.post<InfoCodigo>('/acceso/ver', { codigo });
      if (r.pide_pin) setInfo(r);
      else await entrar(r);
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  async function entrar(datos: InfoCodigo | null = info) {
    if (!datos) return;
    const r = await api.post<{ destino: string }>('/acceso/entrar', { codigo, pin: datos.pide_pin ? pin : undefined, idioma });
    // Carga completa: la sesión nueva tiene que verse en toda la app.
    window.location.assign(r.destino);
  }

  async function conPin(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await entrar();
    } catch (err) {
      setError(msg(err));
      setPin('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina angosta>
      <Tarjeta className="space-y-4">
        <KeyRound className="h-10 w-10 text-marca" aria-hidden />
        <h1 className="text-xl font-bold">{t('access.title')}</h1>
        {info ? (
          <form onSubmit={conPin} className="space-y-4">
            <p className="text-tenue">
              {t('access.for', {
                name: info.nombre.split(' ')[0] ?? '',
                what: t(info.rol === 'validador' ? 'access.validator' : 'access.uploader'),
                account: info.cuenta_nombre,
              })}
            </p>
            <CampoClave
              pin
              autoFocus
              etiqueta={t('access.createPin')}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
            {error && <Aviso tipo="error">{error}</Aviso>}
            <Boton type="submit" cargando={enviando} disabled={pin.length !== 4} className="w-full">
              {t('access.enter')}
            </Boton>
            <Boton type="button" variante="fantasma" className="w-full" onClick={() => { setInfo(null); setPin(''); setError(''); }}>
              {t('access.other')}
            </Boton>
          </form>
        ) : (
          <form onSubmit={ver} className="space-y-4">
            <p className="text-tenue">{t('access.text')}</p>
            <Campo
              etiqueta={t('access.code')}
              autoFocus
              required
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              className="text-center font-mono text-2xl tracking-[0.3em]"
              value={codigo}
              onChange={(e) => setCodigo(formatear(e.target.value))}
            />
            {error && <Aviso tipo="error">{error}</Aviso>}
            <Boton type="submit" cargando={enviando} disabled={codigo.length !== 9} className="w-full">
              {t('common.continue')}
            </Boton>
          </form>
        )}
        <p className="text-center text-sm">
          <Link to="/login" className="text-tenue hover:text-white">
            {t('landing.have')}
          </Link>
        </p>
      </Tarjeta>
    </Pagina>
  );
}
