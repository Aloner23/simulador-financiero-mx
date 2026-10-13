import { toFuturePesos } from './inflation';

export interface SavingsGoalInput {
  /** Meta en pesos. Si `goalInTodaysPesos` es true se ajusta por inflación. */
  goal: number;
  months: number;
  /** Rendimiento anual esperado en decimal, capitalizable mensualmente. */
  annualRate: number;
  initialAmount: number;
  inflationRate: number;
  goalInTodaysPesos: boolean;
}

export interface SavingsGoalPoint {
  month: number;
  balance: number;
  contributed: number;
}

export interface SavingsGoalResult {
  /** Meta nominal que hay que alcanzar al final del plazo. */
  nominalGoal: number;
  /** Aportación mensual requerida (al cierre de cada mes). 0 si el saldo inicial ya basta. */
  monthlyContribution: number;
  totalContributed: number;
  interestEarned: number;
  alreadyReached: boolean;
  series: SavingsGoalPoint[];
}

/**
 * Aportación mensual C tal que P(1+i)^n + C·((1+i)^n − 1)/i = Meta.
 * Con i = 0: C = (Meta − P)/n.
 */
export function requiredMonthlyContribution(
  goal: number,
  months: number,
  monthlyRate: number,
  initialAmount: number,
): number {
  const n = Math.floor(months);
  if (n <= 0) return Math.max(0, goal - initialAmount);
  const growth = Math.pow(1 + monthlyRate, n);
  const remaining = goal - initialAmount * growth;
  if (remaining <= 0) return 0;
  if (monthlyRate === 0) return remaining / n;
  return (remaining * monthlyRate) / (growth - 1);
}

export function planSavingsGoal(input: SavingsGoalInput): SavingsGoalResult {
  const months = Math.max(0, Math.floor(input.months));
  const i = input.annualRate / 12;
  const nominalGoal = input.goalInTodaysPesos
    ? toFuturePesos(input.goal, input.inflationRate, months)
    : input.goal;
  const contribution = requiredMonthlyContribution(nominalGoal, months, i, input.initialAmount);

  const series: SavingsGoalPoint[] = [
    { month: 0, balance: input.initialAmount, contributed: input.initialAmount },
  ];
  let balance = input.initialAmount;
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + i) + contribution;
    series.push({ month: m, balance, contributed: input.initialAmount + contribution * m });
  }
  const totalContributed = input.initialAmount + contribution * months;

  return {
    nominalGoal,
    monthlyContribution: contribution,
    totalContributed,
    interestEarned: balance - totalContributed,
    alreadyReached:
      contribution === 0 && input.initialAmount * Math.pow(1 + i, months) >= nominalGoal,
    series,
  };
}
