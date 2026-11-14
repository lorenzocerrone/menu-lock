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

In cloud sessions Chromium is pre-installed: never run `playwright install`.
`@playwright/test` is pinned to the version that matches it.

## Layout

```
data/            ingredients.json, recipes/<id>.json        (phase 2)
public/          images/<id>.svg, icons/
src/lib/         PURE logic: no React, no DOM, no clock, no store (Biome enforces it)
src/state/       Zustand store, localStorage boundary, URL sync
src/ui/          reusable components
src/routes/      pages; the route table is src/router.tsx
src/styles/      tokens.css (every colour and font), base.css
tests/e2e/       Playwright flows
scripts/         shots.ts, one-off migration
```

## Rules

- **Logic lives in `src/lib` and stays pure.** "Today" and anything from the browser is a
  parameter. Every function there has Vitest tests next to it (`x.test.ts`).
- **The plan wire format is byte-compatible with cooking-rs links** (plan §5.4). Never
  change it without the user.
- **Recipe ids and ingredient keys never change** once published: they are in share links.
- **Closed-world ingredients**: every recipe line references a dictionary key and
  converts into that ingredient's shopping unit, or validation fails.
- Routing is in the hash; `plan` is retained on every route by the root route's search
  middleware. Use `<Link to="…">`, never hand-built hrefs.
- Colours and fonts come from `src/styles/tokens.css` (Tailwind utilities `bg-paper`,
  `text-ink`, `font-mono`, breakpoint `wide:` = 720px). No hard-coded colours.
- Keep the dependency list as it is. Ask before adding a library.
- No new features beyond the parity checklist unless the user asks. The non-goals in
  plan §1 are deliberate.
- Commits: small, `feat(scope): …` / `fix(scope): …` / `docs: …`.

The old repo is the reference implementation: each Rust module in its `src/` ends with
unit tests that are the spec for the logic being ported. Where it and the plan disagree,
the plan wins.
