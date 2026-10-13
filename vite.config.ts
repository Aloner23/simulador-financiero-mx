/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages sirve el sitio en https://<usuario>.github.io/simulador-financiero-mx/
export default defineConfig({
  base: '/simulador-financiero-mx/',
  plugins: [react(), tailwindcss()],
  build: {
    // Recharts ocupa la mayor parte del bundle (~190 kB gzip en total).
    chunkSizeWarningLimit: 800,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
