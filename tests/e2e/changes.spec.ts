import { expect, test } from "@playwright/test";
import { iso, open, row } from "./helpers";

test("something that is not a recipe goes on a day, to buy or not", async ({ page }) => {
	await open(page, "/planner");
	const today = page.getByRole("region").first();
	const dialog = page.getByRole("dialog");

	await today.getByRole("button", { name: /Add a meal/ }).click();
	await expect(dialog.getByText("Not a recipe? Type it")).toBeVisible();
	await dialog.getByLabel("Search recipes").fill("frozen pizza");
	await expect(dialog.getByText("0 recipes resolved.")).toBeVisible();
	await dialog.getByRole("button", { name: "Add “Frozen pizza” and buy it" }).click();
	await expect(page.getByTestId("toast")).toHaveText("Added to today");

	await today.getByRole("button", { name: /Add a meal/ }).click();
	await dialog.getByLabel("Search recipes").fill("leftovers");
	await dialog.getByRole("button", { name: "Add “Leftovers” plan only" }).click();
	await expect(today.getByRole("listitem")).toHaveText([/Frozen pizza.*to buy/, /^Leftovers/]);
	await expect(page.getByText("2 meals · 14 days")).toBeVisible();

	// Only the one to buy is on the grocery list, under Other.
	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(page.getByRole("region", { name: "Other" })).toContainText("Frozen pizza");
	await expect(row(page, "Frozen pizza")).toContainText("plan");
	await expect(page.getByText("Leftovers")).toHaveCount(0);

	// It travels with the link, and can be taken off the grocery list from its sheet.
	await page.reload();
	await expect(row(page, "Frozen pizza")).toBeVisible();
	await page.getByRole("link", { name: "Plan" }).click();
	await today.getByRole("button", { name: /^Frozen pizza/ }).click();
	await expect(dialog.getByRole("list", { name: "Ingredients of this meal" })).toHaveCount(0);
	await dialog.getByRole("button", { name: /Also on the grocery list/ }).click();
	await dialog.getByRole("button", { name: "Close" }).click();
	await expect(today.getByRole("listitem").first()).not.toContainText("to buy");
	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(page.getByText("0 to buy. Suspicious.")).toBeVisible();
});

test("a planned meal changes its ingredients, and the grocery list follows", async ({ page }) => {
	// Lentil Dal (serves 4): 1 onion, 3 cloves garlic, …, salt to taste. Planned twice: only today's changes.
	await open(page, "/planner", { dates: { [iso(0)]: ["lentil_dal"], [iso(3)]: ["lentil_dal"] } });
	const today = page.getByRole("region").first();
	const dialog = page.getByRole("dialog");
	const lines = dialog.getByRole("list", { name: "Ingredients of this meal" });

	// The meal's sheet says what the meal is before anything else: summary, servings, ingredients.
	await today.getByRole("button", { name: "Lentil Dal", exact: true }).click();
	await expect(dialog.getByText(/Creamy spiced red lentils/)).toBeVisible();
	await expect(dialog.getByText(/^Today · 40 min · Indian$/)).toBeVisible();
	await expect(lines.getByRole("button", { name: /^Garlic/ })).toContainText("3 cloves");
	await dialog.getByRole("button", { name: "More servings" }).click();
	await expect(lines.getByRole("button", { name: /^Garlic/ })).toContainText("3.75 cloves");
	await dialog.getByRole("button", { name: "Fewer servings" }).click();

	// Swap: onion for red onion, keeping "1".
	await lines.getByRole("button", { name: /^Onion/ }).click();
	await dialog.getByRole("button", { name: /Swap for another ingredient/ }).click();
	await dialog.getByLabel("Search ingredients").fill("red on");
	await dialog.getByRole("button", { name: /^Red onion/ }).click();
	await expect(dialog.getByLabel("Amount")).toHaveValue("1");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(lines.getByRole("button", { name: /^Red onion/ })).toContainText("instead of Onion");

	// More garlic.
	await lines.getByRole("button", { name: /^Garlic/ }).click();
	await expect(dialog.getByLabel("Unit")).toHaveValue("clove");
	await dialog.getByLabel("Amount").fill("6");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(lines.getByRole("button", { name: /^Garlic/ })).toContainText("changed");
	await expect(lines.getByRole("button", { name: /^Garlic/ })).toContainText("6 cloves");

	// Leave the salt out; add a lemon.
	await lines.getByRole("button", { name: /^Salt/ }).click();
	await dialog.getByRole("button", { name: "Leave out" }).click();
	await expect(lines.getByRole("button", { name: /^Salt/ })).toContainText("left out");
	await dialog.getByRole("button", { name: "+ Add an ingredient" }).click();
	await dialog.getByLabel("Search ingredients").fill("lemon");
	await dialog.getByRole("button", { name: /^Lemon/ }).click();
	await dialog.getByLabel("Amount").fill("1");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(lines.getByRole("button", { name: /^Lemon/ })).toContainText("added");

	// A bad amount can't be saved.
	await lines.getByRole("button", { name: /^Lentils/ }).click();
	await dialog.getByLabel("Amount").fill("lots");
	await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
	await dialog.getByRole("button", { name: "‹ Lentil Dal" }).click();
	await expect(dialog.getByText("4 changes")).toBeVisible();
	await dialog.getByRole("button", { name: "Close" }).click();
	await expect(today.getByRole("listitem").first()).toContainText("changed");

	// The recipe, opened from this meal, shows the meal's version; the recipe itself is untouched.
	await today.getByRole("button", { name: /^Lentil Dal/ }).click();
	await dialog.getByRole("link", { name: /^View recipe/ }).click();
	await expect(page.getByText("As planned for today · with this meal’s changes")).toBeVisible();
	const ingredients = page.getByRole("list", { name: "Ingredients" });
	await expect(ingredients).toContainText("instead of Onion");
	await expect(ingredients).toContainText("6 cloves");
	await expect(ingredients).toContainText("left out");
	await page.getByRole("button", { name: "‹ Back" }).click();
	await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
	await page.getByRole("link", { name: "Recipes", exact: true }).click();
	await page.getByRole("link", { name: /Lentil Dal/ }).click();
	await expect(page.getByRole("list", { name: "Ingredients" })).toContainText("3 cloves");
	await expect(page.getByText(/As planned for/)).toHaveCount(0);

	// The grocery list: today's meal as changed, the other one as the recipe has it.
	await page.goto(page.url().replace(/#\/recipe\/[^?]*/, "#/grocery"));
	await expect(row(page, "Red onion")).toContainText("100 g");
	await expect(row(page, "Onion")).toContainText("150 g"); // only the unchanged meal's
	await expect(row(page, "Garlic")).toContainText("36 g"); // 6 cloves + 3 cloves
	await expect(row(page, "Lemon")).toContainText("1");
	await page.getByRole("button", { name: "Today", exact: true }).click();
	await expect(row(page, "Onion")).toHaveCount(0);
	await expect(row(page, "Salt")).toHaveCount(0);
	await expect(row(page, "Garlic")).toContainText("24 g");

	// The changes travel with the link, and each can be undone.
	await page.reload();
	await expect(row(page, "Red onion")).toBeVisible();
	await page.getByRole("link", { name: "Plan" }).click();
	await page
		.getByRole("region")
		.first()
		.getByRole("button", { name: /^Lentil Dal/ })
		.click();
	await lines.getByRole("button", { name: /^Salt/ }).click(); // put back
	await expect(lines.getByRole("button", { name: /^Salt/ })).toContainText("to taste");
	await lines.getByRole("button", { name: /^Red onion/ }).click();
	await dialog.getByRole("button", { name: /Back to the recipe/ }).click();
	await expect(lines.getByRole("button", { name: /^Onion/ })).not.toContainText("instead");
	await lines.getByRole("button", { name: /^Lemon/ }).click();
	await dialog.getByRole("button", { name: "Remove" }).click();
	await expect(lines.getByRole("button", { name: /^Lemon/ })).toHaveCount(0);
	await expect(dialog.getByText("1 change", { exact: true })).toBeVisible();
});

test("a meal's amounts are edited for its servings", async ({ page }) => {
	// Lentil Dal for 8 (the recipe serves 4): the editor shows 6 cloves, not the recipe's 3.
	await open(page, "/planner", { dates: { [iso(0)]: [{ recipe: "lentil_dal", servings: 8 }] } });
	const dialog = page.getByRole("dialog");
	await page
		.getByRole("region")
		.first()
		.getByRole("button", { name: /^Lentil Dal/ })
		.click();
	const lines = dialog.getByRole("list", { name: "Ingredients of this meal" });
	await lines.getByRole("button", { name: /^Garlic/ }).click();
	await expect(dialog.getByLabel("Amount")).toHaveValue("6");
	// Saving without touching anything changes nothing.
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(lines.getByRole("button", { name: /^Garlic/ })).not.toContainText("changed");
	await lines.getByRole("button", { name: /^Garlic/ }).click();
	await dialog.getByLabel("Amount").fill("8");
	await dialog.getByRole("button", { name: "Save" }).click();
	await page.getByRole("button", { name: "Close" }).click();
	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(row(page, "Garlic")).toContainText("32 g"); // 8 cloves for this meal
});
