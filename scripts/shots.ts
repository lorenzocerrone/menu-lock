/**
 * Screenshots of every screen, for looking at after a visual change:
 * phone (390×844) and desktop (1280×800), light and dark, into shots/.
 *
 *   npm run shots            builds, then runs this
 *   tsx scripts/shots.ts     reuses the existing dist/
 */
import { mkdir, rm } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { preview } from "vite";

/** Add a line here for every new screen. `hash` is the route, with any fixture plan. */
const SCREENS = [
	{ name: "recipes", hash: "#/" },
	{ name: "recipes-filtered", hash: "#/?diet=veg&time=20" },
	{ name: "recipe", hash: "#/recipe/lentil_dal" },
	{ name: "planner", hash: "#/planner" },
	{ name: "grocery", hash: "#/grocery" },
	// The reference screens of the chosen design (needs VITE_LAB=1; `npm run shots` sets it).
	...(["recipes", "planner", "grocery"] as const).map((s) => ({
		name: `lab-${s}`,
		hash: `#/lab?s=${s}`,
	})),
];

const VIEWPORTS = [
	{ name: "phone", width: 390, height: 844 },
	{ name: "desktop", width: 1280, height: 800 },
] as const;

const SCHEMES = ["light", "dark"] as const;

const OUT = "shots";

const server = await preview({ preview: { port: 4174, strictPort: false } });
const origin = server.resolvedUrls?.local[0];
if (!origin) throw new Error("vite preview did not report a local URL");

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
try {
	for (const viewport of VIEWPORTS) {
		for (const colorScheme of SCHEMES) {
			const context = await browser.newContext({
				viewport: { width: viewport.width, height: viewport.height },
				deviceScaleFactor: 2,
				colorScheme,
				reducedMotion: "reduce",
			});
			const page = await context.newPage();
			for (const screen of SCREENS) {
				await page.goto(origin + screen.hash);
				await page.evaluate(async () => {
					await document.fonts.ready;
					// Full-page shots: load the images below the fold too.
					for (const img of document.images) img.loading = "eager";
					await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
				});
				// A tab bar fixed to the viewport would land mid-page in a full-page shot.
				await page.addStyleTag({
					content: 'nav[aria-label="Sections"] { position: static !important; }',
				});
				await page.waitForTimeout(400); // let entrance animations settle
				const path = `${OUT}/${screen.name}.${viewport.name}.${colorScheme}.png`;
				await page.screenshot({ path, fullPage: true });
				console.log(path);
			}
			await context.close();
		}
	}
} finally {
	await browser.close();
	await server.close();
}
