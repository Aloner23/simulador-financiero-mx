/**
 * Serialización del estado de la app en la query string para compartir
 * escenarios. Cada herramienta declara un esquema: clave en URL → tipo y valor
 * por defecto. Sólo se escriben en la URL los valores distintos al default.
 */
export type FieldSpec =
  | { type: 'number'; default: number; min?: number; max?: number }
  | { type: 'boolean'; default: boolean }
  | { type: 'enum'; default: string; options: readonly string[] };

export type Schema = Record<string, FieldSpec>;

export type StateOf<S extends Schema> = {
  [K in keyof S]: S[K] extends { type: 'number' }
    ? number
    : S[K] extends { type: 'boolean' }
      ? boolean
      : string;
};

export function defaultsOf<S extends Schema>(schema: S): StateOf<S> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema)) out[key] = spec.default;
  return out as StateOf<S>;
}

function clamp(value: number, min?: number, max?: number): number {
  let v = value;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return v;
}

export function parseState<S extends Schema>(schema: S, params: URLSearchParams): StateOf<S> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema)) {
    const raw = params.get(key);
    if (raw === null) {
      out[key] = spec.default;
      continue;
    }
    switch (spec.type) {
      case 'number': {
        const n = Number(raw);
        out[key] =
          raw.trim() !== '' && Number.isFinite(n) ? clamp(n, spec.min, spec.max) : spec.default;
        break;
      }
      case 'boolean':
        out[key] =
          raw === '1' || raw === 'true'
            ? true
            : raw === '0' || raw === 'false'
              ? false
              : spec.default;
        break;
      case 'enum':
        out[key] = spec.options.includes(raw) ? raw : spec.default;
        break;
    }
  }
  return out as StateOf<S>;
}

/** Escribe en `params` sólo lo que difiere del default; borra lo demás. */
export function writeState<S extends Schema>(
  schema: S,
  state: StateOf<S>,
  params: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, spec] of Object.entries(schema)) {
    const value = (state as Record<string, unknown>)[key];
    if (value === spec.default) {
      next.delete(key);
    } else if (typeof value === 'boolean') {
      next.set(key, value ? '1' : '0');
    } else {
      next.set(key, String(value));
    }
  }
  return next;
}

/** Lista "mes:monto,mes:monto" para pagos anticipados. */
export function parsePairs(raw: string | null): { month: number; amount: number }[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((pair) => pair.split(':').map(Number))
    .filter(
      (p): p is [number, number] =>
        p.length === 2 && p.every((n) => Number.isFinite(n)) && (p[0] ?? 0) >= 1 && (p[1] ?? 0) > 0,
    )
    .slice(0, 50)
    .map(([month, amount]) => ({ month: Math.floor(month), amount }));
}

export function serializePairs(pairs: { month: number; amount: number }[]): string {
  return pairs
    .filter((p) => p.month >= 1 && p.amount > 0)
    .map((p) => `${p.month}:${p.amount}`)
    .join(',');
}
