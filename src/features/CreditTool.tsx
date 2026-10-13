import { useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame, ChartTooltip, Controls, Group, LegendList, Stat } from '../components/Layout';
import { NumberField, Segmented, Switch } from '../components/Field';
import { useUrlParam, useUrlState } from '../hooks/useUrlState';
import type { ChartColors } from '../hooks/useChartColors';
import { amortizationCsv, downloadText } from '../lib/csv';
import { formatMXN, formatMXNCompact, formatPercent, formatTerm } from '../lib/format';
import { amortize, type PrepaymentStrategy } from '../lib/finance';
import { parsePairs, serializePairs, type Schema } from '../lib/urlState';

const creditSchema = {
  cmonto: { type: 'number', default: 250_000, min: 0, max: 1e9 },
  ctasa: { type: 'number', default: 0.18, min: 0, max: 2 },
  cmeses: { type: 'number', default: 48, min: 1, max: 480 },
  civa: { type: 'boolean', default: true },
  capert: { type: 'number', default: 0, min: 0, max: 0.5 },
  ccargo: { type: 'number', default: 0, min: 0, max: 1e6 },
  cmodo: { type: 'enum', default: 'reducir-plazo', options: ['reducir-plazo', 'reducir-pago'] },
} satisfies Schema;

const PAGE = 24;

export function CreditTool({ colors }: { colors: ChartColors }) {
  const [s, set, reset] = useUrlState(creditSchema);
  const [rawPrepay, setRawPrepay] = useUrlParam('cant');
  const prepayments = useMemo(() => parsePairs(rawPrepay), [rawPrepay]);
  const [showAll, setShowAll] = useState(false);
  const formId = useId();
  const [newMonth, setNewMonth] = useState(12);
  const [newAmount, setNewAmount] = useState(20_000);

  const base = {
    principal: s.cmonto,
    annualRate: s.ctasa,
    months: s.cmeses,
    ivaOnInterest: s.civa,
    openingFeeRate: s.capert,
    monthlyFee: s.ccargo,
  };
  const result = useMemo(
    () => amortize({ ...base, prepayments, strategy: s.cmodo as PrepaymentStrategy }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, prepayments],
  );
  const withoutPrepay = useMemo(
    () => (prepayments.length ? amortize(base) : result),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, prepayments.length, result],
  );
  const savedInterest =
    withoutPrepay.totalInterest + withoutPrepay.totalIva - result.totalInterest - result.totalIva;

  const resetAll = () => {
    reset();
    setRawPrepay(null);
  };

  const addPrepayment = () => {
    if (!(newAmount > 0) || newMonth < 1) return;
    setRawPrepay(
      serializePairs(
        [...prepayments, { month: newMonth, amount: newAmount }].sort((a, b) => a.month - b.month),
      ) || null,
    );
  };
  const removePrepayment = (index: number) => {
    const next = prepayments.filter((_, k) => k !== index);
    setRawPrepay(serializePairs(next) || null);
  };

  const balanceData = useMemo(() => {
    const byPeriod = new Map(result.rows.map((r) => [r.period, r.closingBalance]));
    const out = [{ month: 0, saldo: s.cmonto, original: s.cmonto }];
    for (const r of withoutPrepay.rows) {
      out.push({ month: r.period, original: r.closingBalance, saldo: byPeriod.get(r.period) ?? 0 });
    }
    return out;
  }, [result, withoutPrepay, s.cmonto]);

  const compositionData = result.rows.map((r) => ({
    month: r.period,
    capital: r.principal,
    interes: r.interest + r.iva,
  }));

  const rows = showAll ? result.rows : result.rows.slice(0, PAGE);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(17rem,22rem)_1fr]">
      <Controls title="Tu crédito" onReset={resetAll}>
        <NumberField
          label="Monto del crédito"
          prefix="$"
          value={s.cmonto}
          onChange={(v) => set('cmonto', v)}
          min={0}
          step={5000}
        />
        <NumberField
          label="Tasa de interés anual"
          suffix="%"
          scale={100}
          step={0.1}
          min={0}
          value={s.ctasa}
          onChange={(v) => set('ctasa', v)}
          hint="Tasa ordinaria de tu contrato, sin IVA. Valor de ejemplo."
        />
        <NumberField
          label="Plazo"
          suffix="meses"
          value={s.cmeses}
          onChange={(v) => set('cmeses', Math.round(v))}
          min={1}
          max={480}
          hint={formatTerm(s.cmeses)}
        />
        <Switch
          label="IVA sobre intereses (16 %)"
          checked={s.civa}
          onChange={(v) => set('civa', v)}
          hint="Aplica a créditos personales y automotrices; los hipotecarios suelen estar exentos."
        />
        <Group title="Comisiones (opcional)">
          <NumberField
            label="Comisión por apertura"
            suffix="%"
            scale={100}
            step={0.1}
            min={0}
            value={s.capert}
            onChange={(v) => set('capert', v)}
          />
          <NumberField
            label="Cargo fijo mensual"
            prefix="$"
            min={0}
            step={10}
            value={s.ccargo}
            onChange={(v) => set('ccargo', v)}
            hint="Seguros u otros cargos. Entran al CAT sólo si los capturas."
          />
        </Group>
        <Group title="Pagos anticipados">
          <Segmented
            legend="Aplicar a capital para"
            value={s.cmodo}
            onChange={(v) => set('cmodo', v)}
            options={[
              { value: 'reducir-plazo', label: 'Reducir plazo' },
              { value: 'reducir-pago', label: 'Reducir pago' },
            ]}
          />
          {prepayments.length > 0 && (
            <ul className="flex flex-col divide-y divide-rule rounded-md border border-rule bg-sheet text-sm">
              {prepayments.map((p, k) => (
                <li key={`${p.month}-${k}`} className="flex items-center justify-between px-3 py-2">
                  <span>
                    Mes {p.month}: <span className="figure text-base">{formatMXN(p.amount)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removePrepayment(k)}
                    className="text-ink-soft underline underline-offset-4 hover:text-rosa"
                    aria-label={`Quitar pago anticipado del mes ${p.month}`}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            aria-labelledby={`${formId}-t`}
            className="grid grid-cols-[5.5rem_1fr] items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              addPrepayment();
            }}
          >
            <span id={`${formId}-t`} className="sr-only">
              Agregar pago anticipado
            </span>
            <NumberField
              label="Mes"
              value={newMonth}
              onChange={(v) => setNewMonth(Math.round(v))}
              min={1}
              max={s.cmeses}
            />
            <NumberField
              label="Monto"
              prefix="$"
              value={newAmount}
              onChange={setNewAmount}
              min={0}
              step={1000}
            />
            <button
              type="submit"
              className="col-span-2 rounded-md border border-ink bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-rosa hover:border-rosa"
            >
              Agregar pago anticipado
            </button>
          </form>
        </Group>
      </Controls>

      <section aria-label="Resultados del crédito" className="flex min-w-0 flex-col gap-8">
        <div aria-live="polite" className="flex flex-col gap-2">
          <p className="text-ink-soft">Pagarías cada mes</p>
          <p className="display text-5xl sm:text-7xl">
            {formatMXN(result.initialPayment + s.ccargo)}
          </p>
          <p className="max-w-[60ch] text-ink-soft">
            Durante {formatTerm(result.actualMonths)}
            {result.actualMonths < s.cmeses && <> en lugar de {formatTerm(s.cmeses)}</>}. Al final
            habrás pagado <strong className="text-ink">{formatMXN(result.totalPaid)}</strong> por un
            crédito de {formatMXN(s.cmonto)}.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <Stat
            label="CAT aproximado"
            value={formatPercent(result.catApprox)}
            tone="rosa"
            note="Sin IVA; ver nota abajo"
          />
          <Stat label="Intereses" value={formatMXN(result.totalInterest)} />
          <Stat
            label="IVA de intereses"
            value={formatMXN(result.totalIva)}
            note={s.civa ? '16 % del interés' : 'No aplica'}
          />
          <Stat
            label="Ahorro por anticipos"
            value={formatMXN(savedInterest)}
            tone={savedInterest > 0 ? 'jade' : 'default'}
            note="Intereses + IVA evitados"
          />
        </dl>

        <ChartFrame
          title="Saldo pendiente"
          description={`Gráfica de área del saldo del crédito: inicia en ${formatMXN(s.cmonto)} y llega a cero en el mes ${result.actualMonths}.`}
          legend={
            <LegendList
              items={[
                { label: 'Con tus pagos anticipados', color: colors.rosa },
                { label: 'Calendario original', color: colors['ink-soft'], dashed: true },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balanceData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: colors.rule }}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={formatMXNCompact}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    labelFormatter={(m) => `Mes ${m}`}
                    valueFormatter={formatMXN}
                  />
                )}
              />
              <Area
                type="linear"
                dataKey="original"
                name="Calendario original"
                stroke={colors['ink-soft']}
                strokeDasharray="4 4"
                fill="none"
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <Area
                type="linear"
                dataKey="saldo"
                name="Saldo"
                stroke={colors.rosa}
                fill={colors.rosa}
                fillOpacity={0.12}
                strokeWidth={2.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame
          title="A dónde va cada pago"
          description="Barras apiladas por mes con la parte que abona a capital y la que se va en intereses e IVA."
          legend={
            <LegendList
              items={[
                { label: 'Capital', color: colors.jade },
                { label: 'Interés + IVA', color: colors.ocre },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={compositionData}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              barCategoryGap={1}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: colors.rule }}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={formatMXNCompact}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                cursor={{ fill: colors.rule, fillOpacity: 0.4 }}
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    labelFormatter={(m) => `Mes ${m}`}
                    valueFormatter={formatMXN}
                  />
                )}
              />
              <Bar
                dataKey="capital"
                name="Capital"
                stackId="p"
                fill={colors.jade}
                isAnimationActive={false}
              />
              <Bar
                dataKey="interes"
                name="Interés + IVA"
                stackId="p"
                fill={colors.ocre}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold">Tabla de amortización</h3>
            <button
              type="button"
              onClick={() => downloadText('tabla-amortizacion.csv', amortizationCsv(result.rows))}
              className="no-print rounded-md border border-ink px-3 py-1.5 text-sm font-semibold hover:bg-ink hover:text-paper"
            >
              Descargar CSV
            </button>
          </div>
          <div className="overflow-x-auto rounded-md border border-rule bg-sheet">
            <table className="w-full min-w-[46rem] text-right text-sm">
              <caption className="sr-only">Tabla de amortización mensual</caption>
              <thead className="sticky top-0 border-b border-rule bg-sheet text-ink-soft">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Mes
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Saldo inicial
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Pago
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Interés
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    IVA
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Capital
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Anticipo
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Saldo final
                  </th>
                </tr>
              </thead>
              <tbody className="figure font-medium">
                {rows.map((r) => (
                  <tr
                    key={r.period}
                    className={`border-b border-rule last:border-0 ${r.prepayment > 0 ? 'bg-rosa-soft' : ''}`}
                  >
                    <th scope="row" className="px-3 py-1.5 font-medium">
                      {r.period}
                    </th>
                    <td className="px-3 py-1.5">{formatMXN(r.openingBalance)}</td>
                    <td className="px-3 py-1.5">{formatMXN(r.payment)}</td>
                    <td className="px-3 py-1.5">{formatMXN(r.interest)}</td>
                    <td className="px-3 py-1.5">{formatMXN(r.iva)}</td>
                    <td className="px-3 py-1.5">{formatMXN(r.principal)}</td>
                    <td className="px-3 py-1.5">
                      {r.prepayment > 0 ? formatMXN(r.prepayment) : '—'}
                    </td>
                    <td className="px-3 py-1.5">{formatMXN(r.closingBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="figure border-t-2 border-ink/40 font-semibold">
                <tr>
                  <th scope="row" className="px-3 py-2 text-left">
                    Total
                  </th>
                  <td />
                  <td className="px-3 py-2">
                    {formatMXN(result.rows.reduce((a, r) => a + r.payment, 0))}
                  </td>
                  <td className="px-3 py-2">{formatMXN(result.totalInterest)}</td>
                  <td className="px-3 py-2">{formatMXN(result.totalIva)}</td>
                  <td className="px-3 py-2">
                    {formatMXN(result.rows.reduce((a, r) => a + r.principal, 0))}
                  </td>
                  <td className="px-3 py-2">{formatMXN(result.totalPrepayments)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {result.rows.length > PAGE && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="no-print self-start text-sm text-ink-soft underline underline-offset-4 hover:text-rosa"
            >
              {showAll
                ? `Mostrar sólo los primeros ${PAGE} meses`
                : `Mostrar los ${result.rows.length} meses`}
            </button>
          )}
          <p className="max-w-[72ch] text-xs leading-relaxed text-ink-soft">
            <strong>Sobre el CAT:</strong> es una aproximación. Se calcula como la TIR mensual de
            los flujos del crédito (monto recibido menos comisión por apertura, contra pagos de
            capital, interés y cargos fijos), anualizada como (1 + TIR)<sup>12</sup> − 1. Excluye el
            IVA, como la metodología de Banxico, y no incluye pagos anticipados ni comisiones que no
            captures. El CAT oficial lo informa tu institución.
          </p>
        </div>
      </section>
    </div>
  );
}
