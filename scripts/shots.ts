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

/** `days` from today, as YYYY-MM-DD. */
function iso(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A fixture plan in the wire format, so the plan and the grocery list have something on them. */
const PLAN = Buffer.from(
	JSON.stringify({
		dates: {
			[iso(0)]: ["carbonara", "fennel_orange_salad"],
			[iso(1)]: [{ recipe: "beef_stew_wine_olives", servings: 6 }],
			[iso(3)]: ["lemon_chicken_scaloppine", "roast_potatoes_rosemary"],
			[iso(4)]: ["pasta_alla_norma", "tiramisu"],
			[iso(6)]: [{ recipe: "lasagna", servings: 8 }],
			[iso(8)]: ["saffron_risotto"],
		},
		extras: [
			{ name: "milk", amount: 1, unit: "l" },
			{ name: "egg", amount: 6 },
			{ name: "Toilet paper", quantity: "1 pack" },
		],
	}),
).toString("base64url");

/** Add a line here for every new screen. `hash` is the route, with any fixture plan. */
const SCREENS = [
	{ name: "recipes", hash: "#/" },
	{ name: "recipes-filtered", hash: "#/?diet=veg&time=20" },
	{ name: "recipe", hash: "#/recipe/carbonara" },
	{ name: "planner", hash: `#/planner?plan=${PLAN}` },
	{ name: "planner-empty", hash: "#/planner" },
	{ name: "grocery", hash: `#/grocery?plan=${PLAN}` },
	{ name: "grocery-empty", hash: "#/grocery" },
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
			for (const screen of SCREENS) {
				// A fresh context (and so fresh storage) per screen: one screen's plan must not leak into the next.
				const context = await browser.newContext({
					viewport: { width: viewport.width, height: viewport.height },
					deviceScaleFactor: 2,
					colorScheme,
					reducedMotion: "reduce",
				});
				const page = await context.newPage();
				await page.goto(origin + screen.hash);
				await page.evaluate(async () => {
					await document.fonts.ready;
					// Full-page shots: load the images below the fold too.
					for (const img of document.images) img.loading = "eager";
					await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
				});
				// Things fixed to the viewport would land mid-page in a full-page shot.
				await page.addStyleTag({
					content: 'nav[aria-label="Sections"], [data-fixed] { position: static !important; }',
				});
				await page.waitForTimeout(400); // let entrance animations settle
				const path = `${OUT}/${screen.name}.${viewport.name}.${colorScheme}.png`;
				await page.screenshot({ path, fullPage: true });
				console.log(path);
				await context.close();
			}
		}
	}
} finally {
	await browser.close();
	await server.close();
}
