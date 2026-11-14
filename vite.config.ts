import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// BASE_PATH is where the site is served from: "/" locally, "/menu-lock/" on
// GitHub Pages, "/menu-lock/pr-preview/pr-<n>/" for a pull-request preview.
// It only affects asset URLs: routing is in the hash, so links never need it.
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
	base,
	plugins: [
		react(),
		tailwindcss(),
		// The installable, offline app: a generated service worker that precaches
		// everything (the app, fonts, illustrations) and updates itself.
		VitePWA({
			// A pull-request preview lives inside the live app's scope, so it gets no
			// service worker of its own and can't be mistaken for the real app.
			disable: !!process.env.VITE_PREVIEW,
			registerType: "autoUpdate",
			injectRegister: false, // registered in src/main.tsx
			includeAssets: ["icons/*", "images/*"],
			manifest: {
				name: "menu.lock",
				short_name: "menu.lock",
				description:
					"Recipes, a meal plan that lives in the URL, and the grocery list resolved from it.",
				start_url: ".",
				scope: ".",
				display: "standalone",
				// --paper, the page colour (src/styles/tokens.css).
				background_color: "#efe8d8",
				theme_color: "#efe8d8",
				icons: [
					{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
					{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
					{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
				// Routing is in the hash: the only page is index.html. Without a
				// fallback, the worker never answers for addresses it doesn't own
				// (the pull-request previews under pr-preview/).
				navigateFallback: null,
				cleanupOutdatedCaches: true,
			},
		}),
	],
	preview: { port: 4173, strictPort: true },
	test: {
		include: ["src/**/*.test.{ts,tsx}"],
	},
});
