import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame, ChartTooltip, Controls, Group, LegendList, Stat } from '../components/Layout';
import { NumberField, Switch } from '../components/Field';
import { useUrlState } from '../hooks/useUrlState';
import type { ChartColors } from '../hooks/useChartColors';
import { formatMXN, formatMXNCompact, formatTerm } from '../lib/format';
import { planSavingsGoal } from '../lib/finance';
import type { Schema } from '../lib/urlState';

const savingsSchema = {
  meta: { type: 'number', default: 150_000, min: 0, max: 1e10 },
  mmeses: { type: 'number', default: 24, min: 1, max: 600 },
  mtasa: { type: 'number', default: 0.07, min: 0, max: 1 },
  minicial: { type: 'number', default: 10_000, min: 0, max: 1e10 },
  minfl: { type: 'number', default: 0.04, min: -0.5, max: 2 },
  mhoy: { type: 'boolean', default: true },
} satisfies Schema;

export function SavingsGoalTool({ colors }: { colors: ChartColors }) {
  const [s, set, reset] = useUrlState(savingsSchema);
  const r = useMemo(
    () =>
      planSavingsGoal({
        goal: s.meta,
        months: s.mmeses,
        annualRate: s.mtasa,
        initialAmount: s.minicial,
        inflationRate: s.minfl,
        goalInTodaysPesos: s.mhoy,
      }),
    [s],
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(17rem,22rem)_1fr]">
      <Controls title="Tu meta" onReset={reset}>
        <NumberField
          label="¿Cuánto quieres juntar?"
          prefix="$"
          value={s.meta}
          onChange={(v) => set('meta', v)}
          min={0}
          step={5000}
        />
        <NumberField
          label="¿En cuánto tiempo?"
          suffix="meses"
          value={s.mmeses}
          onChange={(v) => set('mmeses', Math.round(v))}
          min={1}
          max={600}
          hint={formatTerm(s.mmeses)}
        />
        <NumberField
          label="Ya tengo ahorrado"
          prefix="$"
          value={s.minicial}
          onChange={(v) => set('minicial', v)}
          min={0}
          step={1000}
        />
        <Group title="Supuestos">
          <NumberField
            label="Rendimiento anual esperado"
            suffix="%"
            scale={100}
            step={0.1}
            min={0}
            value={s.mtasa}
            onChange={(v) => set('mtasa', v)}
            hint="Neto de impuestos y comisiones, capitalizable mensualmente. Valor de ejemplo."
          />
          <Switch
            label="La meta está en pesos de hoy"
            checked={s.mhoy}
            onChange={(v) => set('mhoy', v)}
            hint="Ajusta la meta por inflación para conservar su poder de compra."
          />
          {s.mhoy && (
            <NumberField
              label="Inflación anual esperada"
              suffix="%"
              scale={100}
              step={0.1}
              value={s.minfl}
              onChange={(v) => set('minfl', v)}
            />
          )}
        </Group>
      </Controls>

      <section aria-label="Resultado de la meta de ahorro" className="flex min-w-0 flex-col gap-8">
        <div aria-live="polite" className="flex flex-col gap-2">
          {r.alreadyReached ? (
            <>
              <p className="text-ink-soft">No necesitas aportar más</p>
              <p className="display text-5xl text-jade sm:text-7xl">{formatMXN(0)}</p>
              <p className="max-w-[60ch] text-ink-soft">
                Con lo que ya tienes y el rendimiento supuesto alcanzas {formatMXN(r.nominalGoal)}{' '}
                en {formatTerm(s.mmeses)}.
              </p>
            </>
          ) : (
            <>
              <p className="text-ink-soft">Necesitas apartar cada mes</p>
              <p className="display text-5xl sm:text-7xl">{formatMXN(r.monthlyContribution)}</p>
              <p className="max-w-[60ch] text-ink-soft">
                Para tener <strong className="text-ink">{formatMXN(r.nominalGoal)}</strong> en{' '}
                {formatTerm(s.mmeses)}
                {s.mhoy && <> (equivale a {formatMXN(s.meta)} de hoy)</>}.
              </p>
            </>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          <Stat label="Meta nominal" value={formatMXN(r.nominalGoal)} />
          <Stat
            label="Tú aportas"
            value={formatMXN(r.totalContributed)}
            note="Incluye lo que ya tienes"
          />
          <Stat label="Rendimientos" value={formatMXN(r.interestEarned)} tone="jade" />
        </dl>

        <ChartFrame
          title="Camino a la meta"
          description={`Gráfica de área del saldo acumulado durante ${s.mmeses} meses hasta llegar a ${formatMXN(r.nominalGoal)}.`}
          legend={
            <LegendList
              items={[
                { label: 'Saldo con rendimientos', color: colors.jade },
                { label: 'Lo que aportas', color: colors['ink-soft'], dashed: true },
                { label: 'Meta', color: colors.rosa, dashed: true },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={r.series} margin={{ top: 12, right: 8, bottom: 0, left: 8 }}>
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
              <ReferenceLine
                y={r.nominalGoal}
                stroke={colors.rosa}
                strokeDasharray="6 4"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="balance"
                name="Saldo"
                stroke={colors.jade}
                fill={colors.jade}
                fillOpacity={0.14}
                strokeWidth={2.5}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="contributed"
                name="Aportado"
                stroke={colors['ink-soft']}
                strokeDasharray="4 4"
                fill="none"
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
      </section>
    </div>
  );
}
