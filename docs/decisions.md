# Decisions

The log of what was decided and why, newest phase first. The full brief is
[`REWRITE_PLAN.md`](REWRITE_PLAN.md) (copied from cooking-rs at kickoff; this repo's copy
is now the one to edit).

## Status

| Phase                     | State                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| 0. Bootstrap              | Done. Live at `lorenzocerrone.github.io/menu-lock/`                              |
| 1. Design direction       | **Next** (brief below)                                                           |
| 2. Data and logic         | Done (done before phase 1: it needs no decisions and gives the design real data) |
| 3. Screens at parity      | Not started                                                                      |
| 4. Motion and personality | Not started                                                                      |
| 5. PWA and cutover        | Not started                                                                      |

Also done: the `add-recipe` skill (plan §9), in `.claude/skills/add-recipe/`.

## Phase 1 brief (from the user, 2026-11-14)

A mix of two directions from plan §7: **paper and receipt texture is the dominant
part** (grain, ruled or dotted backgrounds, a perforated receipt edge on the grocery
list, hand-drawn sienna underlines), **with a sprinkle of lockfile / terminal touches**
(a file-like header on the planner, mono gutters, dry copy in empty states). Motion was
not picked as a direction of its own; keep it to what serves these. Build the lab
directions as variations inside this brief, on the real recipes.

### The lab (`#/lab`)

Three directions, each with the three screens on the real recipes and a fixture plan,
in `src/lab/`. `d` and `s` in the URL pick the direction and the screen
(`#/lab?d=receipt&s=grocery`).

- **A · Notebook**: ruled paper with a sienna margin line, dates in the margin,
  hand-drawn underlines; the tick and the strike-through draw themselves.
- **B · Receipt**: paper objects. Recipes are taped index cards, planned days are
  ticket stubs, the grocery list is a till receipt with torn ends, dotted leaders and a
  stamp for each tick.
- **C · Lockfile**: the terminal motif turned up, to calibrate how much is too much. The
  plan is a file with a line-number gutter; the grocery list is `[x]` boxes.

**The user's pick (2026-11-14): B wins on all fronts.** The one change: the plan keeps
B's clarity (a card per planned day, the date on the left) and takes notebook touches
from A: a sienna margin line after the date, meals on ruled lines with a sienna bullet,
hand-drawn underlines under "Today", "Tomorrow" and "next week". Empty days are a plain
ruled row. This revised plan is what B's Plan tab in the lab now shows.

In all three, ticking a grocery line sinks it to the bottom of its aisle, and the
recipe chips filter the cards with a layout animation. The planner is look only.

The lab is in development builds, pull-request previews and builds made with
`VITE_LAB=1` (the browser tests and `npm run shots` use that); never on the live site.
The old illustrations have their title baked in, so the lab crops them to the icon.
**At the end of phase 1, delete `src/lab/`, `src/routes/lab.tsx`, the `/lab` route,
`tests/e2e/lab.spec.ts`, the lab entries in `scripts/shots.ts` and `VITE_LAB`.**

## Phase 2: data and logic (2026-11-14)

The data was migrated with `scripts/migrate-from-cooking-rs.ts`: 71 dictionary entries,
25 recipes, 25 illustrations. Nothing needed fixing by hand: every name matched, every
amount converts, and the `vegetarian` tag agreed with the ingredients on all 25 recipes.
As a cross-check, a plan holding all 25 recipes gives the same 71 summed amounts in
menu.lock as the same arithmetic on the old files. Authors are unchanged ("Claude").

Where things live: `src/lib/` (one module per concern, tests beside it),
`src/dataset.ts` (the bundled data, resolved once), `src/state/storage.ts` (localStorage).

Choices made while porting:

- **Wire format.** Reads every dated link cooking-rs wrote, and writes the same bytes
  back for the brief's example (tested). One unavoidable difference: Rust wrote float
  amounts as `1.0`, JavaScript writes `1`; both read both. The old weekday shape
  (`{"days": …}`) reads as "no plan", so the stored plan is used instead.
- **Catalog extras in links.** The `name` is looked up by key, display name or alias. Not
  found: a custom extra with the amount and unit as its text. Found but the amount does
  not convert for that ingredient: a custom extra under the dictionary's name, so nothing
  is mis-measured. The `note`, `optional` and `aisle` fields old extras could carry are
  ignored (the app never wrote them).
- **Name lookup** also tries the name with "es" added ("chopped tomato" finds Chopped
  tomatoes), on top of the old rules. Two entries that differ only by singular/plural
  are a validation error.
- **Grocery line** is one amount in one unit (`amount`, `unit`), plus `customQuantities`
  for hand-typed extras that joined it. `sources` are recipe **titles**; `extra` says an
  extra contributed. Sorting is by code point, as in cooking-rs, not by locale.
- **Ticks** are stored as `{ key, amount, custom }`: the amount (3 decimals) and the
  custom quantity texts at tick time. A tick goes when the line needs a larger amount, an
  amount it didn't have, or a custom text it didn't have.
- **Plan operations** return a new plan, or the same object when nothing changes.
  `moveMeal` takes an optional position and `reorderMeal` moves within a day: both are
  for drag and drop in phase 3 (cooking-rs only had swap and move-to-end).
- **Filters in the URL** are an object of search params (`q`, `diet`, `by`, `cuisine`,
  `tag`, `time`) for the router to serialise. A comma inside a value is written `%2C`.
- **Stored state** falls back part by part: an unreadable plan becomes empty and the
  grocery state is kept, and the other way round. A newer `version` is refused whole.
- **The cooking-rs import** (plan §5.7, listed under phase 5) is already implemented and
  unit-tested in `src/state/storage.ts`; phase 5 only has to cover it in a browser test.
- **JSON Schemas** in `schema/` are generated from the Zod schemas (`npm run schema`); a
  test fails when they are stale. `.vscode/settings.json` wires them to the data files.
- **House style of the data files** is kept by the formatter for recipes (one ingredient
  per line). `data/ingredients.json` is excluded from formatting: one entry per line,
  longer than the line width, grouped by aisle.
- **Biome also formats Markdown** in this version, including this file and the skill.

## Phase 0: bootstrap (2026-11-14)

Versions at bootstrap: Vite 8, React 19, TypeScript 7, Tailwind 4, TanStack Router 1,
Zustand 5, Zod 4, Biome 2, Vitest 5, Playwright 1.63.

- **Code-based routes** (`src/router.tsx`), not TanStack's file-based routing: four
  routes don't need a code generator and a generated file in the repo.
- **`plan` is validated and retained at the root route** (`retainSearchParams`), so
  every `<Link>` carries it without each page knowing. A non-string `plan` reads as none.
- **Base path comes from `BASE_PATH`** at build time (default `/`); it only affects asset
  URLs. **Preview builds set `VITE_PREVIEW=pr-<n>`**, which names the storage key
  (`menu-lock.pr-<n>.state`) and shows "preview · pr-n" beside the wordmark.
- **`src/lib` purity is a lint error**, not a convention: a Biome override bans React,
  router, store and UI imports and the browser globals there.
- **`@playwright/test` is pinned exactly** (1.63.0) to match the Chromium pre-installed
  in cloud sessions. Bump it only together with that browser; CI installs its own.
- **dnd-kit is the classic `@dnd-kit/core` + `sortable`** (stable), not the newer
  `@dnd-kit/react` (0.x). Revisit when the planner drag is built in phase 3.
- **Fonts**: only the latin subsets, weights 400/500/700 (Grotesk) and 400/700 (Mono),
  imported in `src/main.tsx`.
- **vite-plugin-pwa is not installed yet**: it arrives with phase 5, so no service
  worker can cache a half-built app in the meantime.
- **Tokens are the cooking-rs palette unchanged** (`src/styles/tokens.css`); the shell
  and its three placeholder pages are scaffolding for phase 1, not a design.
- The icon in `public/icons/icon.svg` is a placeholder; real icons come with phase 5.

## Carried over from the plan

### Decided before the rewrite (do not reopen without the user)

| Topic         | Decision                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Name          | App: **menu.lock**. Repo and URL path: **`menu-lock`**.                                                                                 |
| Language      | TypeScript (strict).                                                                                                                    |
| UI            | React + Vite.                                                                                                                           |
| Hosting       | GitHub Pages (`<user>.github.io/menu-lock/`), with per-PR preview sites.                                                                |
| Recipes       | Static JSON files in the repo, added by the `add-recipe` skill.                                                                         |
| Ingredients   | **Closed world**: every recipe ingredient must exist in the ingredient dictionary. The skill adds missing ones to the dictionary first. |
| Grocery ticks | **One state: ticked.** No "have it at home", no "omitted", no "hide to taste" toggle.                                                   |
| Images        | Keep the 25 existing SVG illustrations. New recipes get a shared placeholder. A tag-based set is a later session.                       |
| Look          | Keep the parchment / ink / sienna paper style and Space Grotesk + Space Mono, and evolve it freely.                                     |
| Legacy links  | Only the current dated plan format is read. Older shapes are dropped.                                                                   |
| Old site      | Stays up until menu.lock reaches parity, then redirects to it, carrying the plan.                                                       |

### Deliberate differences from cooking-rs

1. No in-app recipe authoring (editor, paste, scaffolder: not ported).
2. Closed-world ingredients: recipes reference dictionary keys; every amount converts
   into the shopping unit, so each grocery line is one number in one unit.
3. Derived, not written: `vegetarian`, total time and filter options are computed.
4. Resolve once on load to `{ key, perServing, optional }`; the grocery list only
   multiplies and adds.
5. One schema (Zod) for types, validation and JSON Schema.
6. One grocery state: ticks, plus the day range.
7. Grocery rows: tap to tick, nothing else; "needed for" is shown inline.
8. Hash routing: no 404 fallback, no base-path bugs.
9. Self-hosted fonts.
10. Generated service worker (vite-plugin-pwa).
11. Short docs: `CLAUDE.md` and this file.
