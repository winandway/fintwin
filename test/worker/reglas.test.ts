import { describe, expect, it } from 'vitest';
import { aCentavos, comisionDe, formatoDinero, normalizarConfirmacion } from '../../src/shared/reglas';
import { interpretar } from '../../src/worker/ocr';
import { tipoReal } from '../../src/worker/pagar';

describe('reglas', () => {
  it('convierte montos escritos de muchas formas', () => {
    expect(aCentavos('1,234.50')).toBe(123450);
    expect(aCentavos('$1234.5')).toBe(123450);
    expect(aCentavos('1.234,50')).toBe(123450);
    expect(aCentavos('0')).toBeNull();
    expect(aCentavos('abc')).toBeNull();
    expect(aCentavos(12.345)).toBe(1235);
  });
  it('normaliza el número de confirmación', () => {
    expect(normalizarConfirmacion(' ab-12 34. ')).toBe('AB1234');
    expect(normalizarConfirmacion('12')).toBeNull();
    expect(normalizarConfirmacion(null)).toBeNull();
  });
  it('comisión y formato', () => {
    expect(comisionDe(10000, 2.5)).toBe(250);
    expect(formatoDinero(123450)).toBe('$1,234.50');
  });
  it('la lectura de IA nunca deja pasar datos raros', () => {
    expect(interpretar({ is_receipt: true, amount: '99.9', date: '28/10/2026', confirmation: 'x' })).toMatchObject({
      es_comprobante: true,
      monto_cent: 9990,
      fecha: null,
      confirmacion: null,
    });
    expect(interpretar('basura').es_comprobante).toBe(false);
  });
  it('reconoce el tipo real de imagen', () => {
    expect(tipoReal(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg');
    expect(tipoReal(new TextEncoder().encode('RIFF1234WEBPVP8 '))?.ext).toBe('webp');
    expect(tipoReal(new TextEncoder().encode('GIF89a'))).toBeNull();
  });
});
