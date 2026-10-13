/**
 * Tasa interna de retorno (TIR / IRR) por periodo para flujos equiespaciados.
 *
 * Resuelve NPV(r) = Σ flujo_t / (1 + r)^t = 0. Usa Newton-Raphson y, si no
 * converge o sale del dominio, cae a bisección en [-0.9999, 10].
 * Devuelve `null` cuando no hay cambio de signo en los flujos (no existe TIR).
 */
export function npv(rate: number, flows: readonly number[]): number {
  let total = 0;
  for (let t = 0; t < flows.length; t++) {
    total += (flows[t] ?? 0) / Math.pow(1 + rate, t);
  }
  return total;
}

function dNpv(rate: number, flows: readonly number[]): number {
  let total = 0;
  for (let t = 1; t < flows.length; t++) {
    total -= (t * (flows[t] ?? 0)) / Math.pow(1 + rate, t + 1);
  }
  return total;
}

export function irr(flows: readonly number[], guess = 0.01): number | null {
  const hasPositive = flows.some((f) => f > 0);
  const hasNegative = flows.some((f) => f < 0);
  if (!hasPositive || !hasNegative) return null;

  const tolerance = 1e-10;
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const value = npv(rate, flows);
    const derivative = dNpv(rate, flows);
    if (!Number.isFinite(value) || !Number.isFinite(derivative) || derivative === 0) break;
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < tolerance) return next;
    rate = next;
  }

  // Bisección como respaldo.
  let low = -0.9999;
  let high = 10;
  let fLow = npv(low, flows);
  const fHigh = npv(high, flows);
  if (Math.sign(fLow) === Math.sign(fHigh)) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (low + high) / 2;
    const fMid = npv(mid, flows);
    if (Math.abs(fMid) < 1e-9 || (high - low) / 2 < tolerance) return mid;
    if (Math.sign(fMid) === Math.sign(fLow)) {
      low = mid;
      fLow = fMid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

/** Convierte una tasa efectiva por periodo a tasa efectiva anual. */
export function annualizeRate(periodicRate: number, periodsPerYear: number): number {
  return Math.pow(1 + periodicRate, periodsPerYear) - 1;
}
