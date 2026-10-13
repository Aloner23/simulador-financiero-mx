import { useCallback, useState } from 'react';
import { parseState, writeState, type Schema, type StateOf } from '../lib/urlState';

function currentParams(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}

export function replaceParams(params: URLSearchParams) {
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', url);
}

/**
 * Estado de una herramienta sincronizado con la query string. Usa
 * `replaceState` para no llenar el historial con cada tecla.
 */
export function useUrlState<S extends Schema>(schema: S) {
  const [state, setState] = useState<StateOf<S>>(() => parseState(schema, currentParams()));

  const set = useCallback(
    <K extends keyof S & string>(key: K, value: StateOf<S>[K]) => {
      setState((prev) => {
        const next = { ...prev, [key]: value };
        replaceParams(writeState(schema, next, currentParams()));
        return next;
      });
    },
    [schema],
  );

  const reset = useCallback(() => {
    const defaults = parseState(schema, new URLSearchParams());
    replaceParams(writeState(schema, defaults, currentParams()));
    setState(defaults);
  }, [schema]);

  return [state, set, reset] as const;
}

/** Un solo parámetro de texto libre (p. ej. la lista de pagos anticipados). */
export function useUrlParam(key: string) {
  const [value, setValue] = useState<string | null>(() => currentParams().get(key));
  const set = useCallback(
    (next: string | null) => {
      const params = currentParams();
      if (next) params.set(key, next);
      else params.delete(key);
      replaceParams(params);
      setValue(next);
    },
    [key],
  );
  return [value, set] as const;
}
