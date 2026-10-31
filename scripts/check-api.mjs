// Compiles /api and /server to plain JavaScript (as Vercel does, file by file, no bundling)
// and imports every function under Node's ESM loader, then exercises one request end to end.
// Catches missing .js extensions or JSON import attributes before a deploy does.
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const out = join(root, 'node_modules', '.tmp', 'api-check');
rmSync(out, { recursive: true, force: true });
execFileSync('npx', ['tsc', '-p', 'tsconfig.server.json', '--noEmit', 'false', '--outDir', out], {
  cwd: root,
  stdio: 'inherit',
});

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
};
walk(join(out, 'api'));

delete process.env.DATABASE_URL;
process.env.SESSION_SECRET ??= 'check-api-secret-check-api-secret-1234';
for (const file of files) {
  const mod = await import(pathToFileURL(file).href);
  const methods = Object.keys(mod).filter((k) => ['GET', 'POST'].includes(k));
  if (methods.length === 0) throw new Error(`${relative(out, file)} exports no GET/POST handler`);
  console.log(`ok  ${relative(out, file)}  ${methods.join(', ')}`);
}

const { POST } = await import(pathToFileURL(join(out, 'api', 'attempts', 'index.js')).href);
const res = await POST(
  new Request('http://localhost/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ age: 30, consentResearch: false }),
  }),
);
if (res.status !== 201)
  throw new Error(`POST /api/attempts returned ${res.status}: ${await res.text()}`);
console.log('ok  POST /api/attempts → 201 with compiled output');
