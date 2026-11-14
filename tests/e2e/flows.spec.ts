import { expect, test } from "@playwright/test";
import { iso, open, planParam, row } from "./helpers";

// The core flows of REWRITE_PLAN §8, phase 3.

test("1. recipe filters live in the address and survive a reload and a visit to a recipe", async ({
	page,
}) => {
	await open(page, "/");
	await expect(page.getByText("25 of 25")).toBeVisible();

	await page.getByRole("button", { name: "Filters" }).click();
	await page.getByRole("button", { name: /^vegetarian \d+$/ }).click();
	await page.getByRole("button", { name: /^≤20 min \d+$/ }).click();
	await page.getByRole("button", { name: "Show 10 recipes" }).click();

	await expect(page).toHaveURL(/diet=veg/);
	await expect(page).toHaveURL(/time=20/);
	await expect(page.getByText("10 of 25")).toBeVisible();
	await expect(page.getByRole("button", { name: "Filters · 2" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Spaghetti Carbonara" })).toHaveCount(0);

	await page.reload();
	await expect(page.getByText("10 of 25")).toBeVisible();
	await expect(page.getByRole("button", { name: "Remove filter vegetarian" })).toBeVisible();

	await page.getByRole("link", { name: /Greek Salad/ }).click();
	await expect(page.getByRole("heading", { name: "Greek Salad" })).toBeVisible();
	await page.getByRole("button", { name: "‹ Back" }).click();
	await expect(page.getByText("10 of 25")).toBeVisible();

	await page.getByRole("button", { name: "Remove filter vegetarian" }).click();
	await expect(page).not.toHaveURL(/diet=/);
	await page.getByLabel("Search recipes").fill("greek salad"); // 15 minutes, so within the ≤20 min filter
	await expect(page.getByText("1 of 25")).toBeVisible();
	await expect(page).toHaveURL(/q=greek/);
});

test("2. a recipe rescales with its servings and is added to the week", async ({ page }) => {
	await open(page, "/recipe/lentil_dal");
	await expect(page.getByRole("heading", { name: "Lentil Dal" })).toBeVisible();
	await expect(page.getByRole("navigation", { name: "Sections" })).toBeHidden();
	const ingredients = page.getByRole("list", { name: "Ingredients" });
	const garlic = ingredients.getByRole("listitem").filter({ hasText: "Garlic" });
	const salt = ingredients.getByRole("listitem").filter({ hasText: /^Salt/ });
	await expect(garlic).toContainText("3 cloves");
	await expect(salt).toContainText("to taste");

	await page.getByRole("button", { name: "More servings" }).click();
	await page.getByRole("button", { name: "More servings" }).click();
	await expect(garlic).toContainText("4.5 cloves");
	await expect(salt).toContainText("to taste");
	await page.getByRole("button", { name: "Fewer servings" }).click();
	await expect(garlic).toContainText("3.75 cloves");

	const step = page.getByRole("button", { name: /Serve over rice/ });
	await step.click();
	await expect(step).toHaveAttribute("aria-pressed", "true");

	await page.getByRole("button", { name: "Add to week" }).click();
	await page.getByRole("button", { name: /^Tomorrow/ }).click();
	await expect(page.getByTestId("toast")).toHaveText("Added to tomorrow");
	await expect(page).toHaveURL(/plan=/);

	await page.getByRole("button", { name: "Add to week" }).click();
	await expect(page.getByRole("button", { name: "Tomorrow 1 meal" })).toBeVisible();
});

test("an unknown recipe has a friendly way back", async ({ page }) => {
	await open(page, "/recipe/no_such_dish");
	await expect(page.getByRole("heading", { name: "No such recipe" })).toBeVisible();
	await page.getByRole("link", { name: "‹ All recipes" }).click();
	await expect(page.getByText("25 of 25")).toBeVisible();
});

test("3. the planner adds a meal, changes servings, moves, reorders and removes", async ({
	page,
}) => {
	await open(page, "/planner");
	const today = page.getByRole("region", { name: /./ }).first();
	await expect(today).toContainText("Nothing pinned yet");
	await expect(page.getByRole("button", { name: "Clear plan" })).toBeDisabled();

	// Add two meals to today through the picker, using its search and its filters.
	await today.getByRole("button", { name: /Add a meal/ }).click();
	await page.getByRole("dialog").getByLabel("Search recipes").fill("carbonara");
	await page
		.getByRole("dialog")
		.getByRole("button", { name: /Spaghetti Carbonara/ })
		.click();
	await expect(page.getByTestId("toast")).toHaveText("Added to today");
	await today.getByRole("button", { name: /Add a meal/ }).click();
	await page.getByRole("dialog").getByRole("button", { name: "Filters" }).click();
	await page
		.getByRole("dialog")
		.getByRole("button", { name: /^Greek \d+$/ })
		.click();
	await page
		.getByRole("dialog")
		.getByRole("button", { name: /Greek Salad/ })
		.click();
	await expect(today.getByRole("listitem")).toHaveText([/Spaghetti Carbonara/, /Greek Salad/]);
	await expect(page.getByText("2 meals · 14 days")).toBeVisible();

	// Servings: shown on the meal only when they differ from the recipe's own.
	await today.getByRole("button", { name: "Spaghetti Carbonara", exact: true }).click();
	await page.getByRole("button", { name: "More servings" }).click();
	await page.getByRole("button", { name: "Close" }).click();
	await expect(today.getByRole("listitem").first()).toContainText("serves 3");

	// Reorder within the day.
	await today.getByRole("button", { name: /^Spaghetti Carbonara/ }).click();
	await expect(page.getByRole("button", { name: /^Move up/ })).toBeDisabled();
	await page.getByRole("button", { name: /^Move down/ }).click();
	await expect(page.getByRole("button", { name: /^Move down/ })).toBeDisabled();
	await page.getByRole("button", { name: "Close" }).click();
	await expect(today.getByRole("listitem")).toHaveText([/Greek Salad/, /Spaghetti Carbonara/]);

	// Move to another day: its own day is not offered.
	await today.getByRole("button", { name: /^Spaghetti Carbonara/ }).click();
	await page.getByRole("button", { name: /^Move to…/ }).click();
	await expect(page.getByRole("dialog").getByRole("button", { name: /^Today/ })).toHaveCount(0);
	await page
		.getByRole("dialog")
		.getByRole("button", { name: /^Tomorrow/ })
		.click();
	await expect(page.getByTestId("toast")).toHaveText("Moved to tomorrow");
	const tomorrow = page.getByRole("region").nth(1);
	await expect(tomorrow).toContainText("Tomorrow");
	await expect(tomorrow.getByRole("listitem")).toHaveText([/Spaghetti Carbonara.*serves 3/]);

	// View recipe, come back, remove.
	await tomorrow.getByRole("button", { name: /^Spaghetti Carbonara/ }).click();
	await page.getByRole("link", { name: /^View recipe/ }).click();
	await expect(page.getByRole("heading", { name: "Spaghetti Carbonara" })).toBeVisible();
	await page.getByRole("button", { name: "‹ Back" }).click();
	await page
		.getByRole("region")
		.nth(1)
		.getByRole("button", { name: /^Spaghetti Carbonara/ })
		.click();
	await page.getByRole("button", { name: "Remove" }).click();
	await expect(page.getByText("1 meal · 14 days")).toBeVisible();

	// An empty day is one row that opens the picker.
	await page
		.getByRole("button", { name: /^Add a meal on/ })
		.nth(2)
		.click();
	await page
		.getByRole("dialog")
		.getByRole("button", { name: /Lentil Dal/ })
		.click();
	await expect(page.getByText("2 meals · 14 days")).toBeVisible();
});

test("the planner clears meals only or everything", async ({ page }) => {
	const plan = { dates: { [iso(0)]: ["carbonara"] }, extras: [{ name: "Soap", quantity: null }] };
	await open(page, "/planner", plan);
	await page.getByRole("button", { name: "Clear plan" }).click();
	await page.getByRole("button", { name: /^Meals only/ }).click();
	await expect(page.getByText("0 meals · 14 days")).toBeVisible();
	await expect(page.getByRole("button", { name: "Clear plan" })).toBeEnabled(); // the extra is still there
	await page.getByRole("button", { name: "Clear plan" }).click();
	await page.getByRole("button", { name: "Everything" }).click();
	await expect(page.getByRole("button", { name: "Clear plan" })).toBeDisabled();
	await expect(page).not.toHaveURL(/plan=/);
});

test("a meal is dragged to another day", async ({ page, isMobile }) => {
	test.skip(isMobile, "dragging with a mouse");
	await open(page, "/planner", { dates: { [iso(0)]: ["carbonara", "greek_salad"] } });
	const handle = page.getByRole("button", { name: "Move Spaghetti Carbonara" });
	const target = page.getByRole("button", { name: /^Add a meal on/ }).nth(2); // the first empty day's row
	const from = await handle.boundingBox();
	const to = await target.boundingBox();
	if (!from || !to) throw new Error("nothing to drag");
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(from.x + from.width / 2, from.y + 20, { steps: 5 });
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
	await page.mouse.up();
	await expect(page.getByTestId("toast")).toContainText("Moved to");
	await expect(page.getByRole("region").first().getByRole("listitem")).toHaveText([/Greek Salad/]);
	await expect(page.getByRole("region").nth(1).getByRole("listitem")).toHaveText([
		/Spaghetti Carbonara/,
	]);
});

test("a meal is reordered with the keyboard", async ({ page, isMobile }) => {
	test.skip(isMobile, "needs a keyboard");
	await open(page, "/planner", { dates: { [iso(0)]: ["carbonara", "greek_salad"] } });
	await page.getByRole("button", { name: "Move Spaghetti Carbonara" }).focus();
	// dnd-kit measures between key presses, so give it a frame each time.
	await page.keyboard.press("Space");
	await page.waitForTimeout(150);
	await page.keyboard.press("ArrowDown");
	await page.waitForTimeout(150);
	await page.keyboard.press("Space");
	await expect(page.getByRole("region").first().getByRole("listitem")).toHaveText([
		/Greek Salad/,
		/Spaghetti Carbonara/,
	]);
});

test("4. the grocery list sums in shopping units", async ({ page }) => {
	// Lentil Dal (serves 4): 1 onion, 3 cloves garlic, 1 tbsp olive oil, ½ can coconut milk, 300 g lentils…
	await open(page, "/grocery", {
		dates: { [iso(0)]: ["lentil_dal"] },
		extras: [
			{ name: "onion", amount: 100, unit: "g" },
			{ name: "olive_oil", amount: 1, unit: "tbsp" },
			{ name: "chopped_tomatoes", amount: 400, unit: "g" },
			{ name: "Toilet paper", quantity: "1 pack" },
		],
	});
	await expect(row(page, "Onion")).toContainText("250 g"); // 1 onion (150 g) + 100 g
	await expect(row(page, "Onion")).toContainText("Lentil Dal, extra");
	await expect(row(page, "Garlic")).toContainText("12 g"); // 3 cloves
	await expect(row(page, "Olive oil")).toContainText("30 ml"); // 1 tbsp + 1 tbsp
	await expect(row(page, "Chopped tomatoes")).toContainText("1 can"); // 400 g
	await expect(row(page, "Coconut milk")).toContainText("200 ml"); // ½ can
	await expect(row(page, "Salt")).toContainText("to taste");
	await expect(row(page, "Toilet paper")).toContainText("1 pack");
	await expect(page.getByRole("region", { name: "Other" })).toContainText("Toilet paper");
	await expect(page.getByText("resolved from 1 meal")).toBeVisible();

	// Twice the servings: twice the recipe's part, the extras unchanged.
	await open(page, "/grocery", {
		dates: { [iso(0)]: [{ recipe: "lentil_dal", servings: 8 }] },
		extras: [{ name: "onion", amount: 100, unit: "g" }],
	});
	await page.reload();
	await expect(row(page, "Onion")).toContainText("400 g");
	await expect(row(page, "Lentils")).toContainText("600 g");
});

test("the grocery range limits the meals, and the tab shows what is left", async ({ page }) => {
	await open(page, "/grocery", { dates: { [iso(0)]: ["pancakes"], [iso(5)]: ["lentil_dal"] } });
	await expect(page.getByText("resolved from 2 meals")).toBeVisible();
	await expect(row(page, "Lentils")).toBeVisible();
	await page.getByRole("button", { name: "Today", exact: true }).click();
	await expect(page.getByText("resolved from 1 meal")).toBeVisible();
	await expect(row(page, "Lentils")).toHaveCount(0);
	const summary = await page.getByText(/^\d+ of \d+ left to buy · Today · 1 meal$/).textContent();
	const left = summary?.split(" ")[0];
	await expect(page.getByRole("link", { name: `Grocery ${left}` })).toBeVisible();
	await page.reload(); // the range is this device's, and remembered
	await expect(page.getByRole("button", { name: "Today", exact: true })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
});

test("5. a tick survives a reload, and drops when the plan needs more", async ({ page }) => {
	await open(page, "/grocery", { dates: { [iso(0)]: ["lentil_dal"] } });
	await row(page, "Onion").click();
	await row(page, "Lentils").click();
	await expect(row(page, "Onion")).toHaveAttribute("aria-pressed", "true");
	// Ticked lines sink to the bottom of their aisle.
	await expect(
		page.getByRole("region", { name: "Produce" }).getByRole("listitem").last(),
	).toContainText("Onion");

	await page.reload();
	await expect(row(page, "Onion")).toHaveAttribute("aria-pressed", "true");
	await expect(row(page, "Lentils")).toHaveAttribute("aria-pressed", "true");

	// More onion is needed now; the lentils are unchanged.
	await page.getByLabel("Add an extra").fill("onion 100 g");
	await page
		.getByRole("list", { name: "Suggestions" })
		.getByRole("button", { name: /^Onion/ })
		.click();
	await expect(row(page, "Onion")).toContainText("250 g");
	await expect(row(page, "Onion")).toHaveAttribute("aria-pressed", "false");
	await expect(row(page, "Lentils")).toHaveAttribute("aria-pressed", "true");
});

test("extras: a dictionary pick converts, anything else is kept as typed", async ({ page }) => {
	await open(page, "/grocery");
	await expect(page.getByText("0 to buy. Suspicious.")).toBeVisible();
	const field = page.getByLabel("Add an extra");

	await field.fill("milk 1 l");
	await page
		.getByRole("list", { name: "Suggestions" })
		.getByRole("button", { name: /^Milk/ })
		.click();
	await expect(row(page, "Milk")).toContainText("1 l");
	await expect(row(page, "Milk")).toContainText("extra");

	await field.fill("2 eggs");
	await page
		.getByRole("list", { name: "Suggestions" })
		.getByRole("button", { name: /^Egg Dairy/ })
		.click();
	await expect(row(page, "Egg")).toContainText("2");

	// Flour is sold by weight: "1 bag" can't be added up, so it stays as typed, on the flour line's name.
	await field.fill("flour 1 bag");
	await page
		.getByRole("list", { name: "Suggestions" })
		.getByRole("button", { name: /^Flour/ })
		.click();
	await expect(row(page, "Flour")).toContainText("1 bag");

	await field.fill("toilet paper 1 pack");
	await field.press("Enter");
	await expect(page.getByRole("region", { name: "Other" })).toContainText("Toilet paper");

	const extras = page.getByRole("list", { name: "Extras" });
	await expect(extras.getByRole("listitem")).toHaveText([
		/Milk.*1 l/,
		/Egg.*2/,
		/Flour.*1 bag/,
		/Toilet paper.*1 pack/,
	]);
	await extras.getByRole("button", { name: "Remove Milk" }).click();
	await expect(row(page, "Milk")).toHaveCount(0);
	await expect(page).toHaveURL(/plan=/);
});

test("6. a shared link opens the same plan in a fresh browser", async ({
	page,
	browser,
	context,
}) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await open(page, "/recipe/carbonara");
	await page.getByRole("button", { name: "Add to week" }).click();
	await page.getByRole("button", { name: /^Tomorrow/ }).click();
	await page.getByRole("link", { name: "‹ Recipes" }).click();
	await page.getByRole("link", { name: "Plan" }).click();
	await page.getByRole("button", { name: "Share" }).click();
	await expect(page.getByTestId("toast")).toHaveText("Link copied");
	const link = await page.evaluate(() => navigator.clipboard.readText());
	expect(link).toContain("#/planner?plan=");

	const other = await browser.newContext();
	const fresh = await other.newPage();
	await fresh.goto(link);
	await expect(fresh.getByRole("region").nth(1).getByRole("listitem")).toHaveText([
		/Spaghetti Carbonara/,
	]);
	await fresh.getByRole("link", { name: /^Grocery/ }).click();
	await expect(row(fresh, "Spaghetti")).toBeVisible();
	await other.close();
});

test("the last plan comes back when the app is opened without one", async ({ page }) => {
	await open(page, "/planner", { dates: { [iso(1)]: ["carbonara"] } });
	await expect(page.getByText("1 meal · 14 days")).toBeVisible();
	await page.goto("about:blank");
	await page.goto("/"); // as the home-screen icon does
	await page.getByRole("link", { name: "Plan" }).click();
	await expect(page.getByText("1 meal · 14 days")).toBeVisible();
	await expect(page).toHaveURL(/plan=/);
});

test("7. a cooking-rs link opens correctly", async ({ page }) => {
	// As serde_json wrote it: floats as 1.0, extras untagged, a past day still in it, an unknown recipe id.
	const old = `{"dates":{"${iso(-2)}":["pancakes"],"${iso(1)}":["carbonara",{"recipe":"lentil_dal","servings":6},"from_the_future"]},"extras":[{"name":"milk","amount":1.0,"unit":"l"},{"name":"Bread","quantity":"1 loaf"}]}`;
	await page.goto(`/#/?plan=${planParam(old)}`);
	await page.getByRole("link", { name: "Plan" }).click();
	await expect(page.getByText("3 meals · 14 days")).toBeVisible(); // the past day is gone
	await expect(page.getByRole("region").nth(1).getByRole("listitem")).toHaveText([
		/Spaghetti Carbonara/,
		/Lentil Dal.*serves 6/,
		/Unknown recipe \(from_the_future\)/,
	]);
	await page.getByRole("link", { name: /^Grocery/ }).click();
	await expect(row(page, "Milk")).toContainText("1 l");
	await expect(row(page, "Bread")).toContainText("1 loaf");
	await expect(row(page, "Lentils")).toContainText("450 g"); // 300 g for 4, cooked for 6
});

test("garbage in the address is ignored", async ({ page }) => {
	await page.goto("/#/planner?plan=not-a-plan");
	await expect(page.getByText("0 meals · 14 days")).toBeVisible();
	await expect(page).not.toHaveURL(/plan=/);
});

test("the grocery list is copied as text", async ({ page, context }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await open(page, "/grocery", {
		dates: { [iso(0)]: ["greek_yogurt_bowl"] },
		extras: [{ name: "Soap", quantity: null }],
	});
	await page.getByRole("button", { name: "Copy list" }).click();
	await expect(page.getByTestId("toast")).toHaveText("List copied");
	const text = await page.evaluate(() => navigator.clipboard.readText());
	expect(text).toMatch(/^Produce\n- Banana: \d/);
	expect(text).toContain("\n\nOther\n- Soap");
});
