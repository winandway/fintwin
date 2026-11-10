import { useSyncExternalStore } from 'react';
import { useI18n } from './i18n';

// Qué cuentas tienen clave única para validar. Se anota cada vez que llega el detalle de una
// cuenta, y los diálogos de aprobar, rechazar y poner en espera piden «la clave única» en vez de
// «tu PIN» cuando corresponde. Nunca guarda la clave: solo si existe.
const activas = new Map<string, boolean>();
const oyentes = new Set<() => void>();

export function recordarClaveUnica(cuentaId: string, activa: boolean | undefined): void {
  if (activas.get(cuentaId) === Boolean(activa)) return;
  activas.set(cuentaId, Boolean(activa));
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

/** La etiqueta de la casilla al validar: «Escribe tu PIN» o «Escribe la clave única para validar». */
export function useEtiquetaValidar(cuentaId: string): string {
  const { t } = useI18n();
  const activa = useSyncExternalStore(suscribir, () => activas.get(cuentaId) ?? false);
  return activa ? t('unique.enter') : t('pin.title');
}
