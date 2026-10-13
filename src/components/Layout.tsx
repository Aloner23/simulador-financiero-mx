import type { ReactNode } from 'react';

/** Columna de parámetros (izquierda en escritorio). */
export function Controls({
  title,
  children,
  onReset,
}: {
  title: string;
  children: ReactNode;
  onReset: () => void;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-5 border-rule lg:sticky lg:top-6 lg:self-start lg:border-r lg:pr-8"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="display text-2xl">{title}</h2>
        <button
          type="button"
          onClick={onReset}
          className="no-print text-sm text-ink-soft underline decoration-rule underline-offset-4 hover:text-rosa"
        >
          Restablecer
        </button>
      </div>
      {children}
    </section>
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-rule pt-4">
      <legend className="float-left mb-1 w-full text-sm font-semibold text-ink-soft">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

interface StatProps {
  label: string;
  value: string;
  note?: ReactNode;
  tone?: 'default' | 'rosa' | 'jade';
}

export function Stat({ label, value, note, tone = 'default' }: StatProps) {
  const color = tone === 'rosa' ? 'text-rosa' : tone === 'jade' ? 'text-jade' : 'text-ink';
  return (
    <div className="flex flex-col gap-0.5 border-t border-rule pt-3">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className={`figure text-2xl sm:text-[1.75rem] ${color}`}>{value}</dd>
      {note && <dd className="text-xs leading-snug text-ink-soft">{note}</dd>}
    </div>
  );
}

/** Gráfica con título y descripción textual para lectores de pantalla. */
export function ChartFrame({
  title,
  description,
  legend,
  children,
  actions,
}: {
  title: string;
  description: string;
  legend?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="text-base font-semibold">{title}</figcaption>
        {actions}
      </div>
      <div role="img" aria-label={description} className="h-72 w-full sm:h-80">
        {children}
      </div>
      {legend}
    </figure>
  );
}

export function LegendList({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <svg width="18" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="18"
              y2="4"
              stroke={it.color}
              strokeWidth="3"
              strokeDasharray={it.dashed ? '4 3' : undefined}
            />
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartTooltip({
  active,
  label,
  payload,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  label?: string | number;
  payload?: readonly {
    name?: string | number;
    value?: unknown;
    color?: string;
    dataKey?: unknown;
  }[];
  labelFormatter: (label: number) => string;
  valueFormatter: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-rule bg-sheet px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold">{labelFormatter(Number(label))}</p>
      <ul className="flex flex-col gap-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-ink-soft">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: p.color }}
              />
              {p.name}
            </span>
            <span className="figure">{valueFormatter(Number(p.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
