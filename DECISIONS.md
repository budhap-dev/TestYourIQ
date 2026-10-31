# Decisions

Choices made where the build prompt left something **Open**, or where I had to pick a default.
Each entry says what was chosen and why. Change any of them freely.

## Step 1 — Scaffold

| Topic              | Choice                                                                                                                       | Why                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| App name           | "Test Your IQ" (in `src/app/config.ts`)                                                                                      | Matches the repo name. One constant to change.                                                       |
| Router             | React Router 7 (`react-router` package), data router                                                                         | Current major; still supports React 18.                                                              |
| Styling            | CSS Modules + global token files                                                                                             | As specified; no extra build tooling.                                                                |
| Fonts              | Fraunces (display) + IBM Plex Sans (body), Google Fonts                                                                      | Fraunces gives a distinctive, bookish feel; Plex Sans is very legible and has true tabular numerals. |
| Themes             | 10 colour palettes (Slate, Ocean, Indigo, Plum, Rose, Crimson, Terracotta, Amber, Sage, Graphite), each with light and dark  | Requested. Default is Slate.                                                                         |
| Theme mode         | Auto (follows system) / Light / Dark, chosen in an "Appearance" menu                                                         | Spec asks for system-following plus a toggle; a three-way choice lets people return to Auto.         |
| Palette generation | Palettes are defined by a few OKLCH numbers in `src/styles/palettes.ts`; `npm run gen:themes` writes `src/styles/themes.css` | Keeps 20 palette variants consistent. A test fails if the CSS is stale.                              |
| Contrast           | Every palette/mode is tested against WCAG 2.2 AA (`tests/themes.test.ts`)                                                    | Text 4.5:1, borders/focus rings 3:1.                                                                 |
| Theme storage      | `localStorage` (`theme`, `palette`), applied before first paint by an inline script                                          | Per-device convenience only; never sent to the server.                                               |
| Focus ring         | A complementary hue to the accent, so it stands out from buttons                                                             | Visible focus on every palette.                                                                      |
| Privacy contact    | `privacy@example.com` placeholder                                                                                            | **You need to supply a real address.**                                                               |
| Retention          | Delete test records after 24 months                                                                                          | A reasonable default for norming data; needs your sign-off.                                          |
| TS strictness      | `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`                                                         | Catches index/optional bugs in the scoring engine early.                                             |
