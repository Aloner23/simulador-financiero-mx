import type { AmortizationRow } from './finance/credit';

function escapeCell(value: string | number): string {
  const text = typeof value === 'number' ? value.toFixed(2) : value;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

export const AMORTIZATION_HEADER = [
  'Periodo',
  'Saldo inicial',
  'Pago',
  'Interes',
  'IVA',
  'Capital',
  'Pago anticipado',
  'Cargos',
  'Saldo final',
];

export function amortizationCsv(rows: AmortizationRow[]): string {
  return toCsv(
    AMORTIZATION_HEADER,
    rows.map((r) => [
      String(r.period),
      r.openingBalance,
      r.payment,
      r.interest,
      r.iva,
      r.principal,
      r.prepayment,
      r.fee,
      r.closingBalance,
    ]),
  );
}

/** Descarga texto como archivo. El BOM hace que Excel lea UTF-8 correctamente. */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
