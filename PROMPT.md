# Build Prompt: IQ Estimate Test Web App

You are building a production-quality web app that estimates a person's IQ through a timed reasoning test, scored against people of the same age. Read this whole document before writing code. Where it says **Decision**, follow it; where it says **Open**, pick a sensible default and note what you chose in `DECISIONS.md`.

---

## 1. Product summary

- A visitor enters their age, takes a 25–35 minute test of original reasoning puzzles, and gets an estimated IQ with a confidence range, percentile and a breakdown by skill.
- Two tracks: **Junior (ages 8–15)** and **Adult (16+)**. Same app, different item difficulty ranges and different norm tables.
- **Retakes must not inflate scores.** A returning person must get a fresh set of questions they have not seen, of equivalent difficulty, and their retake must not pollute the norming data (see §5).
- Results are free and shown immediately. No paywall, no email gate, no dark patterns.
- The app is honest about what it is: an estimate, not a clinical assessment. This is stated on the landing page and the results page in plain language, without being alarmist.

## 2. Tech stack (Decision)

- **Frontend:** React 18 + TypeScript (strict mode) + Vite.
- **Styling:** CSS Modules or vanilla-extract with a design-token file. No UI kit that makes it look generic. Small, focused libraries are fine (e.g. `framer-motion` for transitions, `zod` for validation).
- **Routing:** React Router.
- **Backend:** Vercel Serverless Functions in `/api` (TypeScript).
- **Database:** Neon Postgres via `@neondatabase/serverless`. Migrations as plain SQL files in `/db/migrations`, applied by a small script.
- **Deploy:** Vercel. Provide `vercel.json` if needed and a `.env.example` (`DATABASE_URL`, `SESSION_SECRET`).
- **Testing:** Vitest for unit tests (generators, scoring, norms). Playwright for one end-to-end happy path.
- **Lint/format:** ESLint + Prettier.

The app must also run fully locally (`npm run dev`) against a Neon dev branch or a local Postgres.

## 3. UX and visual design

**Goal:** calm, focused and trustworthy, closer to a well-designed exam or a premium learning app than a viral quiz site.

- **Responsive:** must work well from 360px phones to large desktops. Puzzles must stay legible and tappable on a phone (minimum 44px touch targets; answer options reflow to a 2×N or 3×N grid).
- **Themes:** light and dark, following the system setting, with a toggle.
- **Accessibility:** WCAG 2.2 AA contrast, full keyboard operation (number keys 1–8 select answers, Enter confirms), visible focus states, `prefers-reduced-motion` respected, screen-reader labels on all controls. Visual puzzles are inherently visual; say so up front rather than pretending otherwise.
- **Typography:** a distinctive but readable pairing from Google Fonts; tabular numerals for scores and timers.
- **Flow:**
  1. **Landing** — what the test measures, how long it takes, what the score means, the "estimate, not diagnosis" note. One clear "Start" button.
  2. **Setup** — age (or date of birth), optional consent to use anonymised results for improving accuracy, a short practice round of 2 untimed items with feedback.
  3. **Test** — one item per screen, progress indicator, section timer that is visible but not stressful (no red flashing). Allow skipping; no going back after answering.
  4. **Results** — estimated IQ, 95% range (e.g. "112, likely between 104 and 120"), percentile ("higher than about 79% of people your age"), a bell curve with their position marked, and a bar per skill area. Plain-language explanation of what the numbers mean and their limits.
  5. **Retake** — if the person has taken the test before, say so and explain that they'll get new questions, and that practice can still slightly lift scores.
- **Polish:** smooth but brief transitions between items, no layout shift when options load, skeleton states while fetching.

## 4. Test content

### 4.1 Skill areas
Each test includes items from four areas, balanced across difficulty:

| Area | Item type |
|---|---|
| Pattern reasoning | 3×3 matrix with one missing cell (shapes, rotation, count, shading rules) |
| Numerical reasoning | Number series and simple number analogies |
| Spatial reasoning | Mental rotation and "which shape is the mirror image" |
| Verbal reasoning | Word analogies and odd-one-out (Adult track only; Junior uses simpler vocabulary) |

### 4.2 Items must be original
Do **not** reproduce or imitate items from Raven's Progressive Matrices, Mensa, WAIS, WISC, Stanford-Binet or any other published test. All items are generated or written for this app.

### 4.3 Procedural generation (Decision)
Pattern, numerical and spatial items are **generated from seeded generators**, not hand-drawn. This gives an effectively unlimited bank, which is what makes fair retakes possible.

- Each generator is a pure function `generate(seed, difficulty) → Item`, deterministic for a given seed.
- Difficulty is controlled by explicit parameters (number of simultaneous rules, rule types, number of distractors, distractor similarity).
- Distractors must be plausible: each wrong answer should break exactly one rule, not be random noise.
- Visual items are rendered as SVG from a declarative description, so they scale crisply on any screen and theme.
- Every generator has unit tests proving: exactly one correct answer, no duplicate options, deterministic output for a seed.

Verbal items come from a hand-written JSON bank (start with ~150 Adult and ~80 Junior items), each tagged with area, track and a starting difficulty estimate.

### 4.4 Item parameters
Every item (or generator template + difficulty level) has IRT parameters stored in the database:
- `a` (discrimination) and `b` (difficulty), 2-parameter logistic model.
- Seed values come from the generator's difficulty settings. They are re-estimated later from real responses (§6.3).

## 5. Retakes and fairness (Decision)

The goal: taking the test again gives a comparable score, not a better one from memorising answers.

1. **Never repeat an item to the same person.** Track seen item fingerprints (generator id + seed, or bank item id) per test-taker. Exclude them when building the next test.
2. **Identify returning test-takers without accounts:** an anonymous random ID stored in `localStorage` plus an HTTP-only signed cookie. Optional sign-in is out of scope for v1, but design the schema so it can be added.
3. **Parallel forms:** each test is assembled by a blueprint (fixed count per area per difficulty band), so every test has the same structure and difficulty profile even though the items differ.
4. **Adaptive selection:** after a short fixed opening, choose each next item to be most informative at the current ability estimate (maximum Fisher information), within the blueprint's constraints. This keeps tests short and makes different forms comparable.
5. **Answer keys stay on the server.** The client receives the item and options only; the server checks answers. Items are generated server-side from seeds the client cannot choose.
6. **Exclude retakes from norms.** Only a person's **first** completed attempt (and only with consent) feeds the norming data. Attempts that are abandoned, much too fast (e.g. median under 3 seconds per item) or flagged as random clicking are excluded too.
7. **Tell the user honestly** on retake results that familiarity with the item *types* can still add a few points, and show their previous score alongside.

## 6. Scoring

### 6.1 Ability estimate
- Estimate ability θ with **EAP (expected a posteriori)** under the 2PL model, with a standard normal prior. Also compute its standard error.
- Skipped and timed-out items count as incorrect.
- Per-area sub-scores use the same method on that area's items only, shown as "below average / average / above average" bands rather than precise numbers, because they rest on few items.

### 6.2 Age norms
- Age bands:
  - Junior: 8, 9, 10, 11, 12, 13, 14, 15 (one-year bands).
  - Adult: 16–19, 20–24, 25–34, 35–44, 45–54, 55–64, 65–74, 75+.
- Each band stores the mean and SD of θ in that population.
- `z = (θ − band_mean) / band_sd`, `IQ = round(100 + 15 × z)`, clamped to 55–145 (the test can't measure reliably beyond that; show "145+" / "below 55").
- 95% range: `IQ ± 1.96 × 15 × SE(θ) / band_sd`.
- Percentile from the normal CDF of z.

### 6.3 Calibration
- **Seed norms:** ship initial band means/SDs as clearly marked estimates in a migration (e.g. Adult 20–24: mean 0, SD 1; younger and older bands shifted by small amounts). Results pages show a "Calibrating — early estimate" note while a band has fewer than 500 eligible attempts.
- **Recalibration script** (`npm run calibrate`, run manually or on a Vercel cron): re-estimates item `a`/`b` from eligible responses and recomputes band means/SDs. Write results to a new `norms_version` row; never overwrite history. Each attempt records which norms version scored it.

## 7. Data model (Neon Postgres)

Minimum tables (adjust names as you see fit, document changes):

- `test_takers` — `id` (uuid), `created_at`, `first_completed_attempt_id`.
- `attempts` — `id`, `test_taker_id`, `track`, `age_years`, `age_band`, `consent_research` (bool), `started_at`, `completed_at`, `status`, `theta`, `theta_se`, `iq`, `norms_version`, `eligible_for_norms` (bool), `flags` (jsonb).
- `responses` — `attempt_id`, `position`, `item_key` (generator id + seed + difficulty, or bank id), `area`, `answer_index`, `is_correct`, `response_ms`.
- `seen_items` — `test_taker_id`, `item_key` (unique together).
- `item_params` — `item_key` or template key, `a`, `b`, `version`.
- `norms` — `version`, `track`, `age_band`, `mean`, `sd`, `n`, `created_at`.

**Privacy:** store age in whole years only (no date of birth, no name, no email, no IP address in the database). For Junior-track users, collect nothing beyond what scoring requires and default research consent to **off**. Add a short privacy page in plain English. The app is UK-based, so follow UK GDPR and the ICO Children's Code.

## 8. API (Vercel functions)

- `POST /api/attempts` — body `{ age, consentResearch }` → creates attempt, returns `attemptId` and first item.
- `POST /api/attempts/:id/answer` — body `{ itemToken, answerIndex, responseMs }` → records it, returns the next item or `{ done: true }`.
- `POST /api/attempts/:id/finish` → scores, returns results.
- `GET /api/attempts/:id/result` — reload-safe results view.

Items sent to the client carry a signed, short-lived `itemToken`, never the answer. Validate every body with zod. Rate-limit attempt creation per test-taker.

## 9. Project structure (suggested)

```
/api                 Vercel functions
/db/migrations       SQL
/scripts             migrate, seed, calibrate
/src
  /app               routes, layout
  /components        UI
  /features/test     test flow, timer, item renderer
  /features/results  results, bell curve
  /engine            generators, IRT, scoring, norms (shared with /api, no React)
  /styles            tokens, themes
/tests               vitest + playwright
```

`/src/engine` must be framework-free so the same code runs on the server.

## 10. Build order

1. Scaffold Vite + React + TS, linting, tokens, theme, layout shell.
2. Engine: one pattern-matrix generator end to end (generate → render SVG → check answer) with tests.
3. Remaining generators and the verbal bank.
4. IRT scoring, EAP, norms lookup, with tests using known answer patterns.
5. Database schema, migrations, API endpoints.
6. Test flow UI, then results UI.
7. Retake handling and seen-item exclusion.
8. Calibration script.
9. Accessibility and mobile pass, Playwright test, deploy to Vercel.

After each step, stop, summarise what was built, and list anything I need to decide.

## 11. Definition of done

- `npm run dev`, `npm test` and `npm run build` all pass.
- A full test can be taken on a 360px phone and on desktop, in both themes, by keyboard alone.
- Taking the test twice from the same browser shows zero repeated items.
- Results show IQ, 95% range, percentile, bell curve and area bands, with the calibration note when applicable.
- No answer keys are visible in network responses or the client bundle.
- README covers setup, environment variables, Neon setup, migrations, deploy and calibration.
