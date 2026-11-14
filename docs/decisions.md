# Decisions

The log of what was decided and why, newest phase first. The full brief is
[`REWRITE_PLAN.md`](REWRITE_PLAN.md) (copied from cooking-rs at kickoff; this repo's copy
is now the one to edit).

## Status

| Phase                     | State                              |
| ------------------------- | ---------------------------------- |
| 0. Bootstrap              | Done, except the user action below |
| 1. Design direction       | **Next**                           |
| 2. Data and logic         | Not started                        |
| 3. Screens at parity      | Not started                        |
| 4. Motion and personality | Not started                        |
| 5. PWA and cutover        | Not started                        |

**Waiting on the user (phase 0 exit):** merge the bootstrap into `main`, then
Settings → Pages → Deploy from a branch → `gh-pages`, `/ (root)`. The branch appears after
the first deploy from `main`.

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
