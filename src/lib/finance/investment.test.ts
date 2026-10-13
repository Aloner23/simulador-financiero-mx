import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_MONTH,
  cetesPrice,
  growthFactor,
  simulateInvestment,
  type InstrumentSpec,
  type InvestmentInput,
} from './investment';

const cetes28: InstrumentSpec = {
  id: 'cetes-28',
  kind: 'cetes',
  label: 'CETES 28',
  annualRate: 0.1,
  periodDays: 28,
  dayCountBasis: 360,
};

const base: InvestmentInput = {
  initialAmount: 10_000,
  monthlyContribution: 0,
  months: 12,
  isrRetentionRate: 0,
  inflationRate: 0,
};

describe('growthFactor', () => {
  it('es 1 con 0 días', () => {
    expect(growthFactor(cetes28, 0, 0)).toBe(1);
  });

  it('un ciclo completo rinde r·d/360', () => {
    expect(growthFactor(cetes28, 0, 28)).toBeCloseTo(1 + (0.1 * 28) / 360, 12);
  });

  it('reinvierte ciclos completos y devenga linealmente el resto', () => {
    const cycle = 1 + (0.1 * 28) / 360;
    const expected = cycle * cycle * (1 + (0.1 / 360) * 10);
    expect(growthFactor(cetes28, 0, 66)).toBeCloseTo(expected, 12);
  });

  it('la retención de ISR reduce el rendimiento diario sobre capital', () => {
    const net = growthFactor(cetes28, 0.005, 28);
    expect(net).toBeCloseTo(1 + 28 * (0.1 / 360 - 0.005 / 365), 12);
  });

  it('cuenta 12 ciclos mensuales en un año aunque haya error de redondeo', () => {
    const monthly: InstrumentSpec = { ...cetes28, periodDays: DAYS_PER_MONTH, dayCountBasis: 365 };
    expect(growthFactor(monthly, 0, 365)).toBeCloseTo(Math.pow(1 + 0.1 / 12, 12), 10);
  });
});

describe('simulateInvestment', () => {
  it('con tasa 0 y sin ISR, el valor final es lo aportado', () => {
    const r = simulateInvestment(
      { ...cetes28, annualRate: 0 },
      { ...base, monthlyContribution: 1_000 },
    );
    expect(r.totalContributed).toBe(22_000);
    expect(r.finalValue).toBeCloseTo(22_000, 8);
    expect(r.netGain).toBeCloseTo(0, 8);
    expect(r.nominalAnnualReturn).toBeCloseTo(0, 6);
  });

  it('la cuenta de ahorro mensual coincide con interés compuesto mensual', () => {
    const ahorro: InstrumentSpec = {
      id: 'ahorro',
      kind: 'ahorro',
      label: 'Ahorro',
      annualRate: 0.06,
      periodDays: DAYS_PER_MONTH,
      dayCountBasis: 365,
    };
    const r = simulateInvestment(ahorro, base);
    expect(r.finalValue).toBeCloseTo(10_000 * Math.pow(1.005, 12), 6);
    expect(r.nominalAnnualReturn).toBeCloseTo(Math.pow(1.005, 12) - 1, 6);
  });

  it('aportaciones mensuales con tasa mensual reproducen el valor futuro de una anualidad', () => {
    const ahorro: InstrumentSpec = {
      id: 'ahorro',
      kind: 'ahorro',
      label: 'Ahorro',
      annualRate: 0.12,
      periodDays: DAYS_PER_MONTH,
      dayCountBasis: 365,
    };
    const r = simulateInvestment(ahorro, { ...base, initialAmount: 0, monthlyContribution: 500 });
    const fv = (500 * (Math.pow(1.01, 12) - 1)) / 0.01;
    expect(r.finalValue).toBeCloseTo(fv, 6);
  });

  it('el valor real descuenta la inflación del periodo', () => {
    const r = simulateInvestment(cetes28, { ...base, inflationRate: 0.04 });
    expect(r.realFinalValue).toBeCloseTo(r.finalValue / 1.04, 6);
    expect(r.realAnnualReturn).toBeCloseTo((1 + (r.nominalAnnualReturn ?? 0)) / 1.04 - 1, 10);
  });

  it('reporta el impacto del ISR como diferencia contra el escenario sin retención', () => {
    const r = simulateInvestment(cetes28, { ...base, isrRetentionRate: 0.005 });
    expect(r.isrImpact).toBeGreaterThan(0);
    expect(r.grossFinalValue - r.finalValue).toBeCloseTo(r.isrImpact, 10);
    // Aproximadamente 0.5 % anual sobre 10 mil
    expect(r.isrImpact).toBeGreaterThan(45);
    expect(r.isrImpact).toBeLessThan(60);
  });

  it('plazos más cortos capitalizan más seguido con la misma tasa', () => {
    const r28 = simulateInvestment(cetes28, { ...base, months: 24 });
    const r364 = simulateInvestment({ ...cetes28, periodDays: 364 }, { ...base, months: 24 });
    expect(r28.finalValue).toBeGreaterThan(r364.finalValue);
  });

  it('serie mensual empieza en el monto inicial y tiene meses + 1 puntos', () => {
    const r = simulateInvestment(cetes28, { ...base, monthlyContribution: 100 });
    expect(r.series).toHaveLength(13);
    expect(r.series[0]).toMatchObject({ month: 0, value: 10_000, contributed: 10_000 });
    expect(r.series.at(-1)?.value).toBeCloseTo(r.finalValue, 8);
  });

  it('plazo de un solo mes', () => {
    const r = simulateInvestment(cetes28, { ...base, months: 1 });
    expect(r.series).toHaveLength(2);
    expect(r.finalValue).toBeGreaterThan(10_000);
  });

  it('plazo 0 no truena y no calcula rendimiento', () => {
    const r = simulateInvestment(cetes28, { ...base, months: 0 });
    expect(r.finalValue).toBe(10_000);
    expect(r.nominalAnnualReturn).toBeNull();
  });

  it('sin dinero no hay rendimiento', () => {
    const r = simulateInvestment(cetes28, { ...base, initialAmount: 0 });
    expect(r.finalValue).toBe(0);
    expect(r.nominalAnnualReturn).toBeNull();
  });
});

describe('cetesPrice', () => {
  it('descuenta el valor nominal de 10 pesos', () => {
    expect(cetesPrice(10, 0.1, 28)).toBeCloseTo(10 / (1 + (0.1 * 28) / 360), 10);
  });
});
