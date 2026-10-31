// Scans the production client bundle (dist/) for anything that could reveal answers: generator
// or solver code, the verbal bank, server code or dev-only routes. Run after `npm run build`.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'dist', 'assets');
// ("answerIndex" is allowed: it's the request field carrying the person's own choice.)
const forbidden = [
  'generateMatrix', // generators
  'seriesPredictions', // number solver
  'distractors', // verbal bank entries
  'pickSpacedOptions', // number generator
  'impliedValues', // matrix solver
  'row-constant', // matrix rules
  'a-an-001', // verbal bank ids
  'node:crypto', // server code
  'sealItemToken', // server code
  'Puzzle workbench', // dev-only route
];
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
let failed = false;
for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8');
  for (const word of forbidden) {
    if (text.includes(word)) {
      console.error(`✗ ${f} contains "${word}"`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log(`ok  ${files.length} client bundle file(s) contain no answer-bearing code`);
