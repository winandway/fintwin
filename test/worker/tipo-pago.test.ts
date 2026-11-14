import { describe, expect, it } from 'vitest';
import { tipoPagoAGuardar } from '../../src/shared/reglas';
import { crearMundo, PNG } from './helpers';

// C-TIPO-PAGO-1: quien paga elige el tipo de pago en el link (o escribe «Otro») y queda guardado.
describe('tipo de pago en el link', () => {
  it('la regla: clave conocida, «otro» con texto, vacío opcional, «otro» sin texto falta', () => {
    expect(tipoPagoAGuardar('zelle', '')).toBe('zelle');
    expect(tipoPagoAGuardar('otro', '  Binance   Pay ')).toBe('otro:Binance Pay');
    expect(tipoPagoAGuardar('', '')).toBeNull();
    expect(tipoPagoAGuardar('inventado', '')).toBeNull();
    expect(tipoPagoAGuardar('otro', '   ')).toBe('falta_otro');
  });

  it('se guarda al subir, lo ve el equipo de la cuenta y quien pagó en su historial', async () => {
    const w = crearMundo();
    const dueno = await w.usuario('dueno@example.com', 'Dueña');
    const cliente = await w.usuario('cliente@example.com', 'Cliente');
    const c = await w.call('POST', '/datos/cuentas', { cookie: dueno, body: { nombre: 'Centro', pin: '1234' } });
    const slug = (await w.call('GET', `/datos/cuentas/${c.data.id}`, { cookie: dueno })).data.cuenta.link_slug;

    const sinTexto = await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '10', confirmacion: 'AA112233', tipo_pago: 'otro' }) });
    expect(sinTexto.status).toBe(422);
    expect(sinTexto.data.error).toBe('tipo_pago_otro');

    const a = await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '10', confirmacion: 'AA112233', tipo_pago: 'zelle' }) });
    expect(a.status).toBe(201);
    const b = await w.call('POST', `/datos/pagar/${slug}/subir`, {
      cookie: cliente,
      form: w.captura({ monto: '20', confirmacion: 'BB445566', tipo_pago: 'otro', tipo_pago_otro: 'Binance' }, new Uint8Array([...PNG, 9])),
    });
    expect(b.status).toBe(201);

    const mios = (await w.call('GET', '/datos/mis-pagos', { cookie: cliente })).data.comprobantes;
    expect(mios.map((k: { tipo_pago: string }) => k.tipo_pago).sort()).toEqual(['otro:Binance', 'zelle']);
    const mov = (await w.call('GET', `/datos/cuentas/${c.data.id}/movimientos`, { cookie: dueno })).data.movimientos;
    expect(mov.map((k: { tipo_pago: string }) => k.tipo_pago).sort()).toEqual(['otro:Binance', 'zelle']);
  });
});
