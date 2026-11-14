import { expect, test } from "@playwright/test";
import { iso, planParam } from "./helpers";

// REWRITE_PLAN §8, phase 5.

test("works offline after the first visit, fonts and illustrations included", async ({
	page,
	context,
}) => {
	await page.goto("/");
	await expect(page.getByText("25 of 25")).toBeVisible();
	// The service worker is active once everything is precached.
	await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByText("25 of 25")).toBeVisible();

	await page.getByRole("link", { name: /Lentil Dal/ }).click();
	await expect(page.getByRole("heading", { name: "Lentil Dal" })).toBeVisible();
	const illustration = page.locator("article img");
	await expect
		.poll(() => illustration.evaluate((img: HTMLImageElement) => img.naturalWidth))
		.toBeGreaterThan(0);
	const fonts = await page.evaluate(async () => {
		await Promise.all([
			document.fonts.load('16px "Space Grotesk"'),
			document.fonts.load('700 16px "Space Mono"'),
		]);
		return (
			document.fonts.check('16px "Space Grotesk"') && document.fonts.check('700 16px "Space Mono"')
		);
	});
	expect(fonts).toBe(true);

	// A shared link opens offline too.
	await page.goto(`/#/grocery?plan=${planParam({ dates: { [iso(0)]: ["carbonara"] } })}`);
	await page.reload();
	await expect(page.getByText("resolved from 1 meal")).toBeVisible();
});

test("is installable: a manifest with icons", async ({ page, request }) => {
	await page.goto("/");
	const href = await page.locator('link[rel="manifest"]').getAttribute("href");
	const manifest = await (await request.get(href ?? "")).json();
	expect(manifest).toMatchObject({ name: "menu.lock", display: "standalone", start_url: "." });
	for (const icon of manifest.icons) expect((await request.get(`/${icon.src}`)).ok()).toBe(true);
});

test("the plan last opened in cooking-rs is imported on the first start", async ({ page }) => {
	// What cooking-rs left in localStorage on the same origin (its version 3 payload).
	const old = `{"version":3,"plan":{"dates":{"${iso(1)}":["carbonara",{"recipe":"lentil_dal","servings":6}]},"extras":[{"name":"milk","amount":1.0,"unit":"l"}]},"grocery":{"checked":[{"key":"onion","subtotals":[["Mass",250.0]]}],"omitted":["salt"],"hide_to_taste":true,"range":{"days":3}}}`;
	await page.addInitScript((value) => localStorage.setItem("cooking-rs.state", value), old);
	await page.goto("/"); // as the old home-screen icon does, after the redirect
	await page.getByRole("link", { name: "Plan" }).click();
	await expect(page.getByText("2 meals · 14 days")).toBeVisible();
	await expect(page.getByRole("region").nth(1).getByRole("listitem")).toHaveText([
		/Spaghetti Carbonara/,
		/Lentil Dal.*serves 6/,
	]);
	await expect(page).toHaveURL(/plan=/);
	// Only the plan: cooking-rs's ticks and range are not carried over.
	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(page.getByRole("button", { name: "All planned" })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByRole("button", { name: /^Onion / })).toHaveAttribute(
		"aria-pressed",
		"false",
	);

	// Once menu.lock has its own state, cooking-rs's is never read again.
	await page.getByRole("link", { name: "Plan" }).click();
	await page.getByRole("button", { name: "Clear plan" }).click();
	await page.getByRole("button", { name: "Everything" }).click();
	await page.goto("about:blank");
	await page.goto("/");
	await page.getByRole("link", { name: "Plan" }).click();
	await expect(page.getByText("0 meals · 14 days")).toBeVisible();
});
