import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiDevServer } from './vite-plugin-api.ts';

export default defineConfig({
  plugins: [react(), apiDevServer()],
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
});
