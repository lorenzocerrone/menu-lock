import { expect, test } from "@playwright/test";
import { iso, open, planParam, row } from "./helpers";

// The store is the plan: going back or forward never brings back an older one.

test("Back after adding a meal keeps it", async ({ page }) => {
	await open(page, "/planner", { dates: { [iso(1)]: ["carbonara"] } });
	await page.getByRole("link", { name: "Recipes" }).click();
	await page.getByRole("link", { name: /Saffron Risotto/ }).click();
	await page.getByRole("button", { name: "Add to week" }).click();
	await page.getByRole("button", { name: /^Tomorrow/ }).click();
	await expect(page.getByTestId("toast")).toHaveText("Added to tomorrow");
	await page.getByRole("button", { name: "‹ Back" }).click(); // to the recipes
	await page.goBack(); // to the plan, as it was before the risotto
	await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
	await expect(page.getByText("2 meals · 14 days")).toBeVisible();
	await page.goForward();
	await page.getByRole("link", { name: "Plan" }).click();
	await expect(page.getByText("2 meals · 14 days")).toBeVisible();
	await page.reload();
	await expect(page.getByText("2 meals · 14 days")).toBeVisible();
});

test("Back after changing a meal's ingredient keeps the change on the grocery list", async ({
	page,
}) => {
	await open(page, "/planner", { dates: { [iso(0)]: ["beef_stew_wine_olives"] } });
	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(row(page, "Salt")).toBeVisible();
	await page.getByRole("link", { name: "Plan" }).click();

	const dialog = page.getByRole("dialog");
	const lines = dialog.getByRole("list", { name: "Ingredients of this meal" });
	await page
		.getByRole("region")
		.first()
		.getByRole("button", { name: /^Beef Stew/ })
		.click();
	await lines.getByRole("button", { name: /^Salt/ }).click();
	await dialog.getByRole("button", { name: "Leave out" }).click();
	await dialog.getByRole("button", { name: "Close" }).click();

	await page.goBack(); // the phone's back gesture, to the grocery page from before
	await expect(page.getByRole("heading", { name: "Grocery" })).toBeVisible();
	await expect(row(page, "Onion")).toBeVisible();
	await expect(row(page, "Salt")).toHaveCount(0);
});

test("a link pasted into an open tab loads its plan", async ({ page }) => {
	await open(page, "/planner", { dates: { [iso(1)]: ["carbonara"] } });
	await expect(page.getByText("1 meal · 14 days")).toBeVisible();
	const other = planParam({ dates: { [iso(2)]: ["tiramisu", "lasagna"] } });
	await page.evaluate((plan) => {
		window.location.hash = `#/planner?plan=${plan}`;
	}, other);
	await expect(page.getByText("2 meals · 14 days")).toBeVisible();
	await expect(page.getByRole("button", { name: "Tiramisù", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Lasagna", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Spaghetti Carbonara", exact: true })).toHaveCount(
		0,
	);
	await page.reload();
	await expect(page.getByText("2 meals · 14 days")).toBeVisible();
});
