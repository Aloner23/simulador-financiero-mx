import { describe, expect, it } from 'vitest';
import { planSavingsGoal, requiredMonthlyContribution, type SavingsGoalInput } from './savings';

const base: SavingsGoalInput = {
  goal: 120_000,
  months: 24,
  annualRate: 0.06,
  initialAmount: 0,
  inflationRate: 0,
  goalInTodaysPesos: false,
};

describe('requiredMonthlyContribution', () => {
  it('con tasa 0 es una división simple', () => {
    expect(requiredMonthlyContribution(12_000, 12, 0, 0)).toBe(1_000);
    expect(requiredMonthlyContribution(12_000, 12, 0, 6_000)).toBe(500);
  });

  it('invierte la fórmula de valor futuro de una anualidad', () => {
    const c = requiredMonthlyContribution(10_000, 10, 0.01, 0);
    const fv = (c * (Math.pow(1.01, 10) - 1)) / 0.01;
    expect(fv).toBeCloseTo(10_000, 8);
  });

  it('es 0 si el saldo inicial crecido ya alcanza la meta', () => {
    expect(requiredMonthlyContribution(1_000, 12, 0.01, 1_000)).toBe(0);
  });

  it('un solo mes', () => {
    expect(requiredMonthlyContribution(1_100, 1, 0.01, 0)).toBeCloseTo(1_100, 8);
    expect(requiredMonthlyContribution(1_100, 1, 0.01, 1_000)).toBeCloseTo(90, 8);
  });

  it('plazo 0: falta todo lo que no se tiene', () => {
    expect(requiredMonthlyContribution(1_000, 0, 0.01, 400)).toBe(600);
  });
});

describe('planSavingsGoal', () => {
  it('la simulación alcanza exactamente la meta', () => {
    const r = planSavingsGoal({ ...base, initialAmount: 5_000 });
    expect(r.series.at(-1)?.balance).toBeCloseTo(120_000, 6);
    expect(r.series).toHaveLength(25);
    expect(r.interestEarned).toBeCloseTo(120_000 - r.totalContributed, 6);
  });

  it('ajusta la meta por inflación si está en pesos de hoy', () => {
    const r = planSavingsGoal({ ...base, inflationRate: 0.04, goalInTodaysPesos: true });
    expect(r.nominalGoal).toBeCloseTo(120_000 * 1.04 * 1.04, 6);
    expect(r.series.at(-1)?.balance).toBeCloseTo(r.nominalGoal, 6);
  });

  it('marca la meta como alcanzada cuando no hace falta aportar', () => {
    const r = planSavingsGoal({ ...base, initialAmount: 200_000 });
    expect(r.alreadyReached).toBe(true);
    expect(r.monthlyContribution).toBe(0);
  });

  it('con tasa 0 los intereses son 0', () => {
    const r = planSavingsGoal({ ...base, annualRate: 0 });
    expect(r.monthlyContribution).toBe(5_000);
    expect(r.interestEarned).toBeCloseTo(0, 8);
  });
});
