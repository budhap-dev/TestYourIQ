# unIQo

A web app that estimates IQ with a timed test of original reasoning puzzles, scored against
people of the same age. It gives an estimate, not a clinical assessment.

> Work in progress: the full flow works end to end; retake polish, calibration and the final accessibility pass come next.

## Requirements

- Node.js 22 or later (developed on Node 24)
- npm
- For production: a [Neon](https://neon.tech) Postgres database and a Vercel project

## Getting started

```bash
npm install
cp .env.example .env
npm run dev             # http://localhost:5173
```

With `DATABASE_URL` empty, `npm run dev` serves the API from a temporary in-memory store, which
is fine for trying the app. To develop against Postgres, set `DATABASE_URL` (a Neon dev branch
or a local Postgres) and run `npm run db:setup` once.

## Scripts

| Script               | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server                                            |
| `npm run build`      | Type-check and build to `dist/`                                      |
| `npm run preview`    | Serve the production build                                           |
| `npm test`           | Run unit tests (Vitest)                                              |
| `npm run lint`       | ESLint                                                               |
| `npm run format`     | Prettier (write)                                                     |
| `npm run gen:themes` | Regenerate `src/styles/themes.css` from `src/styles/palettes.ts`     |
| `npm run migrate`    | Apply new SQL migrations in `db/migrations`                          |
| `npm run seed`       | Insert starting IRT parameters for every item template and bank item |
| `npm run db:setup`   | `migrate` then `seed`                                                |
| `npm run check:api`  | Compile the API the way Vercel does and import every function        |

## Environment variables

See `.env.example`.

| Variable         | Purpose                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | Postgres connection string. Neon URLs use Neon's serverless driver; others use node-postgres. Empty in local dev means an in-memory store. Required in production.                                                   |
| `SESSION_SECRET` | At least 32 random characters, used to sign the test-taker cookie and encrypt item tokens. Required in production; generate with `openssl rand -base64 48`. Changing it invalidates every cookie and in-flight test. |

## Database (Neon)

1. Create a Neon project in a UK or EU region (the app is UK-based), and copy the pooled
   connection string.
2. For local work, create a Neon **dev branch** and put its connection string in `.env`.
3. Apply the schema and seed parameters (safe to re-run):

   ```bash
   DATABASE_URL=postgres://… npm run db:setup
   ```

   `migrate` applies `db/migrations/*.sql` in order and records them in `schema_migrations`.
   `002_seed_norms.sql` inserts **estimated** age norms (version 1, n = 0), so results show
   "Calibrating" until real data replaces them.

Tables: `test_takers`, `attempts`, `responses`, `seen_items`, `item_params`, `norms`,
`norms_versions`. Nothing identifies a person: there are no names, emails, dates of birth or IP
addresses, and age is stored in whole years.

## API

All endpoints are JSON, `no-store`, and identify the test-taker by an HTTP-only signed cookie
(`uniqo_taker`), or by the same signed token sent as an `x-taker` header from localStorage.

| Method | Path                       | Body                                                        | Returns                                                      |
| ------ | -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| `GET`  | `/api/me`                  |                                                             | Earlier results for this browser, for the retake notice      |
| `POST` | `/api/attempts`            | `{ age, consentResearch }`                                  | Attempt id, sections, retake info, first item                |
| `GET`  | `/api/attempts/:id`        |                                                             | The current item again (after a reload), or `{ done: true }` |
| `POST` | `/api/attempts/:id/answer` | `{ itemToken, answerIndex \| null, responseMs, timedOut? }` | Next item, or `{ done: true }`                               |
| `POST` | `/api/attempts/:id/finish` |                                                             | Results                                                      |
| `GET`  | `/api/attempts/:id/result` |                                                             | Results (reload-safe)                                        |

Items carry an encrypted, short-lived `itemToken`; the client never sees item keys, seeds or
answers. A test-taker can start at most 5 attempts an hour.

## Deploying (Vercel)

1. Import the repository into Vercel. The framework preset is Vite; `vercel.json` sets the build,
   output and SPA rewrites. Functions in `/api` deploy automatically on Node.js 22 or later.
2. Set `DATABASE_URL` and `SESSION_SECRET` for Production (and Preview, ideally a separate Neon
   branch).
3. Run `npm run db:setup` against the production database once, and again whenever a new
   migration is added.
4. `npm run check:api` (run in CI or before deploying) catches module errors that only show up
   in Vercel's per-file compilation.

## Themes

There are ten colour palettes, each with a light and a dark version. Visitors choose Auto,
Light or Dark and a palette from the **Appearance** menu. Palettes are defined in
`src/styles/palettes.ts` as a few OKLCH values. After editing them, run `npm run gen:themes`.
Tests check every palette in both modes against WCAG 2.2 AA contrast.

## Item engine

`src/engine` is framework-free TypeScript shared by the browser and the server.

- Generators are pure functions `generate(seed, difficulty) → Item`. The same seed always gives
  the same item. Difficulty levels 1–5 are explicit parameter tables (e.g. `MATRIX_LEVELS`).
- Items are rendered to SVG from a declarative description (`renderCell`) and follow the theme
  via `currentColor`.
- Answers never reach the browser: clients get `toPublicItem(item)`, and the server checks an
  answer by regenerating the item from its key (`checkAnswer`). ESLint stops UI code importing
  generators.

| Area      | Generators / source                                                       |
| --------- | ------------------------------------------------------------------------- |
| Pattern   | `matrix`: 3×3 grids                                                       |
| Numerical | `series`: number series · `number-analogy`: x → y rules                   |
| Spatial   | `rotation`: same shape turned · `mirror`: mirror image                    |
| Verbal    | `src/engine/verbal/bank.adult.json` and `bank.junior.json` (hand-written) |

While running `npm run dev`, open **http://localhost:5173/dev/puzzles** to browse any item by
type, level and seed, with its rule and answer. This page isn't in production builds.

## Project layout

```
/api                 Vercel functions (thin wrappers)
/server              API logic: service, handlers, tokens, Postgres and in-memory stores
/db/migrations       SQL migrations
/scripts             migrate, seed, gen-themes, check-api (calibrate later)
/src
  /app               routes, layout, theme state
  /components        shared UI
  /features/test     test flow (later step)
  /features/results  results (later step)
  /engine            generators, IRT, scoring, blueprint (framework-free, shared with /server)
  /styles            tokens, palettes, generated themes
/tests               Vitest (and Playwright later)
```

See `DECISIONS.md` for choices made along the way.
