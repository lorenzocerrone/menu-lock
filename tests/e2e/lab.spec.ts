import { expect, test } from "@playwright/test";

// Phase 1 design lab. Remove with src/lab/.
test("the lab shows three directions on the real recipes", async ({ page }) => {
	await page.goto("/#/lab");
	for (const name of ["A · Notebook", "B · Receipt", "C · Lockfile"])
		await expect(page.getByRole("button", { name })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Lentil Dal" })).toBeVisible();

	await page.getByRole("button", { name: "vegetarian" }).click();
	await expect(page.getByRole("heading", { name: "Spaghetti Carbonara" })).toHaveCount(0);

	await page.getByRole("button", { name: "B · Receipt" }).click();
	await expect(page).toHaveURL(/d=receipt/);
	await page.getByRole("button", { name: /^Plan/ }).click();
	await expect(page.getByText("Teriyaki Salmon")).toBeVisible();
});

test("ticking a grocery line in the lab counts down what is left", async ({ page }) => {
	await page.goto("/#/lab?d=notebook&s=grocery");
	const basil = page.getByRole("button", { name: /^Basil/ });
	await expect(basil).toHaveAttribute("aria-pressed", "false");
	const before = await page.getByText(/\d+ of \d+ left to buy/).textContent();
	await basil.click();
	await expect(basil).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByText(/\d+ of \d+ left to buy/)).not.toHaveText(before ?? "");
});
