import { describe, expect, it } from 'vitest';
import { amortizationCsv, toCsv } from './csv';
import { formatMXN, formatPercent, formatTerm } from './format';
import { amortize } from './finance/credit';
import { parsePairs, parseState, serializePairs, writeState, type Schema } from './urlState';

const normalize = (s: string) => s.replace(/\u00a0/g, ' ');

describe('format', () => {
  it('formatea pesos mexicanos con es-MX', () => {
    expect(normalize(formatMXN(1234567.891))).toBe('$1,234,567.89');
    expect(normalize(formatMXN(Number.NaN))).toBe('$0.00');
  });

  it('formatea porcentajes y nulos', () => {
    expect(normalize(formatPercent(0.1234))).toMatch(/12\.34\s?%/);
    expect(formatPercent(null)).toBe('—');
  });

  it('describe plazos en años y meses', () => {
    expect(formatTerm(1)).toBe('1 mes');
    expect(formatTerm(12)).toBe('1 año');
    expect(formatTerm(26)).toBe('2 años 2 meses');
    expect(formatTerm(0)).toBe('0 meses');
  });
});

describe('csv', () => {
  it('escapa comas y comillas', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'di "hola"']])).toBe('a,b\r\n"x,y","di ""hola"""');
  });

  it('exporta una fila por periodo más encabezado', () => {
    const r = amortize({ principal: 1_000, annualRate: 0.12, months: 3, ivaOnInterest: false });
    const lines = amortizationCsv(r.rows).split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[1]?.startsWith('1,1000.00,')).toBe(true);
    expect(lines[3]?.endsWith(',0.00')).toBe(true);
  });
});

describe('urlState', () => {
  const schema = {
    monto: { type: 'number', default: 1000, min: 0, max: 5000 },
    iva: { type: 'boolean', default: true },
    modo: { type: 'enum', default: 'a', options: ['a', 'b'] },
  } satisfies Schema;

  it('usa defaults ante valores ausentes o inválidos', () => {
    expect(parseState(schema, new URLSearchParams('monto=abc&iva=quizas&modo=z'))).toEqual({
      monto: 1000,
      iva: true,
      modo: 'a',
    });
  });

  it('acota números al rango permitido', () => {
    expect(parseState(schema, new URLSearchParams('monto=99999')).monto).toBe(5000);
    expect(parseState(schema, new URLSearchParams('monto=-3')).monto).toBe(0);
  });

  it('hace ida y vuelta y omite valores por defecto', () => {
    const params = writeState(
      schema,
      { monto: 2500, iva: false, modo: 'a' },
      new URLSearchParams('otro=1'),
    );
    expect(params.toString()).toBe('otro=1&monto=2500&iva=0');
    expect(parseState(schema, params)).toEqual({ monto: 2500, iva: false, modo: 'a' });
  });

  it('serializa pagos anticipados y descarta basura', () => {
    expect(parsePairs('3:1000,x:2,0:5,4:-1,6:250.5')).toEqual([
      { month: 3, amount: 1000 },
      { month: 6, amount: 250.5 },
    ]);
    expect(serializePairs([{ month: 3, amount: 1000 }])).toBe('3:1000');
    expect(parsePairs(null)).toEqual([]);
  });
});
