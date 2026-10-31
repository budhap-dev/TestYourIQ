import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderThemesCss } from '../src/styles/palettes.ts';

const out = fileURLToPath(new URL('../src/styles/themes.css', import.meta.url));
writeFileSync(out, renderThemesCss());
console.log(`Wrote ${out}`);
