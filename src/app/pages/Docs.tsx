import { BookOpen, LifeBuoy, Rocket, Search } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { buscarGuias, GUIAS, rutaDocs, type Bloque, type IdiomaDocs } from '../lib/docs';
import { useI18n, type Idioma } from '../lib/i18n';
import { NotFound } from './Publicas';

/**
 * El idioma lo manda la dirección: /docs en inglés, /es/docs en español. Si la persona cambia el
 * idioma con el selector, se la lleva a la misma guía en el otro idioma.
 */
function useIdiomaDocs(): IdiomaDocs {
  const { idioma, setIdioma } = useI18n();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const deUrl: IdiomaDocs = pathname.startsWith('/es/') ? 'es' : 'en';
  const previo = useRef<Idioma | null>(null);
  useEffect(() => {
    const antes = previo.current;
    previo.current = idioma;
    if (idioma === deUrl) return;
    if (antes === null || antes === idioma) setIdioma(deUrl);
    else navigate(deUrl === 'es' ? pathname.replace(/^\/es/, '') : `/es${pathname}`, { replace: true });
  }, [idioma, deUrl, pathname, navigate, setIdioma]);
  return deUrl;
}

const SECCIONES = [
  { id: 'empezar', titulo: 'docs.sectionStart', icono: <Rocket className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'soporte', titulo: 'docs.sectionSupport', icono: <LifeBuoy className="h-3.5 w-3.5" aria-hidden /> },
] as const;

function MarcoDocs({ idioma, children }: { idioma: IdiomaDocs; children: ReactNode }) {
  const { t } = useI18n();
  const enlace = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-white/10 font-semibold text-white' : 'text-tenue hover:text-white'}`;
  const menu = (
    <nav aria-label={t('docs.title')} className="space-y-4">
      <NavLink to={rutaDocs(idioma)} end className={enlace}>
        <BookOpen className="h-4 w-4" aria-hidden /> {t('docs.title')}
      </NavLink>
      {SECCIONES.map((s) => (
        <div key={s.id}>
          <p className="mb-1 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-tenue">
            {s.icono} {t(s.titulo)}
          </p>
          {GUIAS.filter((g) => g.seccion === s.id).map((g) => (
            <NavLink key={g.slug} to={rutaDocs(idioma, g.slug)} className={enlace}>
              {g.titulo[idioma]}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
  return (
    <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-6">
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-20">{menu}</div>
      </aside>
      <div className="min-w-0 flex-1">
        <details className="mb-4 rounded-xl border border-borde bg-panel p-2 md:hidden">
          <summary className="cursor-pointer px-2 py-1 text-sm font-semibold">{t('docs.title')}</summary>
          <div className="mt-2">{menu}</div>
        </details>
        {children}
      </div>
    </div>
  );
}

export function DocsIndex() {
  const idioma = useIdiomaDocs();
  const { t } = useI18n();
  const [consulta, setConsulta] = useState('');
  const buscador = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.title = `${t('docs.title')} · FinTwin`;
    // ⌘K o Ctrl+K lleva al buscador.
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        buscador.current?.focus();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [t]);
  const guias = buscarGuias(consulta, idioma);
  return (
    <MarcoDocs idioma={idioma}>
      <h1 className="text-3xl font-bold">{t('docs.title')}</h1>
      <p className="mb-5 mt-1 text-tenue">{t('docs.intro')}</p>
      <label className="mb-6 flex items-center gap-3 rounded-2xl border border-borde bg-panel px-4 py-3 focus-within:border-marca">
        <Search className="h-5 w-5 text-tenue" aria-hidden />
        <input
          ref={buscador}
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder={t('docs.search')}
          aria-label={t('docs.search')}
          className="w-full bg-transparent text-lg text-white outline-none placeholder:text-tenue/60"
        />
        <kbd className="hidden rounded border border-borde px-1.5 py-0.5 text-xs text-tenue sm:inline">⌘K</kbd>
      </label>
      {guias.length === 0 && <p className="text-sm text-tenue">{t('docs.noResults')}</p>}
      {SECCIONES.map((s) => {
        const deLaSeccion = guias.filter((g) => g.seccion === s.id);
        if (deLaSeccion.length === 0) return null;
        return (
          <section key={s.id} className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-tenue">
              {s.icono} {t(s.titulo)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {deLaSeccion.map((g) => (
                <Link key={g.slug} to={rutaDocs(idioma, g.slug)} className="rounded-2xl border border-borde bg-panel p-4 hover:border-tenue">
                  <p className="font-semibold">{g.titulo[idioma]}</p>
                  <p className="mt-1 text-sm text-tenue">{g.resumen[idioma]}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </MarcoDocs>
  );
}

function Contenido({ b }: { b: Bloque }) {
  switch (b.tipo) {
    case 'p':
      return <p className="leading-relaxed text-slate-200">{b.texto}</p>;
    case 'h2':
      return <h2 className="pt-2 text-xl font-bold">{b.texto}</h2>;
    case 'pasos':
      return (
        <ol className="list-decimal space-y-1.5 pl-6 text-slate-200">
          {b.items.map((i) => <li key={i}>{i}</li>)}
        </ol>
      );
    case 'lista':
      return (
        <ul className="list-disc space-y-1.5 pl-6 text-slate-200">
          {b.items.map((i) => <li key={i}>{i}</li>)}
        </ul>
      );
    case 'imagen':
      return <img src={b.src} alt={b.alt} loading="lazy" className="mx-auto max-h-[36rem] rounded-2xl border border-borde" />;
    case 'nota':
      return <p className="rounded-xl border border-borde bg-panel px-4 py-3 text-sm text-tenue">{b.texto}</p>;
  }
}

export function DocsGuia() {
  const idioma = useIdiomaDocs();
  const { t } = useI18n();
  const { slug } = useParams();
  const guia = GUIAS.find((g) => g.slug === slug);
  useEffect(() => {
    if (guia) document.title = `${guia.titulo[idioma]} · FinTwin Docs`;
  }, [guia, idioma]);
  if (!guia) return <NotFound />;
  return (
    <MarcoDocs idioma={idioma}>
      <Link to={rutaDocs(idioma)} className="mb-3 inline-block text-sm text-tenue hover:text-white">
        ← {t('docs.back')}
      </Link>
      <article className="space-y-4">
        <h1 className="text-3xl font-bold">{guia.titulo[idioma]}</h1>
        <p className="text-lg text-tenue">{guia.resumen[idioma]}</p>
        {guia.cuerpo[idioma].map((b, i) => <Contenido key={i} b={b} />)}
      </article>
    </MarcoDocs>
  );
}
