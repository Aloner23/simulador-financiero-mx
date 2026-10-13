import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Guilloche } from './components/Guilloche';
import { CreditTool } from './features/CreditTool';
import { InvestmentTool } from './features/InvestmentTool';
import { SavingsGoalTool } from './features/SavingsGoalTool';
import { useChartColors } from './hooks/useChartColors';
import { useTheme } from './hooks/useTheme';
import { useUrlParam } from './hooks/useUrlState';

const TABS = [
  { id: 'inversion', label: 'Inversión', blurb: 'CETES, pagaré y ahorro' },
  { id: 'credito', label: 'Crédito', blurb: 'Amortización y CAT' },
  { id: 'meta', label: 'Meta de ahorro', blurb: 'Cuánto apartar al mes' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function isTab(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v);
}

export default function App() {
  const { theme, toggle } = useTheme();
  const colors = useChartColors(theme);
  const [rawTab, setRawTab] = useUrlParam('h');
  const tab: TabId = isTab(rawTab) ? rawTab : 'inversion';
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [copied, setCopied] = useState<'ok' | 'error' | null>(null);

  const select = useCallback((id: TabId) => setRawTab(id === 'inversion' ? null : id), [setRawTab]);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keyMap: Record<string, number> = {
      ArrowRight: (index + 1) % TABS.length,
      ArrowLeft: (index - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    };
    const next = keyMap[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const t = TABS[next];
    if (t) select(t.id);
    tabRefs.current[next]?.focus();
  };

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied('ok');
    } catch {
      setCopied('error');
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        Saltar al contenido
      </a>

      <header className="mx-auto max-w-7xl px-4 pt-6 sm:px-8 sm:pt-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="display text-4xl sm:text-6xl">Simulador Financiero MX</h1>
            <p className="mt-2 max-w-[56ch] text-ink-soft">
              Calcula cuánto crece tu dinero, cuánto cuesta realmente un crédito y cuánto apartar
              para una meta. Todo en pesos, con tus propias tasas.
            </p>
          </div>
          <div className="no-print flex items-center gap-2">
            <button
              type="button"
              onClick={share}
              className="rounded-md border border-rule bg-sheet px-3 py-2 text-sm font-medium hover:border-ink"
            >
              Copiar enlace
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-rule bg-sheet hover:border-ink"
            >
              {theme === 'dark' ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <p role="status" className="mt-2 h-5 text-sm text-jade">
          {copied === 'ok' && 'Enlace copiado. Quien lo abra verá este mismo escenario.'}
          {copied === 'error' &&
            'No se pudo copiar. Copia la dirección desde la barra del navegador.'}
        </p>

        <aside
          aria-label="Aviso"
          className="mt-3 rounded-md border-l-4 border-ocre bg-warn-bg px-4 py-3 text-sm text-warn-ink"
        >
          <strong>Herramienta educativa, no es asesoría financiera.</strong> Las tasas que ves son
          ejemplos editables, no tasas vigentes del mercado. Los resultados son estimaciones; antes
          de decidir, consulta las condiciones de tu institución y, si lo necesitas, a un asesor
          certificado.
        </aside>
      </header>

      <Guilloche className="mt-8" />

      <nav className="no-print mx-auto max-w-7xl px-4 sm:px-8" aria-label="Herramientas">
        <div
          role="tablist"
          aria-label="Herramientas"
          className="-mt-px grid grid-cols-3 border-b border-rule"
        >
          {TABS.map((t, k) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[k] = el;
                }}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => select(t.id)}
                onKeyDown={(e) => onTabKey(e, k)}
                className={`-mb-px flex flex-col items-start border-b-[3px] px-1 py-3 text-left transition-colors sm:px-2 ${
                  active
                    ? 'border-rosa text-ink'
                    : 'border-transparent text-ink-soft hover:text-ink'
                }`}
              >
                <span className="display text-lg sm:text-2xl">{t.label}</span>
                <span className="hidden text-sm sm:block">{t.blurb}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main id="contenido" className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        {TABS.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`panel-${t.id}`}
            aria-labelledby={`tab-${t.id}`}
            hidden={t.id !== tab}
            tabIndex={0}
            className="focus-visible:outline-offset-8"
          >
            {t.id === tab && t.id === 'inversion' && <InvestmentTool colors={colors} />}
            {t.id === tab && t.id === 'credito' && <CreditTool colors={colors} />}
            {t.id === tab && t.id === 'meta' && <SavingsGoalTool colors={colors} />}
          </div>
        ))}
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:justify-between sm:px-8">
          <p>Hecho por Carlos (Aloner23) en México. Código abierto bajo licencia MIT.</p>
          <p>Los cálculos ocurren en tu navegador; no se envía ningún dato.</p>
        </div>
      </footer>
    </div>
  );
}
