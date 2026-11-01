import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/**
 * Renders the app icons (home screen, install) and the link-preview card (WhatsApp, Slack, social)
 * from public/favicon.svg into PNGs in public/. The outputs are committed, so this only needs
 * re-running when the artwork changes. Needs Chromium: npx playwright install chromium.
 * Usage: npm run gen:icons
 */

const pub = (name: string) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

const favicon = readFileSync(pub('favicon.svg'), 'utf8');
const TILE = /<rect width="32" height="32" rx="7" fill="(#[0-9a-f]{6})"\/>/;
const tileColor = favicon.match(TILE)?.[1];
if (!tileColor) throw new Error('favicon.svg no longer starts with the expected tile');
// The grid artwork, without its rounded tile.
const grid = favicon
  .replace(/^<svg[^>]*>/, '')
  .replace(TILE, '')
  .replace(/<\/svg>\s*$/, '');

/** A square, edge-to-edge icon: platforms that mask or round icons do it themselves. */
const fullBleed = (scale: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${tileColor}"/><g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${grid}</g></svg>`;

// Light "slate" palette, matching the site's default look.
const BG = '#f9f5f0';
const TEXT = '#1e1a14';
const MUTED = '#615d56';
const ACCENT = '#005f79';

/** The landing page's 3×3 puzzle: shape changes across columns, count across rows. */
function puzzle(): string {
  const cell = 64;
  const gap = 10;
  const cells: string[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = col * (cell + gap);
      const y = row * (cell + gap);
      if (row === 2 && col === 2) {
        cells.push(
          `<rect x="${x + 0.5}" y="${y + 0.5}" width="${cell - 1}" height="${cell - 1}" rx="8" fill="none" stroke="${ACCENT}" stroke-dasharray="4 4"/>`,
          `<text x="${x + cell / 2}" y="${y + cell / 2 + 9}" text-anchor="middle" font-size="26" font-family="Fraunces" fill="${ACCENT}">?</text>`,
        );
        continue;
      }
      cells.push(
        `<rect x="${x + 0.5}" y="${y + 0.5}" width="${cell - 1}" height="${cell - 1}" rx="8" fill="none" stroke="${TEXT}" stroke-opacity="0.2"/>`,
      );
      for (let i = 0; i <= row; i++) {
        const cx = x + cell / 2 + (i - row / 2) * 16;
        const cy = y + cell / 2;
        cells.push(
          col === 0
            ? `<circle cx="${cx}" cy="${cy}" r="6" fill="${TEXT}"/>`
            : col === 1
              ? `<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" rx="1.5" fill="${TEXT}"/>`
              : `<path d="M${cx} ${cy - 7} L${cx + 7} ${cy + 6} L${cx - 7} ${cy + 6} Z" fill="${TEXT}"/>`,
        );
      }
    }
  }
  return `<svg viewBox="0 0 212 212" width="400" height="400">${cells.join('')}</svg>`;
}

const card = `
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600&family=IBM+Plex+Sans:wght@500&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; }
  .card { box-sizing: border-box; width: 1200px; height: 630px; padding: 72px 80px;
    display: flex; align-items: center; justify-content: space-between; gap: 64px;
    background: ${BG}; color: ${TEXT}; font-family: 'IBM Plex Sans', sans-serif; }
  .brand { display: flex; align-items: center; gap: 22px; font: 600 60px/1 Fraunces, serif; letter-spacing: -0.01em; }
  .brand svg { width: 76px; height: 76px; }
  .brand span { color: ${ACCENT}; }
  h1 { margin: 52px 0 40px; font: 600 64px/1.08 Fraunces, serif; letter-spacing: -0.015em; }
  h1 em { color: ${ACCENT}; }
  p { margin: 0; font-size: 28px; font-weight: 500; color: ${MUTED}; }
</style>
<div class="card">
  <div>
    <div class="brand">${favicon}<div>un<span>IQ</span>o</div></div>
    <h1>A careful estimate of<br>how you <em>reason</em>.</h1>
    <p>Free · No sign-up · Ages 8 and up</p>
  </div>
  ${puzzle()}
</div>`;

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(name: string, html: string, width: number, height = width) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate('document.fonts.ready'); // a string: this file has no DOM types
  writeFileSync(pub(name), await page.screenshot({ omitBackground: true }));
  console.log(`Wrote public/${name} (${Math.round(statSync(pub(name)).size / 1024)} KB)`);
}

const icon = (svg: string, size: number) =>
  `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;

try {
  await render('icon-192.png', icon(favicon, 192), 192);
  await render('icon-512.png', icon(favicon, 512), 512);
  // Maskable icons may be cropped to a circle 80% wide, so the grid shrinks to stay inside it.
  await render('icon-maskable-512.png', icon(fullBleed(0.8), 512), 512);
  await render('apple-touch-icon.png', icon(fullBleed(0.9), 180), 180);
  await render('og-image.png', card, 1200, 630);
} finally {
  await browser.close();
}
