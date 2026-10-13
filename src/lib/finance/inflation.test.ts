import { describe, expect, it } from 'vitest';
import { realRate, toFuturePesos, toTodaysPesos } from './inflation';

describe('realRate (Fisher)', () => {
  it('aplica la fórmula exacta, no la resta aproximada', () => {
    expect(realRate(0.1, 0.04)).toBeCloseTo(1.1 / 1.04 - 1, 12);
    expect(realRate(0.1, 0.04)).not.toBeCloseTo(0.06, 4);
  });

  it('es cero cuando la tasa iguala a la inflación', () => {
    expect(realRate(0.05, 0.05)).toBeCloseTo(0, 12);
  });

  it('es negativa cuando la inflación supera a la tasa', () => {
    expect(realRate(0.02, 0.05)).toBeLessThan(0);
  });

  it('con inflación cero, real = nominal', () => {
    expect(realRate(0.08, 0)).toBeCloseTo(0.08, 12);
  });
});

describe('pesos de hoy / futuros', () => {
  it('son operaciones inversas', () => {
    const future = toFuturePesos(1000, 0.045, 36);
    expect(toTodaysPesos(future, 0.045, 36)).toBeCloseTo(1000, 8);
  });

  it('a 12 meses divide entre (1 + inflación)', () => {
    expect(toTodaysPesos(1040, 0.04, 12)).toBeCloseTo(1000, 8);
  });

  it('con plazo cero no cambia el monto', () => {
    expect(toTodaysPesos(500, 0.1, 0)).toBe(500);
  });
});
