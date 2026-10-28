// Achica la foto antes de subirla (1600 px, calidad 0.8, WebP): sube rápido con datos del celular
// y la IA la sigue leyendo bien. Si el navegador no puede, se manda la original.
export async function prepararImagen(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.8));
    if (blob && blob.type === 'image/webp') return blob;
    const jpg = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return jpg ?? file;
  } catch {
    return file;
  }
}
