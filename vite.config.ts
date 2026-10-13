/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages sirve el sitio en https://<usuario>.github.io/simulador-financiero-mx/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/simulador-financiero-mx/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}));
