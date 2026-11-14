/**
 * Render public/icons/icon.svg into the PNGs the manifest and iOS need.
 * Run after changing the icon: `npm run icons`. The PNGs are committed.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("public/icons/icon.svg", "utf8");
const SIZES = [
	{ file: "icon-192.png", size: 192 },
	{ file: "icon-512.png", size: 512 },
	{ file: "apple-touch-icon.png", size: 180 },
];

const browser = await chromium.launch();
try {
	for (const { file, size } of SIZES) {
		const page = await browser.newPage({ viewport: { width: size, height: size } });
		await page.setContent(
			`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
		);
		await page.screenshot({ path: `public/icons/${file}` });
		await page.close();
		console.log(`public/icons/${file}`);
	}
} finally {
	await browser.close();
}
