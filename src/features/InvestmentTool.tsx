import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame, ChartTooltip, Controls, Group, LegendList, Stat } from '../components/Layout';
import { NumberField, Segmented } from '../components/Field';
import { useUrlState } from '../hooks/useUrlState';
import type { ChartColors } from '../hooks/useChartColors';
import { formatMXN, formatMXNCompact, formatPercent, formatTerm } from '../lib/format';
import {
  DAYS_PER_MONTH,
  realRate,
  simulateInvestment,
  type InstrumentSpec,
  type InvestmentResult,
} from '../lib/finance';
import type { Schema } from '../lib/urlState';

const rate = (d: number) => ({ type: 'number', default: d, min: 0, max: 1 }) as const;

/** Las tasas por defecto son ejemplos ilustrativos, no tasas vigentes. */
const investmentSchema = {
  monto: { type: 'number', default: 50_000, min: 0, max: 1e9 },
  aport: { type: 'number', default: 2_000, min: 0, max: 1e8 },
  meses: { type: 'number', default: 36, min: 1, max: 600 },
  infl: { type: 'number', default: 0.04, min: -0.5, max: 2 },
  isr: { type: 'number', default: 0.005, min: 0, max: 0.2 },
  c28: rate(0.0725),
  c91: rate(0.074),
  c182: rate(0.0755),
  c364: rate(0.077),
  pag: rate(0.065),
  pagd: { type: 'enum', default: '28', options: ['7', '28', '91', '182', '364'] },
  aho: rate(0.02),
  vista: { type: 'enum', default: 'nominal', options: ['nominal', 'real'] },
} satisfies Schema;

type Key = keyof ChartColors;
const SERIES: { id: string; color: Key; dashed?: boolean }[] = [
  { id: 'cetes-28', color: 'rosa' },
  { id: 'cetes-91', color: 'azul' },
  { id: 'cetes-182', color: 'morado' },
  { id: 'cetes-364', color: 'jade' },
  { id: 'pagare', color: 'ocre', dashed: true },
  { id: 'ahorro', color: 'gris', dashed: true },
];

export function InvestmentTool({ colors }: { colors: ChartColors }) {
  const [s, set, reset] = useUrlState(investmentSchema);

  const instruments: InstrumentSpec[] = useMemo(
    () => [
      {
        id: 'cetes-28',
        kind: 'cetes',
        label: 'CETES 28 días',
        annualRate: s.c28,
        periodDays: 28,
        dayCountBasis: 360,
      },
      {
        id: 'cetes-91',
        kind: 'cetes',
        label: 'CETES 91 días',
        annualRate: s.c91,
        periodDays: 91,
        dayCountBasis: 360,
      },
      {
        id: 'cetes-182',
        kind: 'cetes',
        label: 'CETES 182 días',
        annualRate: s.c182,
        periodDays: 182,
        dayCountBasis: 360,
      },
      {
        id: 'cetes-364',
        kind: 'cetes',
        label: 'CETES 364 días',
        annualRate: s.c364,
        periodDays: 364,
        dayCountBasis: 360,
      },
      {
        id: 'pagare',
        kind: 'pagare',
        label: `Pagaré ${s.pagd} días`,
        annualRate: s.pag,
        periodDays: Number(s.pagd),
        dayCountBasis: 360,
      },
      {
        id: 'ahorro',
        kind: 'ahorro',
        label: 'Cuenta de ahorro',
        annualRate: s.aho,
        periodDays: DAYS_PER_MONTH,
        dayCountBasis: 365,
      },
    ],
    [s.c28, s.c91, s.c182, s.c364, s.pag, s.pagd, s.aho],
  );

  const results: InvestmentResult[] = useMemo(
    () =>
      instruments.map((inst) =>
        simulateInvestment(inst, {
          initialAmount: s.monto,
          monthlyContribution: s.aport,
          months: s.meses,
          isrRetentionRate: s.isr,
          inflationRate: s.infl,
        }),
      ),
    [instruments, s.monto, s.aport, s.meses, s.isr, s.infl],
  );

  const best = results.reduce<InvestmentResult | undefined>(
    (acc, r) => (!acc || r.finalValue > acc.finalValue ? r : acc),
    undefined,
  );
  const real = s.vista === 'real';

  const chartData = useMemo(() => {
    const rows: Record<string, number>[] = [];
    for (let m = 0; m <= s.meses; m++) {
      const row: Record<string, number> = { month: m };
      for (const r of results) {
        const p = r.series[m];
        if (p) row[r.instrument.id] = real ? p.realValue : p.value;
      }
      row.aportado = results[0]?.series[m]?.contributed ?? 0;
      rows.push(row);
    }
    return rows;
  }, [results, s.meses, real]);

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(17rem,22rem)_1fr]">
      <Controls title="Tu inversión" onReset={reset}>
        <NumberField
          label="Monto inicial"
          prefix="$"
          value={s.monto}
          onChange={(v) => set('monto', v)}
          min={0}
          step={1000}
        />
        <NumberField
          label="Aportación mensual"
          prefix="$"
          value={s.aport}
          onChange={(v) => set('aport', v)}
          min={0}
          step={100}
          hint="Se invierte al cierre de cada mes en un título nuevo."
        />
        <NumberField
          label="Plazo"
          suffix="meses"
          value={s.meses}
          onChange={(v) => set('meses', Math.round(v))}
          min={1}
          max={600}
          hint={formatTerm(s.meses)}
        />
        <Group title="Supuestos">
          <NumberField
            label="Inflación anual esperada"
            suffix="%"
            scale={100}
            step={0.1}
            value={s.infl}
            onChange={(v) => set('infl', v)}
            hint="Se usa para expresar el resultado en pesos de hoy."
          />
          <NumberField
            label="Retención de ISR"
            suffix="% anual"
            scale={100}
            step={0.05}
            min={0}
            value={s.isr}
            onChange={(v) => set('isr', v)}
            hint="En México se retiene sobre el capital invertido, no sobre la ganancia. Verifica la tasa vigente en la Ley de Ingresos del año."
          />
        </Group>
        <Group title="Tasas anuales de ejemplo">
          <p className="-mt-2 text-xs leading-snug text-ink-soft">
            No son tasas vigentes. Captura las de la subasta o tu banco.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="CETES 28"
              suffix="%"
              scale={100}
              step={0.05}
              min={0}
              value={s.c28}
              onChange={(v) => set('c28', v)}
            />
            <NumberField
              label="CETES 91"
              suffix="%"
              scale={100}
              step={0.05}
              min={0}
              value={s.c91}
              onChange={(v) => set('c91', v)}
            />
            <NumberField
              label="CETES 182"
              suffix="%"
              scale={100}
              step={0.05}
              min={0}
              value={s.c182}
              onChange={(v) => set('c182', v)}
            />
            <NumberField
              label="CETES 364"
              suffix="%"
              scale={100}
              step={0.05}
              min={0}
              value={s.c364}
              onChange={(v) => set('c364', v)}
            />
            <NumberField
              label="Pagaré"
              suffix="%"
              scale={100}
              step={0.05}
              min={0}
              value={s.pag}
              onChange={(v) => set('pag', v)}
            />
            <NumberField
              label="Ahorro"
              suffix="%"
              scale={100}
              step={0.05}
              min={0}
              value={s.aho}
              onChange={(v) => set('aho', v)}
            />
          </div>
          <Segmented
            legend="Plazo del pagaré"
            value={s.pagd}
            onChange={(v) => set('pagd', v)}
            options={['7', '28', '91', '182', '364'].map((d) => ({ value: d, label: d }))}
            hint="Días por ciclo. Se reinvierte al vencimiento."
          />
        </Group>
      </Controls>

      <section aria-label="Resultados de inversión" className="flex min-w-0 flex-col gap-8">
        {best && (
          <div aria-live="polite" className="flex flex-col gap-2">
            <p className="text-ink-soft">
              Con {best.instrument.label}, en {formatTerm(s.meses)} tendrías
            </p>
            <p className="display text-5xl text-ink sm:text-7xl">{formatMXN(best.finalValue)}</p>
            <p className="max-w-[60ch] text-ink-soft">
              Equivalen a <strong className="text-ink">{formatMXN(best.realFinalValue)}</strong> en
              pesos de hoy con {formatPercent(s.infl)} de inflación. Aportas{' '}
              {formatMXN(best.totalContributed)} en total.
            </p>
          </div>
        )}

        {best && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <Stat
              label="Ganancia neta"
              value={formatMXN(best.netGain)}
              tone={best.netGain >= 0 ? 'jade' : 'rosa'}
            />
            <Stat
              label="Rendimiento nominal"
              value={formatPercent(best.nominalAnnualReturn)}
              note="Anual efectivo, neto de ISR"
            />
            <Stat
              label="Rendimiento real"
              value={formatPercent(best.realAnnualReturn)}
              tone={(best.realAnnualReturn ?? 0) < 0 ? 'rosa' : 'default'}
              note="Descontando inflación (Fisher)"
            />
            <Stat
              label="ISR retenido"
              value={formatMXN(best.isrImpact)}
              note="Diferencia contra no retener"
            />
          </dl>
        )}

        <ChartFrame
          title={real ? 'Saldo en pesos de hoy' : 'Saldo nominal'}
          description={`Gráfica de líneas del saldo mes a mes para ${results.length} instrumentos durante ${s.meses} meses. El detalle está en la tabla comparativa.`}
          actions={
            <div className="no-print w-56">
              <Segmented
                legend="Ver saldo"
                value={s.vista}
                onChange={(v) => set('vista', v)}
                options={[
                  { value: 'nominal', label: 'Nominal' },
                  { value: 'real', label: 'Pesos de hoy' },
                ]}
              />
            </div>
          }
          legend={
            <ul className="flex flex-wrap gap-2 text-sm" aria-label="Mostrar u ocultar series">
              {SERIES.map((sr) => {
                const inst = instruments.find((i) => i.id === sr.id);
                const off = hidden.has(sr.id);
                return (
                  <li key={sr.id}>
                    <button
                      type="button"
                      aria-pressed={!off}
                      onClick={() => toggle(sr.id)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 transition-colors ${
                        off ? 'border-rule text-ink-soft line-through' : 'border-ink/30 text-ink'
                      }`}
                    >
                      <svg width="16" height="8" aria-hidden="true">
                        <line
                          x1="0"
                          y1="4"
                          x2="16"
                          y2="4"
                          stroke={colors[sr.color]}
                          strokeWidth="3"
                          strokeDasharray={sr.dashed ? '4 3' : undefined}
                        />
                      </svg>
                      {inst?.label}
                    </button>
                  </li>
                );
              })}
              <li className="flex items-center">
                <LegendList
                  items={[{ label: 'Aportado', color: colors['ink-soft'], dashed: true }]}
                />
              </li>
            </ul>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="0" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: colors.rule }}
                tickFormatter={(m: number) => (m % 12 === 0 ? `${m / 12}a` : `${m}m`)}
                interval="preserveStartEnd"
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
              <Line
                type="monotone"
                dataKey="aportado"
                name="Aportado"
                stroke={colors['ink-soft']}
                strokeDasharray="2 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              {SERIES.filter((sr) => !hidden.has(sr.id)).map((sr) => (
                <Line
                  key={sr.id}
                  type="monotone"
                  dataKey={sr.id}
                  name={instruments.find((i) => i.id === sr.id)?.label}
                  stroke={colors[sr.color]}
                  strokeWidth={sr.id === best?.instrument.id ? 3 : 2}
                  strokeDasharray={sr.dashed ? '6 4' : undefined}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>

        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">Comparativo al final del plazo</h3>
          <div className="overflow-x-auto rounded-md border border-rule bg-sheet">
            <table className="w-full min-w-[42rem] text-right text-sm">
              <caption className="sr-only">Comparativo de instrumentos de inversión</caption>
              <thead className="border-b border-rule text-ink-soft">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Instrumento
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Tasa
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Valor final
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Pesos de hoy
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Nominal anual
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Real anual
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    ISR
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const top = r === best;
                  return (
                    <tr
                      key={r.instrument.id}
                      className={`border-b border-rule last:border-0 ${top ? 'bg-rosa-soft' : ''}`}
                    >
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        {r.instrument.label}
                        {top && (
                          <span className="ml-2 text-xs font-semibold text-rosa">Mayor saldo</span>
                        )}
                      </th>
                      <td className="figure px-3 py-2 font-medium">
                        {formatPercent(r.instrument.annualRate)}
                      </td>
                      <td className="figure px-3 py-2 font-medium">{formatMXN(r.finalValue)}</td>
                      <td className="figure px-3 py-2 font-medium">
                        {formatMXN(r.realFinalValue)}
                      </td>
                      <td className="figure px-3 py-2 font-medium">
                        {formatPercent(r.nominalAnnualReturn)}
                      </td>
                      <td
                        className={`figure px-3 py-2 font-medium ${(r.realAnnualReturn ?? 0) < 0 ? 'text-rosa' : ''}`}
                      >
                        {formatPercent(r.realAnnualReturn)}
                      </td>
                      <td className="figure px-3 py-2 font-medium">{formatMXN(r.isrImpact)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="max-w-[72ch] text-xs leading-relaxed text-ink-soft">
            CETES y pagaré usan base 360 días con reinversión de capital e intereses al vencimiento;
            el ciclo en curso al final se valúa con interés devengado. La cuenta de ahorro
            capitaliza mensualmente. Rendimiento real de una tasa de ejemplo de{' '}
            {formatPercent(s.c28)}: {formatPercent(realRate(s.c28, s.infl))}. No se consideran
            comisiones ni cambios de tasa durante el plazo.
          </p>
        </div>
      </section>
    </div>
  );
}
