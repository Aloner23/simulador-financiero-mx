import { useEffect, useState } from 'react';

const NAMES = [
  'rosa',
  'jade',
  'azul',
  'ocre',
  'morado',
  'gris',
  'ink',
  'ink-soft',
  'rule',
  'sheet',
] as const;
export type ChartColors = Record<(typeof NAMES)[number], string>;

function read(): ChartColors {
  const styles = getComputedStyle(document.documentElement);
  const out = {} as ChartColors;
  for (const name of NAMES) out[name] = styles.getPropertyValue(`--${name}`).trim() || '#888';
  return out;
}

/** Lee los tokens CSS para pasarlos a Recharts y los vuelve a leer al cambiar el tema. */
export function useChartColors(themeKey: string): ChartColors {
  const [colors, setColors] = useState<ChartColors>(read);
  useEffect(() => {
    // Espera a que el atributo data-theme se aplique.
    const id = requestAnimationFrame(() => setColors(read()));
    return () => cancelAnimationFrame(id);
  }, [themeKey]);
  return colors;
}
