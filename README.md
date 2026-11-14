# menu.lock

Recipes, a meal plan for the coming days, and the grocery list resolved from it.

**The plan is a lockfile.** The whole plan lives in the URL: bookmarking it, copying the
address bar or pressing Share all give the same link, and opening it gives the same plan.
No accounts, no server, no database.

> **Status: being built.** This is the TypeScript rewrite of the proof of concept
> [`cooking-rs`](https://github.com/lorenzocerrone/cooking-rs). The brief is
> [`docs/REWRITE_PLAN.md`](docs/REWRITE_PLAN.md); progress and decisions are in
> [`docs/decisions.md`](docs/decisions.md).

## Develop

Node 22 or newer.

```sh
npm install
npm run dev      # dev server
npm run check    # lint + format, types, unit tests: run before every commit
npm run e2e      # browser tests (first time: npx playwright install chromium)
npm run shots    # screenshots of every screen into shots/
npm run build    # static site into dist/
```

## Stack

Vite, React, TypeScript (strict), TanStack Router (hash history), Zustand, Tailwind CSS,
Motion, Vaul, dnd-kit, Zod; Biome, Vitest and Playwright for checking.

## Deploy (GitHub Pages)

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds with the repo's base
path and publishes `dist/` to the root of the `gh-pages` branch. Every pull request gets
a preview at `https://<user>.github.io/menu-lock/pr-preview/pr-<number>/`, linked on the
PR and removed when it closes; a preview keeps its own saved data.

One-time setup: **Settings → Pages → Build and deployment → Source: Deploy from a
branch → `gh-pages`, `/ (root)`**. The branch appears after the first deploy from `main`.
