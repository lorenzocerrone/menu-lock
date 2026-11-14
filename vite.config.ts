import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// BASE_PATH is where the site is served from: "/" locally, "/menu-lock/" on
// GitHub Pages, "/menu-lock/pr-preview/pr-<n>/" for a pull-request preview.
// It only affects asset URLs: routing is in the hash, so links never need it.
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
	base,
	plugins: [react(), tailwindcss()],
	preview: { port: 4173, strictPort: true },
	test: {
		include: ["src/**/*.test.{ts,tsx}"],
	},
});
