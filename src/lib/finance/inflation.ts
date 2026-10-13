/**
 * Ecuación de Fisher: (1 + nominal) = (1 + real) × (1 + inflación).
 * Todas las tasas en decimal (0.10 = 10 %).
 */
export function realRate(nominalRate: number, inflationRate: number): number {
  return (1 + nominalRate) / (1 + inflationRate) - 1;
}

/** Expresa un monto futuro en pesos de hoy, descontando la inflación anual. */
export function toTodaysPesos(amount: number, inflationRate: number, months: number): number {
  return amount / Math.pow(1 + inflationRate, months / 12);
}

/** Expresa un monto en pesos de hoy como su equivalente nominal en el futuro. */
export function toFuturePesos(amount: number, inflationRate: number, months: number): number {
  return amount * Math.pow(1 + inflationRate, months / 12);
}
