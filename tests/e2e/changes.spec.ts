import { expect, test } from "@playwright/test";
import { iso, open, row } from "./helpers";

test("an extra goes on a day: an ingredient from the list, or anything typed", async ({ page }) => {
	await open(page, "/planner");
	const today = page.getByRole("region").first();
	const dialog = page.getByRole("dialog");
	const field = dialog.getByLabel("Add an extra");
	const addExtra = today.getByRole("button", { name: /^Add an extra on/ });

	// From the list, with an amount, typo forgiven. Extras are on the grocery list unless switched off.
	await addExtra.click();
	await expect(dialog.getByRole("button", { name: "On the grocery list" })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await field.fill("samon 2 fillets");
	await dialog
		.getByRole("list", { name: "Suggestions" })
		.getByRole("button", { name: /^Salmon fillet/ })
		.click();
	await expect(page.getByTestId("toast")).toHaveText("Added to today");

	// Typed, not in the list: Enter adds it as it is.
	await addExtra.click();
	await field.fill("frozen pizza 2 boxes");
	await field.press("Enter");

	// Something you already have: on the plan only.
	await addExtra.click();
	await field.fill("leftover pizza");
	await dialog.getByRole("button", { name: "On the grocery list" }).click();
	await dialog.getByRole("button", { name: "Add", exact: true }).click();
	await expect(today.getByRole("listitem")).toHaveText([
		/Salmon fillet.*2 fillets/,
		/Frozen pizza.*2 boxes/,
		/Leftover pizza.*plan only/,
	]);
	await expect(today.getByRole("listitem").first()).not.toContainText("plan only");
	await expect(page.getByText("3 meals · 14 days")).toBeVisible();

	// The meal picker points here for what is not a recipe.
	await today.getByRole("button", { name: /^Add a meal on/ }).click();
	await dialog.getByRole("button", { name: /Not a recipe\? Add an extra/ }).click();
	await expect(dialog.getByRole("heading", { name: "Extra for today" })).toBeVisible();
	await dialog.getByRole("button", { name: "Close" }).click();

	// On the grocery list they are extras: the salmon in its aisle, the frozen pizza under Other,
	// and both in the Extras list with their day. The leftovers are nowhere.
	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(page.getByRole("region", { name: "Fish" })).toContainText("Salmon fillet");
	await expect(row(page, "Salmon fillet")).toContainText("250 g");
	await expect(row(page, "Salmon fillet")).toContainText("extra");
	await expect(row(page, "Frozen pizza")).toContainText("2 boxes");
	const extras = page.getByRole("list", { name: "Extras" });
	await expect(extras.getByRole("listitem")).toHaveText([
		/Salmon fillet · Today.*2 fillets/,
		/Frozen pizza · Today.*2 boxes/,
	]);
	await expect(page.getByText("Leftover pizza")).toHaveCount(0);

	// In its sheet: how much, and whether it is on the grocery list. It travels with the link.
	await page.reload();
	await page.getByRole("link", { name: "Plan" }).click();
	await today.getByRole("button", { name: /^Salmon fillet/ }).click();
	await expect(dialog.getByRole("list", { name: "Ingredients of this meal" })).toHaveCount(0);
	await expect(dialog.getByLabel("Unit")).toHaveValue("fillet");
	await expect(dialog.getByLabel("Amount")).toHaveValue("2");
	await dialog.getByLabel("Amount").fill("4");
	await dialog.getByRole("button", { name: "Save" }).click();
	await dialog.getByRole("button", { name: "Close" }).click();
	await expect(today.getByRole("listitem").first()).toContainText("4 fillet");
	await today.getByRole("button", { name: /^Frozen pizza/ }).click();
	await dialog.getByRole("button", { name: /On the grocery list/ }).click();
	await dialog.getByLabel("Quantity").fill("1 box");
	await dialog.getByRole("button", { name: "Save" }).click();
	await dialog.getByRole("button", { name: "Close" }).click();
	await expect(today.getByRole("listitem").nth(1)).toHaveText(/Frozen pizza.*1 box · plan only/);
	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(row(page, "Salmon fillet")).toContainText("500 g");
	await expect(page.getByText("Frozen pizza")).toHaveCount(0);

	// Removing a day's extra from the grocery page takes it off the day.
	await page
		.getByRole("list", { name: "Extras" })
		.getByRole("button", { name: "Remove Salmon fillet" })
		.click();
	await expect(row(page, "Salmon fillet")).toHaveCount(0);
	await page.getByRole("link", { name: "Plan" }).click();
	await expect(page.getByText("2 meals · 14 days")).toBeVisible();
});

test("a planned meal changes its ingredients, and the grocery list follows", async ({ page }) => {
	// Beef Stew with Wine and Olives (serves 4): 1 onion, 2 cloves garlic, …, salt to taste. Planned twice: only today's changes.
	await open(page, "/planner", {
		dates: { [iso(0)]: ["beef_stew_wine_olives"], [iso(3)]: ["beef_stew_wine_olives"] },
	});
	const today = page.getByRole("region").first();
	const dialog = page.getByRole("dialog");
	const lines = dialog.getByRole("list", { name: "Ingredients of this meal" });

	// The meal's sheet says what the meal is before anything else: summary, servings, ingredients.
	await today.getByRole("button", { name: "Beef Stew with Wine and Olives", exact: true }).click();
	await expect(dialog.getByText(/Beef braised slowly in red wine/)).toBeVisible();
	await expect(dialog.getByText(/^Today · 140 min · Italian$/)).toBeVisible();
	await expect(lines.getByRole("button", { name: /^Garlic/ })).toContainText("2 cloves");
	await dialog.getByRole("button", { name: "More servings" }).click();
	await expect(lines.getByRole("button", { name: /^Garlic/ })).toContainText("2.5 cloves");
	await dialog.getByRole("button", { name: "Fewer servings" }).click();

	// Swap: onion for red onion. Picking it is enough: back to the list, keeping "1".
	await lines.getByRole("button", { name: /^Onion/ }).click();
	await dialog.getByLabel("Use instead").fill("red on");
	await dialog.getByRole("button", { name: /^Red onion/ }).click();
	await expect(lines.getByRole("button", { name: /^Red onion/ })).toContainText("instead of Onion");
	await expect(lines.getByRole("button", { name: /^Red onion/ })).toContainText(/1$/);

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
	await dialog.getByLabel("Add an ingredient", { exact: true }).fill("lemon");
	await dialog.getByRole("button", { name: /^Lemon/ }).click();
	await dialog.getByLabel("Amount").fill("1");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(lines.getByRole("button", { name: /^Lemon/ })).toContainText("added");

	// A bad amount can't be saved.
	await lines.getByRole("button", { name: /^Stewing beef/ }).click();
	await dialog.getByLabel("Amount").fill("lots");
	await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
	await dialog.getByRole("button", { name: "‹ Ingredients" }).click();
	await expect(dialog.getByText("4 changes")).toBeVisible();
	await dialog.getByRole("button", { name: "Close" }).click();
	await expect(today.getByRole("listitem").first()).toContainText("changed");

	// The recipe, opened from this meal, shows the meal's version; the recipe itself is untouched.
	await today.getByRole("button", { name: /^Beef Stew with Wine and Olives/ }).click();
	await dialog.getByRole("link", { name: /^View recipe/ }).click();
	await expect(page.getByText("As planned for today · with this meal’s changes")).toBeVisible();
	const ingredients = page.getByRole("list", { name: "Ingredients" });
	await expect(ingredients).toContainText("instead of Onion");
	await expect(ingredients).toContainText("6 cloves");
	await expect(ingredients).toContainText("left out");
	await page.getByRole("button", { name: "‹ Back" }).click();
	await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
	await page.getByRole("link", { name: "Recipes", exact: true }).click();
	await page.getByRole("link", { name: /Beef Stew with Wine and Olives/ }).click();
	await expect(page.getByRole("list", { name: "Ingredients" })).toContainText("2 cloves");
	await expect(page.getByText(/As planned for/)).toHaveCount(0);

	// The grocery list: today's meal as changed, the other one as the recipe has it.
	await page.goto(page.url().replace(/#\/recipe\/[^?]*/, "#/grocery"));
	await expect(row(page, "Red onion")).toContainText("100 g");
	await expect(row(page, "Onion")).toContainText("150 g"); // only the unchanged meal's
	await expect(row(page, "Garlic")).toContainText("32 g"); // 6 cloves + 2 cloves
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
		.getByRole("button", { name: /^Beef Stew with Wine and Olives/ })
		.click();
	await lines.getByRole("button", { name: /^Salt/ }).click(); // put back
	await expect(lines.getByRole("button", { name: /^Salt/ })).toContainText("to taste");
	await lines.getByRole("button", { name: /^Red onion/ }).click();
	await dialog.getByRole("button", { name: /Undo change/ }).click();
	await expect(lines.getByRole("button", { name: /^Onion/ })).not.toContainText("instead");
	await lines.getByRole("button", { name: /^Lemon/ }).click();
	await dialog.getByRole("button", { name: "Remove" }).click();
	await expect(lines.getByRole("button", { name: /^Lemon/ })).toHaveCount(0);
	await expect(dialog.getByText("1 change", { exact: true })).toBeVisible();
});

test("a meal's amounts are edited for its servings", async ({ page }) => {
	// Beef Stew with Wine and Olives for 8 (the recipe serves 4): the editor shows 4 cloves, not the recipe's 2.
	await open(page, "/planner", {
		dates: { [iso(0)]: [{ recipe: "beef_stew_wine_olives", servings: 8 }] },
	});
	const dialog = page.getByRole("dialog");
	await page
		.getByRole("region")
		.first()
		.getByRole("button", { name: /^Beef Stew with Wine and Olives/ })
		.click();
	const lines = dialog.getByRole("list", { name: "Ingredients of this meal" });
	await lines.getByRole("button", { name: /^Garlic/ }).click();
	await expect(dialog.getByLabel("Amount")).toHaveValue("4");
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

test("an ingredient that is not in the list is used as typed", async ({ page }) => {
	await open(page, "/planner", {
		dates: { [iso(0)]: [{ recipe: "beef_stew_wine_olives", servings: 8 }] },
	});
	const dialog = page.getByRole("dialog");
	const lines = dialog.getByRole("list", { name: "Ingredients of this meal" });
	const swapIn = dialog.getByLabel("Use instead");
	const addIn = dialog.getByLabel("Add an ingredient", { exact: true });
	const suggestions = dialog.getByRole("list", { name: "Suggestions" });
	await page
		.getByRole("region")
		.first()
		.getByRole("button", { name: /^Beef Stew with Wine and Olives/ })
		.click();

	// Swap the onion for shallots, which the ingredient list doesn't have.
	await lines.getByRole("button", { name: /^Onion/ }).click();
	await swapIn.fill("shallots");
	await expect(suggestions.getByRole("listitem")).toHaveCount(1); // nothing like it in the list
	await dialog.getByRole("button", { name: "Use “Shallots” as typed" }).click();
	await dialog.getByLabel("Quantity").fill("3");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(lines.getByRole("button", { name: /^Shallots/ })).toContainText("instead of Onion");
	await expect(lines.getByRole("button", { name: /^Shallots/ })).toContainText("3");

	// Add bay leaves, with no quantity.
	await dialog.getByRole("button", { name: "+ Add an ingredient" }).click();
	await addIn.fill("bay leaves");
	await dialog.getByRole("button", { name: "Use “Bay leaves” as typed" }).click();
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(lines.getByRole("button", { name: /^Bay leaves/ })).toContainText("added");

	// A name that is in the list is offered from the list, typos forgiven, and not "as typed".
	await dialog.getByRole("button", { name: "+ Add an ingredient" }).click();
	await addIn.fill("lemmon");
	await expect(suggestions.getByRole("button", { name: /^Lemon/ })).toBeVisible();
	await addIn.fill("lemons");
	await expect(suggestions.getByRole("button", { name: /^Lemon/ })).toBeVisible();
	await expect(dialog.getByRole("button", { name: /as typed/ })).toHaveCount(0);
	await dialog.getByRole("button", { name: "‹ Ingredients" }).click();
	await dialog.getByRole("button", { name: "Close" }).click();

	// On the grocery list they are under Other, as typed, for that recipe; the onion is gone.
	await page.getByRole("link", { name: /^Grocery/ }).click();
	const other = page.getByRole("region", { name: "Other" });
	await expect(other).toContainText("Shallots");
	await expect(row(page, "Shallots")).toContainText("3");
	await expect(row(page, "Shallots")).toContainText("Beef Stew with Wine and Olives");
	await expect(other).toContainText("Bay leaves");
	await expect(row(page, "Onion")).toHaveCount(0);

	// It travels with the link, and can be put back.
	await page.reload();
	await expect(row(page, "Shallots")).toBeVisible();
	await page.getByRole("link", { name: "Plan" }).click();
	await page
		.getByRole("region")
		.first()
		.getByRole("button", { name: /^Beef Stew with Wine and Olives/ })
		.click();
	await lines.getByRole("button", { name: /^Shallots/ }).click();
	await dialog.getByRole("button", { name: /Undo change/ }).click();
	await expect(lines.getByRole("button", { name: /^Onion/ })).toContainText("2"); // 1 onion, for 8
	await lines.getByRole("button", { name: /^Bay leaves/ }).click();
	await dialog.getByRole("button", { name: "Remove" }).click();
	await expect(lines.getByRole("button", { name: /^Bay leaves/ })).toHaveCount(0);
});

test("the grocery extras suggest ingredients as you type, typos forgiven", async ({ page }) => {
	await open(page, "/grocery");
	const field = page.getByLabel("Add an extra");
	const suggestions = page.getByRole("list", { name: "Suggestions" });
	await field.fill("mlik 1 l");
	await expect(suggestions.getByRole("button").first()).toContainText("Milk");
	await field.fill("brocoli");
	await expect(suggestions.getByRole("button")).toHaveText([/Broccoli/, /Turnip greens/]); // "broccoli rabe"
	await field.fill("oil");
	await expect(suggestions.getByRole("button")).toHaveText([
		/Olive oil/,
		/Sesame oil/,
		/Vegetable oil/,
	]);
	await field.fill("2 courgetes");
	await suggestions.getByRole("button", { name: /^Zucchini/ }).click();
	await expect(row(page, "Zucchini")).toContainText("400 g");
});

test("a swap carries the quantity over when the unit doesn't fit", async ({ page }) => {
	// Chicken Thighs with Bacon and Mustard: 8 thighs (120 g each). Chicken breast is sold by weight.
	await open(page, "/planner", { dates: { [iso(0)]: ["chicken_thighs_bacon_mustard"] } });
	const dialog = page.getByRole("dialog");
	const lines = dialog.getByRole("list", { name: "Ingredients of this meal" });
	await page
		.getByRole("region")
		.first()
		.getByRole("button", { name: /^Chicken Thighs/ })
		.click();
	await lines.getByRole("button", { name: /^Chicken thighs/ }).click();

	// What the meal already has is shown, not hidden.
	await dialog.getByLabel("Use instead").fill("garl");
	await expect(dialog.getByRole("button", { name: /^Garlic/ })).toBeDisabled();
	await expect(dialog.getByRole("button", { name: /^Garlic/ })).toContainText("in this meal");

	await dialog.getByLabel("Use instead").fill("chicken br");
	await dialog.getByRole("button", { name: /^Chicken breast/ }).click();
	await expect(lines.getByRole("button", { name: /^Chicken breast/ })).toContainText("960 g");
	await dialog.getByRole("button", { name: "Close" }).click();
	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(row(page, "Chicken breast")).toContainText("960 g");
	await expect(row(page, "Chicken thighs")).toHaveCount(0);
});

test("an amount that doesn't add up is listed beside the total", async ({ page }) => {
	// Two meals with mozzarella (sold by weight): one as the recipe has it, 250 g; one changed to 1 piece.
	await open(page, "/planner", {
		dates: {
			[iso(0)]: ["pasta_cherry_tomatoes_mozzarella"],
			[iso(1)]: ["pasta_cherry_tomatoes_mozzarella"],
		},
	});
	const dialog = page.getByRole("dialog");
	const lines = dialog.getByRole("list", { name: "Ingredients of this meal" });
	await page
		.getByRole("region")
		.first()
		.getByRole("button", { name: /^Pasta with Cherry Tomatoes/ })
		.click();
	await lines.getByRole("button", { name: /^Mozzarella/ }).click();
	await dialog.getByLabel("Amount").fill("1");
	await dialog.getByLabel("Unit").selectOption("pcs");
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(lines.getByRole("button", { name: /^Mozzarella/ })).toContainText(/changed.*1$/);
	await dialog.getByRole("button", { name: "Close" }).click();

	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(row(page, "Mozzarella")).toContainText("250 g + 1");
	await page.getByRole("button", { name: "Today", exact: true }).click();
	await expect(row(page, "Mozzarella")).toContainText("1");
	await expect(row(page, "Mozzarella")).not.toContainText("250 g");
});
