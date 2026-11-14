import { Camera, Loader2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { abrirCamaraWeb, apagarCamara, camaraWebDisponible, fotoDelVideo, usarCamaraDelSistema } from '../lib/camara';
import { useI18n } from '../lib/i18n';

/**
 * «Tomar foto»: la pieza ÚNICA de cámara de FinTwin. Entrega la foto con onFoto, igual que si se
 * hubiera elegido desde archivos, para que pase por la misma validación y compresión.
 * Sin cámara o sin permiso lo dice en palabras; subir desde archivos sigue funcionando.
 */
export function BotonCamara({ onFoto, className = '' }: { onFoto: (f: File) => void; className?: string }) {
  const { t } = useI18n();
  const sistema = useRef<HTMLInputElement>(null);
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState('');

  function tocar() {
    setError('');
    if (usarCamaraDelSistema()) sistema.current?.click();
    else if (camaraWebDisponible()) setAbierta(true);
    else setError(t('camera.noCamera'));
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <input
        ref={sistema}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="camara-sistema"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFoto(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={tocar}
        className="flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-xl border border-borde bg-panel px-3 py-2.5 text-center text-sm font-semibold text-white hover:border-marca"
        data-testid="tomar-foto"
      >
        <Camera className="h-4 w-4 shrink-0 text-marca" aria-hidden /> {t('camera.take')}
      </button>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-amber-300">
          {error}
        </p>
      )}
      {abierta && (
        <VentanaCamara
          onFoto={(f) => {
            setAbierta(false);
            onFoto(f);
          }}
          onCerrar={() => setAbierta(false)}
          onError={() => {
            setAbierta(false);
            setError(t('camera.noCamera'));
          }}
        />
      )}
    </div>
  );
}

/** Los dos botones de toda casilla de imagen: «Subir desde archivos» y «Tomar foto». */
export function SubirOFoto({ onArchivos, onFoto }: { onArchivos: () => void; onFoto: (f: File) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onArchivos}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-borde bg-panel px-3 py-2.5 text-center text-sm font-semibold text-white hover:border-marca"
        data-testid="subir-archivos"
      >
        <Upload className="h-4 w-4 shrink-0 text-marca" aria-hidden /> {t('camera.files')}
      </button>
      <BotonCamara onFoto={onFoto} />
    </div>
  );
}

function VentanaCamara({ onFoto, onCerrar, onError }: { onFoto: (f: File) => void; onCerrar: () => void; onError: () => void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [lista, setLista] = useState(false);
  // Las funciones del padre cambian en cada pintada; la cámara se abre UNA vez y no se reinicia.
  const avisos = useRef({ onCerrar, onError });
  useEffect(() => {
    avisos.current = { onCerrar, onError };
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let viva = true;
    abrirCamaraWeb()
      .then((s) => {
        if (!viva) return apagarCamara(s);
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => undefined);
        }
        setLista(true);
      })
      .catch(() => viva && avisos.current.onError());
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && avisos.current.onCerrar();
    window.addEventListener('keydown', tecla);
    return () => {
      viva = false;
      window.removeEventListener('keydown', tecla);
      apagarCamara(stream);
    };
  }, []);

  async function capturar() {
    if (!video.current) return;
    const f = await fotoDelVideo(video.current);
    if (f) onFoto(f);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t('camera.title')} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg space-y-3 rounded-2xl border border-borde bg-panel p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{t('camera.title')}</p>
          <button type="button" onClick={onCerrar} aria-label={t('camera.cancel')} className="rounded p-1 text-tenue hover:text-white">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black">
          <video ref={video} playsInline muted className="h-full w-full object-contain" />
          {!lista && <Loader2 className="absolute h-8 w-8 animate-spin text-tenue" aria-hidden />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCerrar} className="rounded-xl border border-borde px-3 py-2.5 text-sm font-semibold text-white">
            {t('camera.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void capturar()}
            disabled={!lista}
            className="flex items-center justify-center gap-2 rounded-xl bg-marca px-3 py-2.5 text-sm font-semibold text-[#05210f] disabled:opacity-50"
          >
            <Camera className="h-4 w-4" aria-hidden /> {t('camera.capture')}
          </button>
        </div>
      </div>
    </div>
  );
}
