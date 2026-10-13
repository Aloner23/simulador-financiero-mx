import { describe, expect, it } from 'vitest';
import { amortize, catApprox, fixedPayment, type CreditInput } from './credit';

const base: CreditInput = {
  principal: 100_000,
  annualRate: 0.12,
  months: 12,
  ivaOnInterest: false,
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('fixedPayment', () => {
  it('coincide con la fórmula del sistema francés', () => {
    expect(fixedPayment(100_000, 0.01, 12)).toBeCloseTo(8_884.88, 2);
  });

  it('con tasa 0 divide el capital entre los periodos', () => {
    expect(fixedPayment(12_000, 0, 12)).toBe(1_000);
  });

  it('con un solo periodo paga capital más interés', () => {
    expect(fixedPayment(1_000, 0.02, 1)).toBeCloseTo(1_020, 10);
  });
});

describe('amortize', () => {
  it('la suma del capital amortizado iguala el monto del crédito', () => {
    const r = amortize(base);
    expect(r.rows).toHaveLength(12);
    expect(sum(r.rows.map((x) => x.principal))).toBeCloseTo(100_000, 6);
    expect(r.rows.at(-1)?.closingBalance).toBe(0);
  });

  it('total pagado = capital + intereses', () => {
    const r = amortize(base);
    expect(r.totalPaid).toBeCloseTo(100_000 + r.totalInterest, 6);
    expect(r.totalPaid).toBeCloseTo(8_884.88 * 12, 0);
  });

  it('cada renglón es consistente: saldo final = inicial − capital − anticipado', () => {
    const r = amortize({ ...base, prepayments: [{ month: 3, amount: 5_000 }] });
    for (const row of r.rows) {
      expect(row.closingBalance).toBeCloseTo(
        row.openingBalance - row.principal - row.prepayment,
        8,
      );
      expect(row.payment).toBeCloseTo(row.principal + row.interest + row.iva, 8);
    }
    for (let k = 1; k < r.rows.length; k++) {
      expect(r.rows[k]?.openingBalance).toBeCloseTo(r.rows[k - 1]?.closingBalance ?? NaN, 8);
    }
  });

  it('tasa 0: pagos iguales y cero intereses', () => {
    const r = amortize({ ...base, annualRate: 0 });
    expect(r.totalInterest).toBe(0);
    for (const row of r.rows) expect(row.payment).toBeCloseTo(100_000 / 12, 8);
    expect(r.catApprox).toBeCloseTo(0, 6);
  });

  it('un solo periodo', () => {
    const r = amortize({ ...base, months: 1 });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.interest).toBeCloseTo(1_000, 8);
    expect(r.rows[0]?.payment).toBeCloseTo(101_000, 8);
  });

  it('plazo 0 o monto 0 produce tabla vacía', () => {
    expect(amortize({ ...base, months: 0 }).rows).toHaveLength(0);
    const empty = amortize({ ...base, principal: 0 });
    expect(empty.rows).toHaveLength(0);
    expect(empty.initialPayment).toBe(0);
    expect(empty.catApprox).toBeNull();
  });

  describe('IVA sobre intereses', () => {
    it('mantiene el pago fijo y cobra 16 % sobre cada interés', () => {
      const r = amortize({ ...base, ivaOnInterest: true });
      for (const row of r.rows) expect(row.iva).toBeCloseTo(row.interest * 0.16, 8);
      const payments = r.rows.map((x) => x.payment);
      for (const p of payments) expect(p).toBeCloseTo(payments[0] ?? NaN, 6);
      expect(sum(r.rows.map((x) => x.principal))).toBeCloseTo(100_000, 6);
      expect(r.totalIva).toBeCloseTo(r.totalInterest * 0.16, 6);
    });

    it('es más caro que sin IVA', () => {
      expect(amortize({ ...base, ivaOnInterest: true }).totalPaid).toBeGreaterThan(
        amortize(base).totalPaid,
      );
    });

    it('acepta una tasa de IVA distinta', () => {
      const r = amortize({ ...base, ivaOnInterest: true, ivaRate: 0.08 });
      expect(r.rows[0]?.iva).toBeCloseTo(1_000 * 0.08, 8);
    });
  });

  describe('pagos anticipados', () => {
    it('reducir plazo: termina antes y paga menos interés', () => {
      const normal = amortize(base);
      const r = amortize({
        ...base,
        prepayments: [{ month: 2, amount: 30_000 }],
        strategy: 'reducir-plazo',
      });
      expect(r.actualMonths).toBeLessThan(12);
      expect(r.totalInterest).toBeLessThan(normal.totalInterest);
      expect(r.rows[3]?.payment).toBeCloseTo(normal.initialPayment, 6);
      expect(sum(r.rows.map((x) => x.principal)) + r.totalPrepayments).toBeCloseTo(100_000, 6);
    });

    it('reducir pago: conserva el plazo y baja la mensualidad', () => {
      const r = amortize({
        ...base,
        prepayments: [{ month: 2, amount: 30_000 }],
        strategy: 'reducir-pago',
      });
      expect(r.actualMonths).toBe(12);
      expect(r.rows[2]?.payment).toBeLessThan(r.initialPayment);
      expect(r.rows.at(-1)?.closingBalance).toBe(0);
      expect(sum(r.rows.map((x) => x.principal)) + r.totalPrepayments).toBeCloseTo(100_000, 6);
    });

    it('reducir plazo ahorra más interés que reducir pago', () => {
      const prepayments = [{ month: 2, amount: 30_000 }];
      const plazo = amortize({ ...base, prepayments, strategy: 'reducir-plazo' });
      const pago = amortize({ ...base, prepayments, strategy: 'reducir-pago' });
      expect(plazo.totalInterest).toBeLessThan(pago.totalInterest);
    });

    it('un anticipo mayor al saldo liquida el crédito y se recorta al saldo', () => {
      const r = amortize({ ...base, prepayments: [{ month: 1, amount: 1_000_000 }] });
      expect(r.actualMonths).toBe(1);
      expect(r.rows[0]?.closingBalance).toBe(0);
      expect(r.rows[0]?.principal ?? 0).toBeGreaterThan(0);
      expect((r.rows[0]?.principal ?? 0) + r.totalPrepayments).toBeCloseTo(100_000, 6);
    });

    it('suma anticipos del mismo mes e ignora meses inválidos o montos no positivos', () => {
      const r = amortize({
        ...base,
        prepayments: [
          { month: 3, amount: 1_000 },
          { month: 3, amount: 2_000 },
          { month: 0, amount: 5_000 },
          { month: 4, amount: -10 },
          { month: 40, amount: 5_000 },
        ],
      });
      expect(r.rows[2]?.prepayment).toBe(3_000);
      expect(r.totalPrepayments).toBe(3_000);
    });

    it('con tasa 0 y anticipo, reducir pago recalcula correctamente', () => {
      const r = amortize({
        ...base,
        annualRate: 0,
        prepayments: [{ month: 6, amount: 20_000 }],
        strategy: 'reducir-pago',
      });
      const remaining = 100_000 - (100_000 / 12) * 6 - 20_000;
      expect(r.rows[6]?.payment).toBeCloseTo(remaining / 6, 8);
      expect(r.totalInterest).toBe(0);
    });
  });

  it('suma cargos fijos y comisión por apertura al total pagado', () => {
    const r = amortize({ ...base, monthlyFee: 50, openingFeeRate: 0.02 });
    expect(r.totalFees).toBe(600);
    expect(r.openingFee).toBe(2_000);
    expect(r.totalPaid).toBeCloseTo(100_000 + r.totalInterest + 600 + 2_000, 6);
  });
});

describe('catApprox', () => {
  it('sin comisiones es la tasa efectiva anual de la tasa nominal', () => {
    expect(catApprox(base)).toBeCloseTo(Math.pow(1.01, 12) - 1, 8);
  });

  it('la comisión por apertura y cargos fijos elevan el CAT', () => {
    const plain = catApprox(base) ?? 0;
    expect(catApprox({ ...base, openingFeeRate: 0.03 }) ?? 0).toBeGreaterThan(plain);
    expect(catApprox({ ...base, monthlyFee: 100 }) ?? 0).toBeGreaterThan(plain);
  });

  it('excluye el IVA (como la metodología de Banxico)', () => {
    expect(catApprox({ ...base, ivaOnInterest: true })).toBeCloseTo(catApprox(base) ?? NaN, 10);
  });

  it('es null si no hay plazo', () => {
    expect(catApprox({ ...base, months: 0 })).toBeNull();
  });
});
