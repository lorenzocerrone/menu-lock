import { expect, test } from "@playwright/test";

test("the three tabs navigate with hash routes", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "menu.lock" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();

	await page.getByRole("link", { name: "Plan" }).click();
	await expect(page).toHaveURL(/#\/planner$/);
	await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();

	await page.getByRole("link", { name: "Grocery" }).click();
	await expect(page).toHaveURL(/#\/grocery$/);
	await expect(page.getByRole("link", { name: "Grocery" })).toHaveAttribute("aria-current", "page");
});

test("the plan travels with every route", async ({ page }) => {
	await page.goto("/#/planner?plan=eyJkYXRlcyI6e319");
	await page.getByRole("link", { name: "Grocery" }).click();
	await expect(page).toHaveURL(/#\/grocery\?plan=eyJkYXRlcyI6e319$/);
	await page.getByRole("link", { name: "Recipes" }).click();
	await expect(page).toHaveURL(/#\/\?plan=eyJkYXRlcyI6e319$/);
});

test("a deep link survives a reload", async ({ page }) => {
	await page.goto("/#/grocery");
	await page.reload();
	await expect(page.getByRole("heading", { name: "Grocery" })).toBeVisible();
});
