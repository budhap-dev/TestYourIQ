// Bundles the API handlers for `vite preview`, so the production client build can be served
// with a working API locally and in end-to-end tests. Dependencies stay external.
import { build } from 'esbuild';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
await build({
  entryPoints: [join(root, 'server', 'handlers.ts')],
  outfile: join(root, 'node_modules', '.tmp', 'preview-api.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  logLevel: 'warning',
});
console.log('ok  bundled API for preview');
