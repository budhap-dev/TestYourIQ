# Test Your IQ

A web app that estimates IQ with a timed test of original reasoning puzzles, scored against
people of the same age. It gives an estimate, not a clinical assessment.

> Work in progress. This README grows with each build step. Database, API, deploy and
> calibration sections arrive with those steps.

## Requirements

- Node.js 20 or later (developed on Node 24)
- npm

## Getting started

```bash
npm install
cp .env.example .env    # not needed until the API step
npm run dev             # http://localhost:5173
```

## Scripts

| Script               | What it does                                                     |
| -------------------- | ---------------------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server                                        |
| `npm run build`      | Type-check and build to `dist/`                                  |
| `npm run preview`    | Serve the production build                                       |
| `npm test`           | Run unit tests (Vitest)                                          |
| `npm run lint`       | ESLint                                                           |
| `npm run format`     | Prettier (write)                                                 |
| `npm run gen:themes` | Regenerate `src/styles/themes.css` from `src/styles/palettes.ts` |

## Environment variables

See `.env.example`.

| Variable         | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `DATABASE_URL`   | Neon Postgres connection string                          |
| `SESSION_SECRET` | Secret for signing the test-taker cookie and item tokens |

## Themes

There are ten colour palettes, each with a light and a dark version. Visitors choose Auto,
Light or Dark and a palette from the **Appearance** menu. Palettes are defined in
`src/styles/palettes.ts` as a few OKLCH values. After editing them, run `npm run gen:themes`.
Tests check every palette in both modes against WCAG 2.2 AA contrast.

## Project layout

```
/api                 Vercel functions (later step)
/db/migrations       SQL migrations (later step)
/scripts             gen-themes; migrate, seed, calibrate later
/src
  /app               routes, layout, theme state
  /components        shared UI
  /features/test     test flow (later step)
  /features/results  results (later step)
  /engine            generators, IRT, scoring (framework-free; later step)
  /styles            tokens, palettes, generated themes
/tests               Vitest (and Playwright later)
```

See `DECISIONS.md` for choices made along the way.
