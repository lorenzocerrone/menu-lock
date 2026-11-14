# menu.lock: agent guide

A phone-first static web app for a household that cooks at home: **recipes**, a
**plan** for the coming days, and the **grocery list** resolved from it. The plan is a
lockfile: it lives entirely in the URL (`#/planner?plan=<base64url>`). No accounts, no
server, no database.

It is a TypeScript rewrite of the Rust proof of concept `lorenzocerrone/cooking-rs`.
**`docs/REWRITE_PLAN.md` is the brief**: the rules that must be exactly right (§5), the
parity checklist (§6), the phases (§8). Read the section you are working on before you
start. `docs/decisions.md` records what was decided and where the project stands; update
it at the end of each phase and whenever a decision is made.

## Commands

- `npm run dev`: dev server.
- `npm run check`: Biome + `tsc` + Vitest. **Run before every commit.** Takes seconds.
- `npm run format`: apply Biome's formatting and safe fixes.
- `npm run e2e -- --trace off`: Playwright flows against the production build.
- `npm run shots`: build and screenshot every screen into `shots/` (phone + desktop,
  light + dark). **Run after any visual change and look at the images.** New screen:
  add it to `SCREENS` in `scripts/shots.ts`.
- `npm run build`: production build into `dist/`.
- `npm run schema`: regenerate `schema/*.json` after changing `src/lib/schema.ts`.
- `npm run icons`: regenerate the icon PNGs after changing `public/icons/icon.svg`.

`npm run check` also validates every file in `data/`. Its messages name the file and the
ingredient line; fix the data, not the check.

In cloud sessions Chromium is pre-installed: never run `playwright install`.
`@playwright/test` is pinned to the version that matches it.

## Layout

```
data/            ingredients.json (the dictionary), recipes/<id>.json
public/          images/<id>.svg (+ placeholder.svg), icons/
schema/          JSON Schemas for the data files (generated)
src/lib/         PURE logic: no React, no DOM, no clock, no store (Biome enforces it)
                 schema, data, units, dates, plan, planCodec, changes, grocery, filters,
                 extras, format, stored; fixtures.ts is for tests only
src/dataset.ts   the bundled data, validated and resolved once (DATA)
src/state/       the store (store.ts), its one instance and hooks (app.ts), URL sync, storage
src/ui/          reusable components: Shell, Sheet, Chip, Stepper, RecipeCard, RecipeFilters,
                 RecipePicker, DayPicker, MealChanges, PageTitle, Stamp, Roll, Underline, Toasts;
                 styles.ts, motion.ts
src/routes/      pages: recipes, recipe, planner, grocery; the route table is src/router.tsx
src/styles/      tokens.css (every colour and font), paper.css (textures), base.css
tests/e2e/       Playwright flows (helpers.ts builds plan links from today's date)
scripts/         shots.ts, gen-schema.ts, gen-icons.ts, the one-off migration
```

To add or change a recipe, use the `add-recipe` skill (`.claude/skills/add-recipe/`).

## Rules

- **Logic lives in `src/lib` and stays pure.** "Today" and anything from the browser is a
  parameter. Every function there has Vitest tests next to it (`x.test.ts`). The UI
  formats nothing itself: every user-facing number, date and quantity comes from
  `src/lib/format.ts`.
- **The app has no users yet** (the user, 2026-11-14): links, the plan wire format, the
  stored state and the data schema may change freely, without migrations or legacy
  readers. Keep changes simple rather than backwards compatible, and record them in
  `docs/decisions.md`. This ends when the user says people rely on the app.
- Recipe ids and ingredient keys are in share links and in plans; rename one only with
  a reason, and update every recipe and test that uses it.
- **Closed-world ingredients**: every recipe line references a dictionary key and
  converts into that ingredient's shopping unit, or validation fails.
- Routing is in the hash; `plan` is retained on every route by the root route's search
  middleware. Use `<Link to="…">`, never hand-built hrefs.
- Colours and fonts come from `src/styles/tokens.css` (Tailwind utilities `bg-paper`,
  `text-ink`, `font-mono`, `shadow-card`, `h-line`, breakpoint `wide:` = 720px). No
  hard-coded colours.
- **Follow the design rules** in `docs/decisions.md` (phase 1): paper objects on a
  grainy page, Grotesk for names and Mono for everything else, sienna as the only
  accent, the receipt, the notebook plan. Reuse `src/ui/` and `src/ui/styles.ts`.
- **State changes go through the store's actions** (`useApp((s) => s.addMeal)`), never
  around them: they are what keeps the URL, storage and the grocery ticks in step.
- Tap targets are at least 44px; text uses `text-ink`, `text-muted`, `text-sienna` or
  `text-danger` (`text-faint` is for decoration and done things only).
- Keep the dependency list as it is. Ask before adding a library.
- No new features beyond the parity checklist unless the user asks. The non-goals in
  plan §1 are deliberate.
- Commits: small, `feat(scope): …` / `fix(scope): …` / `docs: …`.

The old repo is the reference implementation: each Rust module in its `src/` ends with
unit tests that are the spec for the logic being ported. Where it and the plan disagree,
the plan wins.
