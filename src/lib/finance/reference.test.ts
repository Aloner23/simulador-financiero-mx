/**
 * Regresión contra valores de referencia calculados de forma independiente en Python
 * (numpy-financial: pmt, irr, fv) y fórmulas cerradas, no con este código.
 */
import { describe, expect, it } from 'vitest';
import { amortize, catApprox } from './credit';
import { growthFactor, simulateInvestment, type InstrumentSpec } from './investment';
import { planSavingsGoal } from './savings';
import { realRate } from './inflation';

const close = (actual: number | null, expected: number, digits = 2) =>
  expect(actual).toBeCloseTo(expected, digits);

describe('referencias independientes: crédito', () => {
  const base = { principal: 300000, annualRate: 0.24, months: 36, ivaOnInterest: false };

  it('pago fijo, intereses totales y saldo final', () => {
    const r = amortize(base);
    close(r.initialPayment, 11769.86);
    close(r.totalInterest, 123714.81);
    expect(r.rows.at(-1)?.closingBalance).toBe(0);
    close(r.catApprox, 0.268242, 5);
  });

  it('IVA sobre intereses: pago con i·1.16 y IVA = 16 % del interés', () => {
    const r = amortize({ ...base, ivaOnInterest: true });
    close(r.initialPayment, 12383.16);
    close(r.totalInterest, 125684.23);
    close(r.totalIva / r.totalInterest, 0.16, 10);
    // El CAT excluye el IVA.
    close(r.catApprox, 0.268242, 5);
  });

  it('CAT con comisión por apertura de 2 % y cargo fijo de $150', () => {
    close(
      catApprox({ ...base, ivaOnInterest: true, openingFeeRate: 0.02, monthlyFee: 150 }),
      0.299351,
      5,
    );
  });

  const prepay = {
    principal: 300000,
    annualRate: 0.18,
    months: 48,
    ivaOnInterest: true,
    prepayments: [
      { month: 12, amount: 40000 },
      { month: 24, amount: 30000 },
    ],
  };

  it('anticipos con reducir plazo', () => {
    const r = amortize({ ...prepay, strategy: 'reducir-plazo' });
    close(r.initialPayment, 9270.36);
    close(r.totalInterest, 91360.21);
    expect(r.actualMonths).toBe(37);
    expect(r.rows.at(-1)?.closingBalance).toBe(0);
  });

  it('anticipos con reducir pago', () => {
    const r = amortize({ ...prepay, strategy: 'reducir-pago' });
    close(r.totalInterest, 106774.52);
    expect(r.actualMonths).toBe(48);
    expect(r.rows.at(-1)?.closingBalance).toBe(0);
  });
});

describe('referencias independientes: inversión', () => {
  const cetes28: InstrumentSpec = {
    id: 'c28',
    kind: 'cetes',
    label: 'CETES 28',
    annualRate: 0.07,
    periodDays: 28,
    dayCountBasis: 360,
  };

  it('13 ciclos de 28 días = (1 + (r/360 − isr/365)·28)^13', () => {
    close(growthFactor(cetes28, 0.009, 364), 1.063596398, 8);
  });

  it('CETES 28 a 12 meses con y sin ISR, y Fisher', () => {
    const input = {
      initialAmount: 100000,
      monthlyContribution: 0,
      months: 12,
      isrRetentionRate: 0.009,
      inflationRate: 0.04,
    };
    const r = simulateInvestment(cetes28, input);
    close(r.finalValue, 106377.7);
    close(r.grossFinalValue, 107334.53);
    close(r.nominalAnnualReturn, 0.063777, 5);
    close(r.realAnnualReturn, 0.022862, 5);
  });

  it('CETES 91 con aportaciones mensuales a 24 meses', () => {
    const r = simulateInvestment(
      { ...cetes28, periodDays: 91 },
      {
        initialAmount: 50000,
        monthlyContribution: 2000,
        months: 24,
        isrRetentionRate: 0.009,
        inflationRate: 0.04,
      },
    );
    close(r.finalValue, 107491.08);
    close(r.nominalAnnualReturn, 0.063436, 5);
  });
});

describe('referencias independientes: ahorro y Fisher', () => {
  const base = {
    goal: 500000,
    months: 60,
    annualRate: 0.08,
    initialAmount: 20000,
    inflationRate: 0.04,
  };
  it('meta nominal', () => {
    const r = planSavingsGoal({ ...base, goalInTodaysPesos: false });
    close(r.monthlyContribution, 6399.34);
    close(r.series.at(-1)?.balance ?? NaN, 500000);
  });
  it('meta en pesos de hoy', () => {
    const r = planSavingsGoal({ ...base, goalInTodaysPesos: true });
    close(r.nominalGoal, 608326.45);
    close(r.monthlyContribution, 7873.63);
  });
  it('Fisher exacto', () => close(realRate(0.1, 0.04), 0.0576923, 7));
});
