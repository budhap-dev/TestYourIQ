# unIQo

A web app that estimates IQ with a timed test of original reasoning puzzles, scored against
people of the same age. It gives an estimate, not a clinical assessment.

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
| `npm run gen:icons`  | Render app icons and the link-preview card from `public/favicon.svg` |
| `npm run migrate`    | Apply new SQL migrations in `db/migrations`                          |
| `npm run seed`       | Insert starting IRT parameters for every item template and bank item |
| `npm run db:setup`   | `migrate` then `seed`                                                |
| `npm run check:api`  | Compile the API the way Vercel does and import every function        |

## Environment variables

See `.env.example`.

| Variable         | Purpose                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | Postgres connection string. Neon URLs use Neon's serverless driver; others use node-postgres. Empty in local dev means an in-memory store. Required in production.                                                   |
| `CRON_SECRET`    | Optional. Turns on the weekly maintenance cron (purge, then calibrate); Vercel sends it as a bearer token.                                                                                                           |
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

## Calibration

Scores start from **estimated** norms and item parameters. As consenting first-time test-takers
complete the test, recalibrate:

```bash
DATABASE_URL=postgres://… npm run calibrate -- --dry-run   # preview
DATABASE_URL=postgres://… npm run calibrate
```

- **Data used:** only eligible attempts. That means the person's first attempt, with consent,
  and none of the quality flags (median under 3 seconds per item, one option position
  ≥ 75% of the time, an aberrant response pattern). Only questions that were actually shown
  count.
- **Method:** marginal maximum likelihood (Bock–Aitkin EM) for item `a`/`b`, with one ability
  distribution per age band. Young adults (20–34) anchor the scale at N(0, 1) once there are at
  least 200 of them. Items need 50 responses and bands need 30 people before they move; anything
  with less data keeps its previous values.
- **Output:** a new `norms_versions` row with all 16 bands, and a new `item_params` version for
  re-estimated items. History is never overwritten. Each attempt records the norms version that
  scored it, and new attempts use the latest.
- **Calibrating note:** results show "Calibrating" while a band has fewer than 500 eligible
  attempts.

With `CRON_SECRET` set, Vercel Cron calls `/api/cron/maintenance` every Monday at 03:00 UTC. It
deletes records older than 24 months, then recalibrates. Without the secret, the endpoint
returns 503.

## Deploying (Vercel)

1. Import the repository into Vercel. The framework preset is Vite; `vercel.json` sets the build,
   output and SPA rewrites. Functions in `/api` deploy automatically on Node.js 22 or later.
2. Set `DATABASE_URL` and `SESSION_SECRET` for Production (and Preview, ideally a separate Neon
   branch).
3. Run `npm run db:setup` against the production database once, and again whenever a new
   migration is added.
4. Optionally set `CRON_SECRET` to enable the weekly maintenance cron (see Calibration). The
   cron function is limited to 60 seconds (the Hobby plan maximum). On Pro, raise `maxDuration` in
   `vercel.json` if calibration grows slow.
5. `npm run check:api` (run in CI or before deploying) catches module errors that only show up
   in Vercel's per-file compilation.

## Themes

There are ten colour palettes, each with a light and a dark version. Visitors choose Auto,
Light or Dark and a palette from the **Appearance** menu. Palettes are defined in
`src/styles/palettes.ts` as a few OKLCH values. After editing them, run `npm run gen:themes`.
Tests check every palette in both modes against WCAG 2.2 AA contrast.

## Installing and sharing

The app can be installed on phones and desktops (`public/manifest.webmanifest`). Chrome, Edge and
Android offer it in the browser menu, and the footer shows **Install app** when the browser
allows it. On iPhone and iPad, the same button explains the Share → **Add to Home Screen** steps.
The service worker (`public/sw.js`) only shows `public/offline.html` when a page can't load
offline; it caches nothing else, so deploys and the API are never stale.

Links shared on WhatsApp, iMessage, Slack and social sites show `public/og-image.png`
(1200 × 630). Previews need absolute URLs: the build uses `SITE_URL` if set, otherwise Vercel's
production domain. Set `SITE_URL` (for example `https://uniqo.co.uk`) if you add a custom domain
and want links to it to show the card from that domain. Icons and the card are generated by
`npm run gen:icons`; edit the artwork or wording in `scripts/gen-icons.ts` and re-run it.
WhatsApp caches previews per URL, so a changed card may take a while to appear on a link that
has already been shared.

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

## Testing

- **Unit and integration** (`npm test`):
  - every generator: same seed gives the same item, exactly one correct answer (checked
    independently), no duplicate options, option-only guessing at chance
  - IRT and EAP maths against known answer patterns
  - norms and IQ maths
  - the attempt service: adaptivity, timeouts, resume, retakes without repeats, token tampering,
    rate limits
  - the real SQL migrations and Postgres store, on embedded Postgres (PGlite)
  - calibration recovering known parameters from simulated data
- **End to end** (`npm run test:e2e`; first run `npx playwright install chromium`):
  - the full flow on desktop by keyboard alone (light theme) and on a 360px touch phone (dark
    theme)
  - a retake from the same browser shows no repeated question
  - no API response contains answers or item keys
  - axe WCAG 2.2 AA audits of every screen
  - 44px touch targets
  - focus moves to each new question
  - reduced motion
- **CI** (`.github/workflows/ci.yml`) runs lint, typecheck, format, unit tests, build, the bundle
  and API checks, and the end-to-end suite on every pull request.

## Accessibility

- Keyboard: number keys 1–8 choose, Enter confirms, and all controls are reachable with Tab.
  After each answer, focus moves to the new question so screen readers announce it.
- Pattern questions describe each cell in text, e.g. "3 large shaded crosses". Shape-turning
  questions are visual only, and the landing page says so.
- Colours meet WCAG 2.2 AA in all ten palettes, light and dark (tested), with visible focus
  rings, reduced motion respected, and no information carried by colour alone.

## Project layout

```
/api                 Vercel functions (thin wrappers)
/server              API logic: service, handlers, tokens, Postgres and in-memory stores
/db/migrations       SQL migrations
/scripts             migrate, seed, calibrate, purge, gen-themes, check-api
/src
  /app               routes, layout, theme state
  /components        shared UI
  /features/test     test flow (later step)
  /features/results  results (later step)
  /engine            generators, IRT, scoring, blueprint (framework-free, shared with /server)
  /styles            tokens, palettes, generated themes
/tests               Vitest (unit, server, embedded Postgres) and /tests/e2e (Playwright)
```

See `DECISIONS.md` for choices made along the way.
