import { describe, expect, it } from 'vitest';
import { annualizeRate, irr, npv } from './irr';

describe('npv', () => {
  it('descuenta flujos con la tasa dada', () => {
    expect(npv(0.1, [-100, 110])).toBeCloseTo(0, 10);
    expect(npv(0, [-100, 50, 50])).toBe(0);
  });
});

describe('irr', () => {
  it('encuentra la tasa de un flujo simple', () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 8);
  });

  it('coincide con una anualidad conocida', () => {
    // 1000 prestados, 12 pagos de 88.8488 => 1 % mensual
    const payment = (1000 * 0.01) / (1 - Math.pow(1.01, -12));
    const flows = [1000, ...Array<number>(12).fill(-payment)];
    expect(irr(flows)).toBeCloseTo(0.01, 8);
  });

  it('regresa 0 cuando se devuelve exactamente lo prestado', () => {
    expect(irr([-300, 100, 100, 100])).toBeCloseTo(0, 8);
  });

  it('maneja tasas negativas', () => {
    expect(irr([-100, 90])).toBeCloseTo(-0.1, 8);
  });

  it('regresa null si no hay cambio de signo', () => {
    expect(irr([100, 100])).toBeNull();
    expect(irr([-100, -5])).toBeNull();
    expect(irr([0, 0])).toBeNull();
  });

  it('converge aunque la semilla esté lejos', () => {
    expect(irr([-100, 300], 5)).toBeCloseTo(2, 6);
  });
});

describe('annualizeRate', () => {
  it('compone la tasa periódica', () => {
    expect(annualizeRate(0.01, 12)).toBeCloseTo(0.126825, 6);
    expect(annualizeRate(0, 12)).toBe(0);
  });
});
