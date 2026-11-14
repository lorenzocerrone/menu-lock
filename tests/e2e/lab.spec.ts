import { expect, test } from "@playwright/test";

// The reference screens of the chosen design. Remove with src/lab/.
test("the lab shows the chosen design on the real recipes", async ({ page }) => {
	await page.goto("/#/lab");
	await expect(page.getByRole("heading", { name: "Lentil Dal" })).toBeVisible();

	await page.getByRole("button", { name: "vegetarian" }).click();
	await expect(page.getByRole("heading", { name: "Spaghetti Carbonara" })).toHaveCount(0);

	await page.getByRole("button", { name: "Plan", exact: true }).click();
	await expect(page).toHaveURL(/s=planner/);
	await expect(page.getByText("Teriyaki Salmon")).toBeVisible();
	await expect(page.getByText("Tomorrow")).toBeVisible();
});

test("ticking a grocery line stamps it and counts down what is left", async ({ page }) => {
	await page.goto("/#/lab?s=grocery");
	const basil = page.getByRole("button", { name: /Basil/ });
	await expect(basil).toHaveAttribute("aria-pressed", "false");
	const left = page.getByText(/^\d+ \/ \d+$/);
	const before = await left.textContent();
	await basil.click();
	await expect(basil).toHaveAttribute("aria-pressed", "true");
	await expect(left).not.toHaveText(before ?? "");
});
