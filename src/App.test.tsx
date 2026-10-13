import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('muestra el aviso educativo y la herramienta de inversión por defecto', () => {
    render(<App />);
    expect(screen.getByText(/no es asesoría financiera/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Inversión/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Tu inversión' })).toBeInTheDocument();
  });

  it('cambia de herramienta con el teclado y lo refleja en la URL', async () => {
    const user = userEvent.setup();
    render(<App />);
    screen.getByRole('tab', { name: /Inversión/ }).focus();
    await user.keyboard('{ArrowRight}');
    const credito = screen.getByRole('tab', { name: /Crédito/ });
    expect(credito).toHaveAttribute('aria-selected', 'true');
    expect(credito).toHaveFocus();
    expect(window.location.search).toContain('h=credito');
    expect(screen.getByRole('heading', { name: 'Tu crédito' })).toBeInTheDocument();
  });

  it('restaura un escenario compartido desde la URL', () => {
    window.history.replaceState(
      null,
      '',
      '/?h=meta&meta=12000&mmeses=12&mtasa=0&minicial=0&mhoy=0',
    );
    render(<App />);
    const result = screen.getByRole('region', { name: /Resultado de la meta/ });
    expect(within(result).getAllByText(/\$1,000\.00/).length).toBeGreaterThan(0);
  });
});

describe('Crédito', () => {
  it('recalcula al editar el monto y guarda el valor en la URL', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?h=credito&ctasa=0&civa=0&cmeses=10');
    render(<App />);
    const monto = screen.getByLabelText('Monto del crédito');
    await user.clear(monto);
    await user.type(monto, '1000');
    const results = screen.getByRole('region', { name: /Resultados del crédito/ });
    // 1000 / 10 meses a tasa 0
    expect(within(results).getAllByText('$100.00').length).toBeGreaterThan(0);
    expect(window.location.search).toContain('cmonto=1000');
  });

  it('agrega un pago anticipado que acorta el plazo', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?h=credito&cmonto=12000&ctasa=0&civa=0&cmeses=12');
    render(<App />);
    const mes = screen.getByLabelText('Mes');
    await user.clear(mes);
    await user.type(mes, '1');
    const monto = screen.getByLabelText('Monto');
    await user.clear(monto);
    await user.type(monto, '5000');
    await user.click(screen.getByRole('button', { name: 'Agregar pago anticipado' }));
    expect(
      screen.getByRole('button', { name: /Quitar pago anticipado del mes 1/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/en lugar de 1 año/)).toBeInTheDocument();
    expect(window.location.search).toContain('cant=1%3A5000');
  });

  it('el interruptor de IVA es accesible', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?h=credito');
    render(<App />);
    const iva = screen.getByRole('switch', { name: /IVA sobre intereses/ });
    expect(iva).toHaveAttribute('aria-checked', 'true');
    await user.click(iva);
    expect(iva).toHaveAttribute('aria-checked', 'false');
    expect(window.location.search).toContain('civa=0');
  });
});
