import { expect, test } from "@playwright/test";
import { iso, open, planParam } from "./helpers";

test("the three tabs navigate with hash routes", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "menu.lock" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
	// The bundled data loaded and passed validation in the browser.
	await expect(page.getByText("39 of 39")).toBeVisible();

	await page.getByRole("link", { name: "Plan" }).click();
	await expect(page).toHaveURL(/#\/planner$/);
	await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();

	await page.getByRole("link", { name: "Grocery" }).click();
	await expect(page).toHaveURL(/#\/grocery$/);
	await expect(page.getByRole("link", { name: "Grocery" })).toHaveAttribute("aria-current", "page");
});

test("the plan travels with every route", async ({ page }) => {
	const plan = { dates: { [iso(1)]: ["carbonara"] } };
	const param = planParam(plan);
	await open(page, "/planner", plan);
	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(page).toHaveURL(new RegExp(`#/grocery\\?plan=${param}$`));
	await page.getByRole("link", { name: "Recipes" }).click();
	await expect(page).toHaveURL(new RegExp(`#/\\?plan=${param}$`));
	await page.getByRole("link", { name: /Beef Stew with Wine and Olives/ }).click();
	await expect(page).toHaveURL(new RegExp(`#/recipe/beef_stew_wine_olives\\?plan=${param}$`));
});

test("a deep link survives a reload", async ({ page }) => {
	await page.goto("/#/grocery");
	await page.reload();
	await expect(page.getByRole("heading", { name: "Grocery" })).toBeVisible();
});

test("a sheet takes the keyboard focus, keeps it, and gives it back", async ({ page }, info) => {
	test.skip(info.project.name !== "desktop", "keyboard");
	await open(page, "/planner");
	const trigger = page.getByRole("button", { name: /^Add a meal on / }).first();
	await trigger.focus();
	await page.keyboard.press("Enter");
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	for (let i = 0; i < 25; i++) {
		await page.keyboard.press("Tab");
		const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
		expect(inside, `Tab ${i + 1} stays in the sheet`).toBe(true);
	}
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
});

test("an address that is no page has the tabs and a way back, keeping the plan", async ({
	page,
}) => {
	const param = planParam({ dates: { [iso(1)]: ["carbonara"] } });
	await page.goto(`/#/shopping?plan=${param}`);
	await expect(page.getByRole("heading", { name: "No such page" })).toBeVisible();
	await page.getByRole("link", { name: "‹ All recipes" }).click();
	await expect(page.getByText("39 of 39")).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`plan=${param}`));
});
