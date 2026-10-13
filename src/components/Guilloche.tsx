/**
 * Banda de guilloché generada con curvas paramétricas, el grabado de seguridad
 * de los billetes. Es la única ornamentación de la página.
 */
const W = 1200;
const H = 64;

function wave(phase: number, amp: number, freq: number, harmonic: number): string {
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 6) {
    const t = (x / W) * Math.PI * 2 * freq;
    const y = H / 2 + amp * Math.sin(t + phase) * Math.cos(t * harmonic * 0.25 + phase / 2);
    pts.push(`${x === 0 ? 'M' : 'L'}${x},${y.toFixed(2)}`);
  }
  return pts.join('');
}

const PATHS = Array.from({ length: 14 }, (_, k) =>
  wave((k * Math.PI) / 7, 26 - k * 0.6, 9, 1 + (k % 3)),
);

export function Guilloche({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`guilloche block h-10 w-full sm:h-14 ${className}`}
    >
      {PATHS.map((d, k) => (
        <path
          key={k}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.6}
          opacity={0.35 + (k % 4) * 0.12}
        />
      ))}
    </svg>
  );
}
