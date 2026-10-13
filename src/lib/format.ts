const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const mxnCompact = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat('es-MX', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** $1,234.56 */
export function formatMXN(value: number): string {
  return mxn.format(Number.isFinite(value) ? value : 0);
}

/** $1.2 M — para ejes de gráficas. */
export function formatMXNCompact(value: number): string {
  return mxnCompact.format(Number.isFinite(value) ? value : 0);
}

/** Recibe decimal (0.1234) y regresa "12.34 %". */
export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return percent.format(value);
}

export function formatInteger(value: number): string {
  return integer.format(value);
}

/** "3 años 2 meses" */
export function formatTerm(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`);
  if (rest > 0 || years === 0) parts.push(`${rest} ${rest === 1 ? 'mes' : 'meses'}`);
  return parts.join(' ');
}
