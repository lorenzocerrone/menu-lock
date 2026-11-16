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

test("a link typed into a tab that is already open loads its plan", async ({ page }) => {
	await open(page, "/", { dates: { [iso(1)]: ["carbonara"] } });
	await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
	// page.goto in the same tab carries the router's history state, as a typed address can.
	await open(page, "/planner", { dates: { [iso(2)]: ["tiramisu"] } });
	await expect(page.getByText("1 meal · 14 days")).toBeVisible();
	await expect(page.getByRole("button", { name: "Tiramisù", exact: true })).toBeVisible();
});

test("a link whose days have all passed keeps the plan on this device", async ({ page }) => {
	await open(page, "/planner", { dates: { [iso(1)]: ["carbonara"] } });
	await expect(page.getByText("1 meal · 14 days")).toBeVisible();
	await page.evaluate(
		(plan) => {
			window.location.hash = `#/planner?plan=${plan}`;
		},
		planParam({
			dates: { [iso(-3)]: ["lasagna"] },
			extras: [{ name: "Bin bags", quantity: null }],
		}),
	);
	await expect(page.getByTestId("toast")).toHaveText("That plan's days have passed");
	await expect(
		page.getByRole("button", { name: "Spaghetti Carbonara", exact: true }),
	).toBeVisible();

	// Opened cold, the same.
	await page.goto(`/#/planner?plan=${planParam({ dates: { [iso(-3)]: ["lasagna"] } })}`);
	await page.reload();
	await expect(
		page.getByRole("button", { name: "Spaghetti Carbonara", exact: true }),
	).toBeVisible();
});

test("a date far in the future can't hang the planner", async ({ page }) => {
	await open(page, "/planner", { dates: { "9999-12-31": ["carbonara"], [iso(1)]: ["lasagna"] } });
	await expect(page.getByText("1 meal · 14 days")).toBeVisible();
	await expect(page.getByRole("button", { name: "Lasagna", exact: true })).toBeVisible();
});
