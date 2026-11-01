import { BookOpen, ChevronRight, ImagePlus, LifeBuoy, Mail, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, AvisoBorrador, Boton, Campo, Cargando, Pagina, Tarjeta } from '../components/ui';
import { MAX_ARCHIVO } from '../../shared/reglas';
import { api, type CasoLista, type EstadoCaso, type MensajeCaso } from '../lib/api';
import { useBorrador } from '../lib/borrador';
import { prepararImagen } from '../lib/imagen';
import { useI18n, useMensajeError } from '../lib/i18n';
import { useSesion } from '../lib/sesion';

const CORREO_SOPORTE = 'soporte+fintwin@windoce.com';
const MAX_ADJUNTOS = 3;

function EstadoCasoChip({ estado }: { estado: EstadoCaso }) {
  const { t } = useI18n();
  // Verde = ya le respondimos; gris = esperando; cerrado, neutro.
  const estilos = { abierto: 'bg-white/10 text-tenue', respondido: 'bg-exito/15 text-green-300', cerrado: 'bg-white/5 text-tenue' }[estado];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${estilos}`}>{t(`status.${estado}`)}</span>;
}

/** Hasta 3 capturas. Las que pasan de 10 MB se achican antes de subir. */
function Adjuntos({ archivos, onCambio }: { archivos: File[]; onCambio: (a: File[]) => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  async function elegir(lista: FileList | null) {
    const nuevos = Array.from(lista ?? []).slice(0, MAX_ADJUNTOS - archivos.length);
    const listos = await Promise.all(
      nuevos.map(async (f) => (f.size > MAX_ARCHIVO ? new File([await prepararImagen(f)], f.name.replace(/\.\w+$/, '.webp')) : f)),
    );
    onCambio([...archivos, ...listos]);
    if (input.current) input.current.value = '';
  }
  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => void elegir(e.target.files)}
        data-testid="adjuntos"
      />
      {archivos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {archivos.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex max-w-full items-center gap-1 rounded-lg border border-borde bg-[#0d1528] py-1 pl-2.5 pr-1 text-xs">
              <span className="max-w-[10rem] truncate">{f.name}</span>
              <button
                type="button"
                aria-label={t('help.remove', { name: f.name })}
                onClick={() => onCambio(archivos.filter((_, j) => j !== i))}
                className="rounded p-1 text-tenue hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {archivos.length < MAX_ADJUNTOS && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-dashed border-borde px-3 py-2 text-sm text-tenue hover:border-marca hover:text-white"
        >
          <ImagePlus className="h-4 w-4" aria-hidden /> {t('help.attach')}
        </button>
      )}
      <p className="text-xs text-tenue">{t('help.attachHint')}</p>
    </div>
  );
}

function formularioCaso(campos: Record<string, string>, archivos: File[]): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  for (const a of archivos) f.append('adjuntos', a, a.name);
  return f;
}

export function rutaGuiaAyuda(idioma: 'en' | 'es'): string {
  return `${idioma === 'es' ? '/es' : ''}/docs/help-cases`;
}

export function Help() {
  const { t, idioma } = useI18n();
  const { usuario } = useSesion();
  const msg = useMensajeError();
  const [casos, setCasos] = useState<CasoLista[] | null>(null);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [archivos, setArchivos] = useState<File[]>([]);
  const b = useBorrador('caso-nuevo', usuario?.id ?? 'anonimo', { asunto: '', texto: '' });

  const cargar = useCallback(() => {
    api
      .get<{ casos: CasoLista[] }>('/casos')
      .then((r) => setCasos(r.casos))
      .catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(cargar, [cargar]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    setEnviado('');
    try {
      // Lo escrito no se borra hasta que el servidor confirma que lo guardó.
      const r = await api.form<{ id: string; numero: string }>('/casos', formularioCaso(b.valores, archivos));
      b.limpiar();
      setArchivos([]);
      setEnviado(t('help.sent', { n: r.numero }));
      cargar();
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina>
      <div className="mb-4 flex items-center gap-2">
        <LifeBuoy className="h-6 w-6 text-marca" aria-hidden />
        <h1 className="text-2xl font-bold">{t('help.title')}</h1>
      </div>
      <p className="mb-4 text-sm text-tenue">{t('help.intro')}</p>

      <Tarjeta className="mb-6">
        <h2 className="mb-3 font-bold">{t('help.new')}</h2>
        <form onSubmit={enviar} className="space-y-4">
          <AvisoBorrador visible={b.recuperado} onEmpezar={() => { b.limpiar(); setArchivos([]); }} />
          <Campo etiqueta={t('help.subject')} placeholder={t('help.subjectPh')} required minLength={3} maxLength={120} value={b.valores.asunto} onChange={(e) => b.set('asunto', e.target.value)} />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-white">{t('help.message')}</span>
            <textarea
              required
              maxLength={4000}
              rows={5}
              placeholder={t('help.messagePh')}
              value={b.valores.texto}
              onChange={(e) => b.set('texto', e.target.value)}
              className="w-full rounded-xl border border-borde bg-[#0d1528] px-4 py-3 text-white outline-none placeholder:text-tenue/60 focus:border-marca"
            />
          </label>
          <Adjuntos archivos={archivos} onCambio={setArchivos} />
          {b.recuperado && archivos.length === 0 && <p className="text-xs text-tenue">{t('help.reattach')}</p>}
          {error && <Aviso tipo="error">{error}</Aviso>}
          {enviado && <Aviso tipo="exito">{enviado}</Aviso>}
          <Boton type="submit" cargando={enviando} className="w-full">
            <Send className="h-4 w-4" aria-hidden /> {t('help.send')}
          </Boton>
        </form>
      </Tarjeta>

      <h2 className="mb-3 font-bold">{t('help.myCases')}</h2>
      {!casos ? (
        !error && <Cargando />
      ) : casos.length === 0 ? (
        <p className="text-sm text-tenue">{t('help.empty')}</p>
      ) : (
        <div className="space-y-2">
          {casos.map((c) => (
            <Link key={c.id} to={`/help/${c.id}`} className="block">
              <Tarjeta className="flex items-center justify-between gap-3 hover:border-tenue">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.asunto}</p>
                  <p className="text-xs text-tenue">
                    {t('help.case', { n: c.numero })} · {new Date(c.actualizado_en).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <EstadoCasoChip estado={c.estado} />
                  <ChevronRight className="h-4 w-4 text-tenue" aria-hidden />
                </div>
              </Tarjeta>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-2 text-sm text-tenue">
        <Link to={rutaGuiaAyuda(idioma)} className="flex items-center gap-2 hover:text-white">
          <BookOpen className="h-4 w-4" aria-hidden /> {t('help.guide')}
        </Link>
        <p className="flex items-center gap-2">
          <Mail className="h-4 w-4" aria-hidden /> {t('help.email', { email: CORREO_SOPORTE })}
        </p>
      </div>
    </Pagina>
  );
}

export function HelpCase() {
  const { id = '' } = useParams();
  const { t, idioma } = useI18n();
  const { usuario } = useSesion();
  const msg = useMensajeError();
  const [datos, setDatos] = useState<{ caso: { numero: string; asunto: string; estado: EstadoCaso }; mensajes: MensajeCaso[] } | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [archivos, setArchivos] = useState<File[]>([]);
  const b = useBorrador(`caso-${id}`, usuario?.id ?? 'anonimo', { texto: '' });

  const cargar = useCallback(() => {
    api
      .get<NonNullable<typeof datos>>(`/casos/${id}`)
      .then(setDatos)
      .catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    cargar();
    // Mientras la pantalla está abierta, las respuestas nuevas aparecen solas.
    const reloj = setInterval(cargar, 30_000);
    return () => clearInterval(reloj);
  }, [cargar]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.form(`/casos/${id}/mensajes`, formularioCaso(b.valores, archivos));
      b.limpiar();
      setArchivos([]);
      cargar();
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!datos) return error ? <Pagina><Aviso tipo="error">{error}</Aviso></Pagina> : <Cargando />;
  const fecha = (iso: string) => new Date(iso).toLocaleString(idioma === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Pagina>
      <Link to="/help" className="mb-3 inline-block text-sm text-tenue hover:text-white">
        ← {t('help.title')}
      </Link>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{datos.caso.asunto}</h1>
          <p className="text-xs text-tenue">{t('help.case', { n: datos.caso.numero })}</p>
        </div>
        <EstadoCasoChip estado={datos.caso.estado} />
      </div>

      <ol className="mb-6 space-y-3" aria-label={t('help.myCases')}>
        {datos.mensajes.map((m, i) => {
          const mio = m.de === 'cliente';
          return (
            <li key={i} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl border px-4 py-3 ${mio ? 'border-marca/30 bg-marca/10' : 'border-borde bg-panel'}`}>
                <p className="mb-1 text-xs font-semibold text-tenue">
                  {mio ? t('help.you') : t('help.support')} · {fecha(m.fecha)}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{m.texto}</p>
                {m.adjuntos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.adjuntos.map((a, j) =>
                      a.url ? (
                        <a key={j} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={a.url} alt={a.nombre} className="h-24 w-24 rounded-lg border border-borde object-cover" />
                        </a>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Tarjeta>
        <form onSubmit={enviar} className="space-y-3">
          {datos.caso.estado === 'cerrado' && <p className="text-xs text-tenue">{t('help.closedNote')}</p>}
          <AvisoBorrador visible={b.recuperado} onEmpezar={() => { b.limpiar(); setArchivos([]); }} />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-white">{t('help.reply')}</span>
            <textarea
              required
              maxLength={4000}
              rows={3}
              placeholder={t('help.replyPh')}
              value={b.valores.texto}
              onChange={(e) => b.set('texto', e.target.value)}
              className="w-full rounded-xl border border-borde bg-[#0d1528] px-4 py-3 text-white outline-none placeholder:text-tenue/60 focus:border-marca"
            />
          </label>
          <Adjuntos archivos={archivos} onCambio={setArchivos} />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Boton type="submit" cargando={enviando} className="w-full">
            <Send className="h-4 w-4" aria-hidden /> {t('help.send')}
          </Boton>
        </form>
      </Tarjeta>
    </Pagina>
  );
}
