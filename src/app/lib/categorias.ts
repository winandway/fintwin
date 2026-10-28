import type { Clave } from './i18n';

// Las mismas categorías que devuelve la IA en el servidor (src/worker/ocr.ts).
export const CATEGORIAS = [
  'supermercado', 'restaurante', 'gasolina', 'farmacia', 'salud', 'servicios', 'transporte',
  'hogar', 'ropa', 'tecnologia', 'educacion', 'entretenimiento', 'arriendo', 'impuestos', 'proveedores', 'otros',
] as const;

export const claveCategoria = (c: string | null | undefined): Clave =>
  (c && (CATEGORIAS as readonly string[]).includes(c) ? `cat.${c}` : 'cat.none') as Clave;
