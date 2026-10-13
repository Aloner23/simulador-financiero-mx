import { annualizeRate, irr } from './irr';
import { realRate, toTodaysPesos } from './inflation';

/** Días promedio por mes (365/12). Las aportaciones se hacen al cierre de cada mes. */
export const DAYS_PER_MONTH = 365 / 12;

export type InstrumentKind = 'cetes' | 'pagare' | 'ahorro';

export interface InstrumentSpec {
  id: string;
  kind: InstrumentKind;
  label: string;
  /** Tasa anual nominal en decimal (0.10 = 10 %). */
  annualRate: number;
  /** Días de cada ciclo de inversión/capitalización (p. ej. 28 para CETES de 28 días). */
  periodDays: number;
  /** Base de días para calcular intereses: 360 (CETES, pagarés) o 365. */
  dayCountBasis: 360 | 365;
}

export interface InvestmentInput {
  initialAmount: number;
  monthlyContribution: number;
  months: number;
  /** Retención anual de ISR sobre el capital, en decimal (México retiene sobre capital, no sobre intereses). */
  isrRetentionRate: number;
  /** Inflación anual esperada en decimal. */
  inflationRate: number;
}

export interface InvestmentPoint {
  month: number;
  contributed: number;
  value: number;
  realValue: number;
}

export interface InvestmentResult {
  instrument: InstrumentSpec;
  finalValue: number;
  /** Valor final si no hubiera retención de ISR. */
  grossFinalValue: number;
  /** Diferencia entre el valor sin retención y el valor neto. */
  isrImpact: number;
  totalContributed: number;
  netGain: number;
  /** Valor final expresado en pesos de hoy. */
  realFinalValue: number;
  /** Rendimiento anual efectivo neto (TIR de los flujos, anualizada). */
  nominalAnnualReturn: number | null;
  /** Rendimiento real anual (Fisher). */
  realAnnualReturn: number | null;
  series: InvestmentPoint[];
}

/** CETES disponibles en subasta primaria (plazos en días). */
export const CETES_TERMS = [28, 91, 182, 364] as const;
export type CetesTerm = (typeof CETES_TERMS)[number];

/**
 * Factor de crecimiento de un peso invertido durante `days` días con reinversión
 * al vencimiento de cada ciclo. El ciclo en curso al final se valúa con intereses
 * devengados linealmente (sin capitalizar).
 */
export function growthFactor(spec: InstrumentSpec, isrRetentionRate: number, days: number): number {
  if (days <= 0) return 1;
  const perDayYield = spec.annualRate / spec.dayCountBasis - isrRetentionRate / 365;
  const cycleFactor = 1 + perDayYield * spec.periodDays;
  // Tolerancia numérica para que 12 ciclos de 365/12 días no se queden en 11.
  const fullCycles = Math.floor(days / spec.periodDays + 1e-9);
  const remainderDays = Math.max(0, days - fullCycles * spec.periodDays);
  return Math.pow(cycleFactor, fullCycles) * (1 + perDayYield * remainderDays);
}

interface Lot {
  amount: number;
  startDay: number;
}

function buildLots(input: InvestmentInput): Lot[] {
  const lots: Lot[] = [];
  if (input.initialAmount > 0) lots.push({ amount: input.initialAmount, startDay: 0 });
  if (input.monthlyContribution > 0) {
    for (let m = 1; m <= input.months; m++) {
      lots.push({ amount: input.monthlyContribution, startDay: m * DAYS_PER_MONTH });
    }
  }
  return lots;
}

function valueAt(lots: Lot[], spec: InstrumentSpec, isr: number, day: number): number {
  let total = 0;
  for (const lot of lots) {
    if (lot.startDay > day + 1e-9) continue;
    total += lot.amount * growthFactor(spec, isr, day - lot.startDay);
  }
  return total;
}

/**
 * Simula una inversión con aportaciones mensuales. Cada aportación se invierte en
 * un nuevo título/depósito el día que se hace y se reinvierte (capital + intereses
 * netos) en cada vencimiento.
 */
export function simulateInvestment(spec: InstrumentSpec, input: InvestmentInput): InvestmentResult {
  const months = Math.max(0, Math.floor(input.months));
  const normalized: InvestmentInput = { ...input, months };
  const lots = buildLots(normalized);
  const horizon = months * DAYS_PER_MONTH;

  const series: InvestmentPoint[] = [];
  for (let m = 0; m <= months; m++) {
    const day = m * DAYS_PER_MONTH;
    const value = valueAt(lots, spec, input.isrRetentionRate, day);
    series.push({
      month: m,
      contributed: input.initialAmount + input.monthlyContribution * m,
      value,
      realValue: toTodaysPesos(value, input.inflationRate, m),
    });
  }

  const finalValue = valueAt(lots, spec, input.isrRetentionRate, horizon);
  const grossFinalValue = valueAt(lots, spec, 0, horizon);
  const totalContributed = input.initialAmount + input.monthlyContribution * months;

  const flows: number[] = [-input.initialAmount];
  for (let m = 1; m <= months; m++) flows.push(-input.monthlyContribution);
  if (months > 0) flows[months] = (flows[months] ?? 0) + finalValue;
  const monthlyIrr = months > 0 ? irr(flows) : null;
  const nominalAnnualReturn = monthlyIrr === null ? null : annualizeRate(monthlyIrr, 12);

  return {
    instrument: spec,
    finalValue,
    grossFinalValue,
    isrImpact: grossFinalValue - finalValue,
    totalContributed,
    netGain: finalValue - totalContributed,
    realFinalValue: toTodaysPesos(finalValue, input.inflationRate, months),
    nominalAnnualReturn,
    realAnnualReturn:
      nominalAnnualReturn === null ? null : realRate(nominalAnnualReturn, input.inflationRate),
    series,
  };
}

/** Rendimiento de un ciclo de CETES: precio = VN / (1 + r·d/360). */
export function cetesPrice(faceValue: number, annualRate: number, days: number): number {
  return faceValue / (1 + (annualRate * days) / 360);
}
