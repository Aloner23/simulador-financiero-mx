import { useId, useState, type ReactNode } from 'react';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Texto antes del número, p. ej. "$". */
  prefix?: string;
  /** Texto después, p. ej. "%" o "meses". */
  suffix?: string;
  hint?: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  /** Factor de presentación: 100 para mostrar 0.075 como 7.5. */
  scale?: number;
  id?: string;
}

function round(value: number, digits = 6) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Campo numérico con etiqueta visible, prefijo/sufijo y ayuda enlazada por
 * aria-describedby. Mantiene el texto mientras se escribe y sólo propaga
 * números válidos (acotados a min/max).
 */
export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  min,
  max,
  step = 1,
  scale = 1,
  id,
}: NumberFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const shown = round(value * scale);
  const [draft, setDraft] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState(value);
  // Si el valor cambia desde fuera (p. ej. "Restablecer"), descarta el borrador.
  if (value !== lastValue) {
    setLastValue(value);
    if (draft !== null && Number(draft) !== shown) setDraft(null);
  }

  const commit = (text: string) => {
    setDraft(text);
    if (text.trim() === '') return;
    const n = Number(text);
    if (!Number.isFinite(n)) return;
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(round(v / scale, 10));
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex items-stretch rounded-md border border-rule bg-sheet focus-within:border-rosa transition-colors">
        {prefix && (
          <span aria-hidden="true" className="flex items-center pl-3 text-ink-soft">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          className="figure w-full min-w-0 bg-transparent px-3 py-2 text-lg text-ink outline-none focus-visible:outline-none"
          value={draft ?? String(shown)}
          min={min}
          max={max}
          step={step}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setDraft(null)}
          aria-describedby={hint ? hintId : undefined}
        />
        {suffix && (
          <span
            aria-hidden="true"
            className="flex items-center pr-3 text-sm text-ink-soft whitespace-nowrap"
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-xs leading-snug text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
}

export function Switch({ label, checked, onChange, hint }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span id={`${id}-l`} className="text-sm font-medium">
          {label}
        </span>
        {hint && (
          <p id={`${id}-h`} className="text-xs leading-snug text-ink-soft">
            {hint}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={hint ? `${id}-h` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-rosa bg-rosa' : 'border-rule bg-paper'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full bg-sheet shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode;
}

/** Grupo de radio nativo con apariencia segmentada (flechas del teclado incluidas). */
export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
  hint,
}: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col rounded-md border border-rule bg-paper p-0.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={`cursor-pointer rounded-[5px] px-2 py-1.5 text-center text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-rosa ${
              value === o.value ? 'bg-ink text-paper font-semibold' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className="text-xs leading-snug text-ink-soft">{hint}</p>}
    </fieldset>
  );
}
