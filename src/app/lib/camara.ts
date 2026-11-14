// La cámara para toda casilla de imagen (regla global del 9 nov 2026).
// En el celular (y dentro de la app) se abre la cámara trasera del propio teléfono con
// <input capture="environment">. En la computadora se usa la cámara web en una ventanita.
import { esApp } from './nativo';

/** En el celular, tableta o la app, la cámara del sistema (trasera) es mejor que una ventana. */
export function usarCamaraDelSistema(): boolean {
  if (esApp()) return true;
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
  } catch {
    return false;
  }
}

/** ¿El navegador puede abrir la cámara web? (sin HTTPS o sin cámara, no). */
export function camaraWebDisponible(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

export function abrirCamaraWeb(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
}

export function apagarCamara(stream: MediaStream | null): void {
  stream?.getTracks().forEach((p) => p.stop());
}

/** El cuadro actual del video como foto JPEG, lista para la misma casilla de siempre. */
export async function fotoDelVideo(video: HTMLVideoElement): Promise<File | null> {
  const ancho = video.videoWidth;
  const alto = video.videoHeight;
  if (!ancho || !alto) return null;
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext('2d')?.drawImage(video, 0, 0, ancho, alto);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
  return blob ? new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }) : null;
}
