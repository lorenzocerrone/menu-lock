import { expect, test } from "@playwright/test";
import { iso, open, planParam } from "./helpers";

test("the three tabs navigate with hash routes", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "menu.lock" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
	// The bundled data loaded and passed validation in the browser.
	await expect(page.getByText("25 of 25")).toBeVisible();

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
	await page.getByRole("link", { name: /Lentil Dal/ }).click();
	await expect(page).toHaveURL(new RegExp(`#/recipe/lentil_dal\\?plan=${param}$`));
});

test("a deep link survives a reload", async ({ page }) => {
	await page.goto("/#/grocery");
	await page.reload();
	await expect(page.getByRole("heading", { name: "Grocery" })).toBeVisible();
});
