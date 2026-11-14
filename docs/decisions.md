# Decisions

The log of what was decided and why, newest phase first. The full brief is
[`REWRITE_PLAN.md`](REWRITE_PLAN.md) (copied from cooking-rs at kickoff; this repo's copy
is now the one to edit).

## Status

| Phase                     | State                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| 0. Bootstrap              | Done. Live at `lorenzocerrone.github.io/menu-lock/`                              |
| 1. Design direction       | Done: direction B, with the notebook plan (design rules below)                   |
| 2. Data and logic         | Done (done before phase 1: it needs no decisions and gives the design real data) |
| 3. Screens at parity      | Done (signed off by the user on the preview)                                     |
| 4. Motion and personality | Done                                                                             |
| 5. PWA and cutover        | Done: menu.lock is live and cooking-rs redirects to it (2026-11-14)              |

Also done: the `add-recipe` skill (plan §9), in `.claude/skills/add-recipe/`.

## Phase 1: design direction (2026-11-14)

The brief was: paper and receipt texture dominant, with a sprinkle of lockfile /
terminal touches. Three directions were built as real screens in a lab (A Notebook,
B Receipt, C Lockfile). **The user picked B on all fronts**, with one change: the plan
keeps B's clarity and takes notebook touches from A. A and C are deleted.

### Design rules

- **Everything is a paper object on a grainy page.** The page is `bg-paper` with
  `.paper-grain`. Things on it are `bg-inset` cards with a hairline `border-rule-soft`,
  6px corners (`rounded-card`) and a hard 2px bottom edge (`shadow-card`); things that
  float above the page (the tab strip, a recipe card) use `shadow-lift`. No blurry
  shadows elsewhere.
- **Two voices.** Space Grotesk says what things are (titles, recipe and ingredient
  names). Space Mono says everything else: numbers, quantities, dates, captions, chips,
  tabs, actions.
- **Sienna is the only accent**: the current tab, today, bullets, "+ add" actions, a
  selected chip, the tick. Never for body text.
- **Recipes are taped index cards**: `.tape` at the top, tilted about ±0.8°, title in
  bold, a mono meta line. Filter chips are dashed outlines, solid sienna when on, with
  their count; an option that gives 0 is dimmed.
- **The grocery list is a till receipt** (`.receipt`): torn ends, "MENU.LOCK / resolved
  from N meals" at the top, aisles as spaced mono caps between dashed rules, a dotted
  leader from the name to the quantity, "LEFT TO BUY n / m", a barcode and a sign-off.
  A tick is a `Stamp`: the box gets a sienna check stamped in, the name is struck
  through and dimmed, and the row sinks to the bottom of its aisle.
- **The plan is a notebook page per planned day.** The date sits left of a sienna
  margin line (`.plan-margin`): mono weekday over a big day number; today's block is
  solid sienna. Meals are on ruled lines (`.plan-lines`, each row `h-line`) with a
  sienna bullet; custom servings on the right in mono; "+ add a meal" is the last line.
  Days without meals are a single ruled row with the date and a "+".
- **The hand-drawn `Underline` belongs to the plan only**: under "Today", "Tomorrow"
  and "next week". Using it elsewhere dilutes it.
- **Dashes mean "cut here"**: dashed rules separate sections of the receipt and outline
  chips. Solid hairlines are ruled paper.
- **The lockfile is seasoning, not structure**: the wordmark, mono captions ("8 meals ·
  14 days"), the receipt header, and dry copy in empty states (`menu.lock: nothing
  pinned yet`, `0 to buy. Suspicious.`). No line numbers, prompts or `[x]` boxes.
- **Motion**: one `spring` (src/ui/motion.ts) for anything that moves to a new place;
  transform and opacity only; the stamp has its own harder spring. `MotionConfig
  reducedMotion="user"` wraps the app, so every animation honours the system setting.
- **Tabs**: a paper strip with a sienna pill that slides to the current tab; floating
  at the bottom on phones, at the top from 720px.
- **Illustrations**: the 25 old SVGs have their title and cuisine drawn in, so they are
  cropped to the icon (`aspect-[8/3] object-top`). Redrawing them is the later
  illustration session of plan §10.

Where it lives: `src/styles/tokens.css` (colours, fonts, `--line`, the two shadows),
`src/styles/paper.css` (grain, receipt, tape, plan lines), `src/ui/` (`Shell`,
`PageTitle`, `Stamp`, `Underline`, `motion.ts`).

The lab that held the three directions, and then B's reference screens, is deleted:
phase 3 ported the screens into the real routes.

## Phase 3: screens at parity (2026-11-14)

Every page of plan §6 is built in the chosen design and wired to the store. Each box of
the parity checklist is covered by a unit test or a browser flow (`tests/e2e/`): the
seven flows of plan §8 plus drag and drop, keyboard reordering, clearing, the range,
extras, copying, the unknown recipe, garbage in the address, and the last plan coming
back. Not in this phase, by the plan: the installable PWA and offline (phase 5), and
the richer motion (phase 4).

How it is put together:

- **One store** (`src/state/store.ts`, a vanilla Zustand store so it is unit-tested
  without a browser): the plan, the grocery state and today. Every action goes through
  `src/lib` and then _settles_: past days drop off and ticks that no longer hold are
  dropped. `src/state/app.ts` creates it once from the URL and storage, saves it on
  every change, and moves "today" when the page is looked at again on a later date.
- **URL sync** (`src/state/urlSync.ts`): the store writes `?plan=` with `replace`; a
  plan that appears in the address (a link pasted into an open tab) is loaded. A plan
  that cannot be read is ignored and the address is rewritten.
- **Ticks are pruned against the current range.** Narrowing the range keeps a tick
  (the line needs less); widening it drops the tick if the line now needs more than
  when it was ticked.
- **Recipe filters** are validated by the route itself (`queryFromSearch`), so a
  hand-edited address can't break the page. Opening a recipe drops them from the
  address; Back returns to the filtered list.
- **"Add to week" adds the recipe with its own servings**, as in cooking-rs, whatever
  the stepper on the recipe page says: that stepper is for reading the recipe.
- **Sheets** are Vaul drawers: a bottom sheet on phones, the same panel centred from
  720px. A second step ("Move to…") replaces the sheet's content instead of stacking a
  sheet on a sheet. No snap points: no sheet is long enough to need them.
- **Drag and drop** (dnd-kit) is by a handle on each meal, so a tap on the meal still
  opens its sheet and the page still scrolls under a finger. Dropping on a meal takes
  its place; dropping on a day adds to its end. The handle also works from the
  keyboard (Space, arrows, Space).
- **Extras suggestions** also match the singular of what was typed ("2 eggs" offers
  Egg), which cooking-rs did not.
- **Accessibility pass**: every tap target is at least 44px (so `--line`, the ruled
  line, grew from 2.25rem to 2.75rem and chips are 44px tall). Text colours pass AA on
  every surface in both themes, checked by `src/styles/tokens.test.ts`; for that the
  light theme's `--muted` went from `#7c6e54` to `#756649` and `--sienna` from `#a85e30`
  to `#9a5426`. `--faint` is now only for decoration and done things.
- **User-facing strings with a number or a date** come from `src/lib/format.ts`
  (captions, button labels, toasts); fixed labels are written where they are used.
- Biome's `noArrayIndexKey` is off: meals, steps and ingredient lines have no identity
  but their position.

## Typing an ingredient: suggestions that forgive (2026-11-14)

The user asked for more autocomplete wherever an ingredient is typed. `suggest`
(`src/lib/extras.ts`) now ranks the dictionary for what is being typed: names (or
aliases) that start with it, then a word of the name that does ("oil" finds Olive
oil), then names containing it, then near misses of the start of a word (one slip
from four letters, two from eight; "galric", "brocoli", "courgete"), then its letters
in order ("mlk"). Guesses need the right first letter, so they don't drown the real
matches. Singular and plural are the same; within a group the shorter name is first.
It is used by the grocery page's extras and by a meal's swap and add.

Also changed: in the extras line, a bare number now means pieces for an ingredient
that is counted ("2 courgettes" is two zucchini, "3 garlic" three cloves) and the
shopping unit otherwise ("flour 500" is 500 g). cooking-rs read every bare number as
the shopping unit, which made "2 onions" two grams.

## Standing decision: no users yet, so no compatibility burden (2026-11-14)

The user: "App has no users so no need to worry about breaking links or changing
schemas/legacy." Until they say otherwise, the wire format, the stored state and the
data schema can change without migrations, and features ship to the live site without
a staged rollout. The compatibility that already exists (reading cooking-rs links, the
one-time import of its stored plan) stays because it is built and tested, not because
it must: it can be removed when it gets in the way.

## After the rewrite: two additions the user asked for (2026-11-14)

Both go beyond the parity checklist and both add to the wire format, with the user's
agreement. Links without them are written exactly as before, so every older link still
reads the same; cooking-rs is gone, so nothing needs to read the new shapes but
menu.lock.

**Ingredients on a day, without a recipe** ("Salmon fillet, 2 fillets", "Leftover pizza").

This replaced a first version, "notes" (free text with a buy switch), the same day: the
user found it more straightforward that a day holds recipes and ingredients, and an
ingredient is something the app already understands.

- A day's entry is a recipe or `{ item, buy? }`, where `item` is the same thing as a
  grocery extra: a dictionary ingredient with an optional amount and unit, or anything
  typed, with a free-text quantity. On the wire the item is written like an extra:
  `{"item":{"name":"salmon","amount":2,"unit":"fillets"},"buy":true}`,
  `{"item":{"name":"Leftover pizza","quantity":null}}`.
- The "add a meal" picker reads what is typed twice: as a recipe search, and as an
  ingredient ("salmon 2 fillets" is a name and a quantity). Under the recipes it lists
  the matching ingredients (fuzzy, as everywhere), and offers what was typed as it is:
  "plan only" or "and buy it". A listed ingredient is added to buy; if its quantity does
  not convert for it, it is kept as typed.
- With `buy`, a listed ingredient adds to its grocery line (in its aisle, summed with
  the recipes that use it, not scaled), and a typed one is a line in Other; both are
  "for" the plan. Without `buy` it is only on the plan (leftovers).
- Its sheet edits how much of it and has "On the grocery list".
- On the plan it has a ring where a recipe has a dot, then its quantity, then "buy".
- Extras on the grocery page stay: an extra is shopping only, with no day; an
  ingredient on a day follows that day (the range, and dropping off when it passes).

**Changing a recipe for one planned meal** (the user picked: per meal, with all four
kinds of change).

- A planned recipe can carry `changes`, at most one per ingredient key: swap it for
  another dictionary ingredient, leave it out, set its amount, or add an ingredient.
  On the wire: `{"recipe":"lentil_dal","changes":[{"swap":"onion","for":"red_onion"},
  {"skip":"salt"},{"set":"garlic","amount":6,"unit":"clove"},{"add":"lemon","amount":1}]}`.
- The recipe file never changes. `applyChanges` (`src/lib/changes.ts`) gives the meal's
  own lines; the grocery list and the recipe page opened from that meal use them.
- Amounts in a change are for the recipe's own servings and scale with the meal like
  every other line. The editor shows them for the meal's servings.
- A swap without an amount keeps the recipe's amount when it means something for the
  new ingredient (2 scallions become 2 onions); when it doesn't (2 tbsp of something
  sold by weight), the line becomes "to taste" rather than a wrong number.
- An ingredient that is not in the dictionary can be swapped in or added **as typed**
  (the user: the strict list collided with changing a meal on the fly). It has a name
  and a free-text quantity; on the grocery list it is a line in Other, for that recipe,
  with its quantities side by side: not added up, not scaled with the servings, not in
  its real aisle. On the wire: `{"swap":"onion","name":"Shallots","quantity":"3"}` and
  `{"addName":"Bay leaves","quantity":null}`. When the name is in the dictionary, the
  dictionary's entry is offered and "as typed" is not.
- **Recipe files stay strict** (closed world): that is what makes the grocery list add
  up. The slack is only in a meal's changes and in the grocery page's extras.
- A change that can't be read in a link is dropped; the rest of the plan is kept.
- "View recipe" from a planned meal opens `#/recipe/<id>?meal=<date>.<position>`, which
  shows that meal's servings and changes; the steps are always the recipe's own words.
- The meal's sheet reads top to bottom as the meal itself: when it is, how long it
  takes, the recipe's description, the servings, then its ingredients as this meal has
  them. Tapping an ingredient changes it in place. What is done to the meal as a whole
  (view the recipe and steps, move, remove) comes last. (The user found the first
  version, a sheet of actions with "Change ingredients" hidden behind a row, too blank:
  you were asked to change ingredients you could not see.)
- The plan says "changed" beside a meal that has changes.

## Phase 5: PWA and cutover (2026-11-14)

The app part:

- **Installable and offline** with `vite-plugin-pwa`: a generated service worker
  precaches everything (the app, the fonts, the 26 illustrations: 70 files, under 1 MB)
  and updates itself (`registerType: "autoUpdate"`: a new version installs and reloads
  the page, which loses nothing because the plan is in the address and in storage).
- **No navigation fallback.** Routing is in the hash, so the only page is `index.html`,
  and the worker never answers for addresses it doesn't own. That matters because the
  pull-request previews live inside the live app's scope (`/menu-lock/pr-preview/…`).
  **Preview builds get no service worker** (`VITE_PREVIEW` disables the plugin).
- **Icons**: `public/icons/icon.svg` (a padlock whose body is a list, on paper) is the
  source; `npm run icons` renders the 192, 512 and Apple touch PNGs, which are
  committed. The 512 is also declared maskable: the mark sits inside the safe zone.
- **Manifest**: name and short name `menu.lock`, standalone, background and theme
  colour `#efe8d8` (`--paper`). `index.html` keeps a dark `theme-color` for dark mode.
- **The cooking-rs import** (built in phase 2) now has its browser test: the plan in
  `cooking-rs.state` appears on the first start, without cooking-rs's ticks or range,
  and is never read again once menu.lock has stored its own state.
- `npm audit` reports low and moderate findings in the build-time dependencies of
  `workbox-build`; nothing of it ships in the app.

The cutover, done on 2026-11-14 after menu.lock went live (the user confirmed nobody
relied on the old site): cooking-rs's deployed site is now `redirect/index.html` from
that repo (also its `404.html`), which sends every old address to the same page here
with its plan and recipe filters, plus a `sw.js` that removes the old app's service
worker. The mapping is tested in that repo (`node redirect/test.mjs`).

The rewrite is complete. What the plan lists for later (§10): a tag-based set of
illustrations, hosting on Cloudflare, family sync, a better way to add recipes from the
phone.

## Phase 4: motion and personality (2026-11-14)

The brief kept motion to what serves the paper look, so this is a short list, each
piece small:

- **A recipe's illustration travels** between its card and its page, and back, and the
  tabs cross-fade: the browser's View Transitions, started by the router on the links
  that ask for it (`viewTransition` on the tab links and the recipe card;
  `router.shouldViewTransition = true` before going back). The tab strip is its own
  transition group, so it stays put. Rewriting the address after a plan or filter
  change never starts one. Browsers without View Transitions just switch pages.
- **A done thing is struck through by a line that draws itself** (`.strike` in
  `paper.css`): a ticked grocery line, a finished step. On wrapped text it draws across
  every line.
- **Numbers roll** to their new value (`Roll`): recipe amounts when the servings change,
  the Grocery tab's count, the receipt's "LEFT TO BUY".
- **Everything bought gets a stamp**: "ALL BOUGHT" lands on the receipt's barcode, with
  a longer buzz on phones that vibrate.
- **Meals arrive and leave** a day with a short slide; a meal being dragged is lifted
  (tilted, slightly larger, a deeper shadow) and a drop is felt.
- Left out on purpose: a token flying to the Plan tab (the tabs are hidden on the
  recipe page), a collapsing recipe header, days sliding as dates roll, per-aisle
  progress bars. None of them earned its complexity.

Checked:

- **Reduced motion**: Motion keeps only fades (`MotionConfig reducedMotion="user"`),
  CSS transitions are cut to nothing, and view transitions are switched off. A browser
  test runs a flow that way and asserts nothing is moving.
- **A slow phone** (Chromium with the CPU slowed 4×): ticking ten lines of a 43-line
  list first cost a long frame on almost every tick. A tick now re-renders only its own
  row (the list is memoised apart from the ticks, rows are `memo`), which left 2 long
  frames (about 100 ms at 4×) over ten ticks. Dragging a meal: frames of 60–80 ms at 4×.
  Filtering 25 cards and opening a recipe: 60–100 ms at 4×. Measured by hand, not in CI,
  where timing tests are flaky.

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
- **Tokens are the cooking-rs palette unchanged** (`src/styles/tokens.css`). (Phase 1
  kept the palette and added the paper textures and the shell on top of it.)
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
