import { FileImage, ImagePlus, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { prepararImagen } from '../lib/imagen';

export interface LecturaTicket {
  comercio: string | null;
  total_cent: number | null;
  fecha: string | null;
  categoria: string | null;
  resumen: string | null;
}

/**
 * Sube el ticket o la factura y la IA lo lee para llenar el formulario.
 * La imagen ya preparada (achicada) se devuelve en onArchivo para enviarla al guardar.
 */
export function TicketConIA({
  cuentaId,
  etiqueta,
  archivo,
  onArchivo,
  onLectura,
}: {
  cuentaId: string;
  etiqueta: string;
  archivo: Blob | null;
  onArchivo: (b: Blob | null) => void;
  onLectura: (l: LecturaTicket) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [estado, setEstado] = useState<'nada' | 'leido' | 'parcial'>('nada');

  async function elegir(f: File | undefined) {
    if (!f || !f.type.startsWith('image/')) return;
    const blob = await prepararImagen(f);
    onArchivo(blob);
    setEstado('nada');
    setLeyendo(true);
    try {
      const form = new FormData();
      form.append('archivo', blob, 'ticket');
      const r = await api.form<{ lectura_ia: boolean; lectura: LecturaTicket | null }>(`/cuentas/${cuentaId}/leer-ticket`, form);
      // Sin IA encendida no se dice nada: la persona llena los datos como siempre.
      if (!r.lectura_ia) setEstado('nada');
      else if (r.lectura) {
        onLectura(r.lectura);
        setEstado(r.lectura.total_cent && r.lectura.comercio ? 'leido' : 'parcial');
      } else setEstado('parcial');
    } catch {
      setEstado('parcial');
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-white">{etiqueta} *</span>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => void elegir(e.target.files?.[0])} data-testid="ticket" />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-4 text-sm ${
          archivo ? 'border-marca bg-marca/10 text-green-200' : 'border-borde text-tenue hover:border-marca hover:text-white'
        }`}
      >
        {leyendo ? <Loader2 className="h-5 w-5 animate-spin" /> : archivo ? <FileImage className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
        {leyendo ? t('expense.reading') : archivo ? t('pay.change') : t('expense.ticketHint')}
      </button>
      {estado !== 'nada' && !leyendo && (
        <p className={`text-xs ${estado === 'leido' ? 'text-green-300' : 'text-amber-300'}`}>
          {estado === 'leido' ? t('expense.read') : t('expense.readPartial')}
        </p>
      )}
    </div>
  );
}
