import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { apiDevServer } from './vite-plugin-api.ts';

/**
 * Fills %SITE_URL% in index.html: link previews need absolute URLs. SITE_URL wins if set;
 * on Vercel the production domain is used, so preview deployments share production's card.
 */
function siteUrl(): Plugin {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = (
    process.env.SITE_URL || (vercel ? `https://${vercel}` : 'https://uniqo-omega.vercel.app')
  ).replace(/\/$/, '');
  return {
    name: 'site-url',
    transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', url) },
  };
}

export default defineConfig({
  plugins: [react(), apiDevServer(), siteUrl()],
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
});
