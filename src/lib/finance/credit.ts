import { annualizeRate, irr } from './irr';

export type PrepaymentStrategy = 'reducir-plazo' | 'reducir-pago';

export interface Prepayment {
  /** Mes (1-indexado) en el que se hace el pago anticipado, después del pago regular. */
  month: number;
  amount: number;
}

export interface CreditInput {
  principal: number;
  /** Tasa de interés anual ordinaria en decimal. Se divide entre 12 (tasa mensual simple). */
  annualRate: number;
  months: number;
  /** Si es true se cobra IVA sobre los intereses (créditos personales/automotrices). */
  ivaOnInterest: boolean;
  /** Tasa de IVA en decimal; en México 0.16. */
  ivaRate?: number;
  /** Comisión por apertura, en decimal sobre el monto del crédito. */
  openingFeeRate?: number;
  /** Cargo fijo mensual (seguro, administración). */
  monthlyFee?: number;
  prepayments?: Prepayment[];
  strategy?: PrepaymentStrategy;
}

export interface AmortizationRow {
  period: number;
  openingBalance: number;
  /** Pago regular: capital + interés + IVA (sin cargos fijos ni pagos anticipados). */
  payment: number;
  interest: number;
  iva: number;
  principal: number;
  prepayment: number;
  fee: number;
  closingBalance: number;
}

export interface CreditResult {
  /** Pago mensual inicial (capital + interés + IVA). */
  initialPayment: number;
  rows: AmortizationRow[];
  totalInterest: number;
  totalIva: number;
  totalFees: number;
  totalPrepayments: number;
  totalPaid: number;
  openingFee: number;
  /** Número de pagos realmente efectuados. */
  actualMonths: number;
  /** CAT aproximado (sin IVA) sobre el calendario contractual, sin pagos anticipados. */
  catApprox: number | null;
}

const EPSILON = 0.005; // medio centavo

/** Pago fijo del sistema francés: P · i / (1 − (1 + i)^−n). */
export function fixedPayment(principal: number, periodicRate: number, periods: number): number {
  if (periods <= 0) return principal;
  if (periodicRate === 0) return principal / periods;
  return (principal * periodicRate) / (1 - Math.pow(1 + periodicRate, -periods));
}

function prepaymentMap(prepayments: Prepayment[] | undefined): Map<number, number> {
  const map = new Map<number, number>();
  for (const p of prepayments ?? []) {
    if (!(p.amount > 0) || !Number.isFinite(p.month)) continue;
    const month = Math.floor(p.month);
    if (month < 1) continue;
    map.set(month, (map.get(month) ?? 0) + p.amount);
  }
  return map;
}

/**
 * Tabla de amortización con pago fijo (sistema francés). Con IVA, el pago fijo se
 * calcula con la tasa i·(1 + IVA) para que capital + interés + IVA sea constante.
 */
export function amortize(input: CreditInput): CreditResult {
  const months = Math.max(0, Math.floor(input.months));
  const ivaRate = input.ivaOnInterest ? (input.ivaRate ?? 0.16) : 0;
  const i = input.annualRate / 12;
  const effectiveRate = i * (1 + ivaRate);
  const fee = input.monthlyFee ?? 0;
  const openingFee = input.principal * (input.openingFeeRate ?? 0);
  const strategy = input.strategy ?? 'reducir-plazo';
  const extra = prepaymentMap(input.prepayments);

  let payment = fixedPayment(input.principal, effectiveRate, months);
  const initialPayment = months > 0 && input.principal > 0 ? payment : 0;
  let balance = input.principal;
  const rows: AmortizationRow[] = [];

  for (let period = 1; period <= months && balance > EPSILON; period++) {
    const openingBalance = balance;
    const interest = openingBalance * i;
    const iva = interest * ivaRate;
    let principalPart = payment - interest - iva;
    if (principalPart > openingBalance || period === months) principalPart = openingBalance;
    const regularPayment = principalPart + interest + iva;
    balance = openingBalance - principalPart;

    let prepayment = Math.min(extra.get(period) ?? 0, balance);
    if (prepayment < 0) prepayment = 0;
    balance -= prepayment;
    if (balance < EPSILON) balance = 0;

    rows.push({
      period,
      openingBalance,
      payment: regularPayment,
      interest,
      iva,
      principal: principalPart,
      prepayment,
      fee,
      closingBalance: balance,
    });

    if (prepayment > 0 && strategy === 'reducir-pago' && balance > 0) {
      payment = fixedPayment(balance, effectiveRate, months - period);
    }
  }

  const sum = (pick: (r: AmortizationRow) => number) => rows.reduce((acc, r) => acc + pick(r), 0);
  const totalInterest = sum((r) => r.interest);
  const totalIva = sum((r) => r.iva);
  const totalFees = sum((r) => r.fee);
  const totalPrepayments = sum((r) => r.prepayment);
  const totalPaid = sum((r) => r.payment) + totalPrepayments + totalFees + openingFee;

  return {
    initialPayment,
    rows,
    totalInterest,
    totalIva,
    totalFees,
    totalPrepayments,
    totalPaid,
    openingFee,
    actualMonths: rows.length,
    catApprox: catApprox(input),
  };
}

/**
 * CAT aproximado: TIR mensual de los flujos del crédito, anualizada como
 * (1 + TIR)^12 − 1. Igual que la metodología de Banxico, excluye el IVA. Incluye
 * comisión por apertura y cargos fijos sólo si se capturan. Se calcula sobre el
 * calendario contractual (sin pagos anticipados).
 */
export function catApprox(input: CreditInput): number | null {
  const months = Math.max(0, Math.floor(input.months));
  if (months === 0 || input.principal <= 0) return null;
  const i = input.annualRate / 12;
  const payment = fixedPayment(input.principal, i, months);
  const fee = input.monthlyFee ?? 0;
  const openingFee = input.principal * (input.openingFeeRate ?? 0);
  const flows = [input.principal - openingFee];
  for (let t = 1; t <= months; t++) flows.push(-(payment + fee));
  const monthly = irr(flows, i || 0.01);
  return monthly === null ? null : annualizeRate(monthly, 12);
}
