import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { fixtureData, recipeFile } from "./fixtures";
import { formatLineQuantity } from "./format";
import {
	aggregate,
	allLines,
	arrange,
	clearChecked,
	customKey,
	DEFAULT_GROCERY,
	type GroceryAisle,
	type GroceryLine,
	type GroceryState,
	isChecked,
	progress,
	pruneChecked,
	rangeEnd,
	sameRange,
	toggleChecked,
} from "./grocery";
import { addExtra, addItem, addMeal, EMPTY_PLAN, type Plan, setChanges, setServings } from "./plan";

const TODAY = "2026-10-25";
const d = (n: number) => addDays(TODAY, n);

function find(aisles: GroceryAisle[], key: string): GroceryLine {
	const line = allLines(aisles).find((l) => l.key === key);
	if (!line) throw new Error(`no line for ${key}`);
	return line;
}
const names = (aisles: GroceryAisle[]) => aisles.map((a) => a.name);

describe("aggregate", () => {
	it("lists what doesn't convert beside the total, summed per unit and scaled with the servings", () => {
		const data = fixtureData([
			// Pastry: eggs by weight. Everyday: eggs by count, and a lemon "by weight".
			recipeFile("cake", 4, [
				{ ingredient: "egg", amount: 2 },
				{ ingredient: "flour", amount: 2, unit: "cups" },
				{ ingredient: "flour", amount: 200, unit: "g" },
				{ ingredient: "lemon", amount: 60, unit: "g" },
			]),
			recipeFile("pasta", 2, [
				{ ingredient: "egg", amount: 1 },
				{ ingredient: "flour", amount: 1, unit: "cup" },
				{ ingredient: "flour", amount: 1, unit: "kg" },
				{ ingredient: "lemon", amount: 1 },
				{ ingredient: "lemon", amount: 1, unit: "zest" },
			]),
		]);
		let plan = addMeal(EMPTY_PLAN, TODAY, "cake");
		plan = addMeal(plan, d(1), "pasta");
		plan = setServings(plan, d(1), 0, 4, 2); // the pasta for 4: twice the recipe
		const list = aggregate(plan, TODAY, d(1), data);

		const flour = find(list, "flour");
		expect(flour.amount).toBe(2200); // 200 g + 2 kg
		expect(flour.aside).toEqual([{ unit: "cup", amount: 4 }]); // 2 cups + 1 cup × 2
		expect(formatLineQuantity(flour)).toBe("2.2 kg + 4 cup");
		const lemon = find(list, "lemon");
		expect(lemon.amount).toBe(2);
		expect(lemon.aside).toEqual([
			{ unit: "g", amount: 60 },
			{ unit: "zest", amount: 2 },
		]);
		expect(formatLineQuantity(lemon)).toBe("2 + 60 g + 2 zest");
		expect(lemon.sources).toEqual(["CAKE", "PASTA"]);
	});

	it("converts the canonical inputs into shopping units", () => {
		const data = fixtureData([
			recipeFile("dal", 2, [
				{ ingredient: "onion", amount: 1, unit: "pcs" },
				{ ingredient: "garlic", amount: 3, unit: "cloves" },
				{ ingredient: "olive_oil", amount: 2, unit: "tbsp" },
				{ ingredient: "chopped_tomatoes", amount: 400, unit: "g" },
				{ ingredient: "egg", amount: 4 },
			]),
			recipeFile("tacos", 2, [{ ingredient: "onion", amount: 100, unit: "g" }]),
		]);
		let plan = addMeal(EMPTY_PLAN, d(0), "dal");
		plan = addMeal(plan, d(1), "tacos");
		const list = aggregate(plan, d(0), d(13), data);

		expect(find(list, "onion")).toMatchObject({ amount: 250, unit: "g", name: "Onion" });
		expect(find(list, "garlic")).toMatchObject({ amount: 12, unit: "g" });
		expect(find(list, "olive_oil")).toMatchObject({ amount: 30, unit: "ml" });
		expect(find(list, "chopped_tomatoes")).toMatchObject({ amount: 1, unit: "pcs" });
		expect(find(list, "egg")).toMatchObject({ amount: 4, unit: "pcs" });
		expect(find(list, "onion").sources).toEqual(["DAL", "TACOS"]);
		expect(find(list, "onion").toTaste).toBe(false);
		expect(find(list, "onion").extra).toBe(false);
		expect(allLines(list).map(formatLineQuantity)).toEqual([
			"12 g",
			"250 g",
			"4",
			"1 can",
			"30 ml",
		]);
	});

	it("scales by servings, and tracks to taste and optional", () => {
		const data = fixtureData([
			recipeFile("a", 2, [
				{ ingredient: "olive_oil", amount: 10, unit: "ml" },
				{ ingredient: "salt", optional: true },
			]),
			recipeFile("b", 1, [{ ingredient: "salt", amount: 5, unit: "g" }]),
		]);
		let plan = addMeal(EMPTY_PLAN, d(0), "a");
		plan = setServings(plan, d(0), 0, 4); // ×2
		plan = addMeal(plan, d(2), "a"); // the recipe's own servings
		let list = aggregate(plan, d(0), d(13), data);
		expect(find(list, "olive_oil").amount).toBe(30);
		expect(find(list, "salt")).toMatchObject({ toTaste: true, amount: null, optional: true });

		plan = addMeal(plan, d(3), "b");
		list = aggregate(plan, d(0), d(13), data);
		// Optional only if every contribution is optional.
		expect(find(list, "salt")).toMatchObject({ toTaste: true, amount: 5, optional: false });
		expect(find(list, "salt").sources).toEqual(["A", "B"]);
	});

	it("adds catalog extras unscaled, without a source", () => {
		const data = fixtureData([recipeFile("r", 1, [{ ingredient: "salt" }])]);
		let plan = addExtra(EMPTY_PLAN, { kind: "catalog", key: "egg", amount: 6 });
		plan = addExtra(plan, { kind: "catalog", key: "olive_oil", amount: 0.5, unit: "l" });
		plan = addExtra(plan, { kind: "catalog", key: "garlic", amount: 2, unit: "cloves" });
		plan = addExtra(plan, { kind: "catalog", key: "milk" });
		plan = addExtra(plan, { kind: "catalog", key: "no_such_key", amount: 1 });
		const list = aggregate(plan, d(0), d(13), data);
		expect(find(list, "egg")).toMatchObject({
			amount: 6,
			sources: [],
			extra: true,
			optional: false,
		});
		expect(find(list, "olive_oil").amount).toBe(500);
		expect(find(list, "garlic").amount).toBe(8);
		expect(find(list, "milk")).toMatchObject({ amount: null, toTaste: true });
		expect(allLines(list)).toHaveLength(4);
	});

	it("puts custom extras last in Other, merged by name", () => {
		const data = fixtureData([recipeFile("r", 1, [{ ingredient: "salt", amount: 1, unit: "g" }])]);
		let plan = addMeal(EMPTY_PLAN, d(0), "r");
		plan = addExtra(plan, { kind: "custom", name: "Toilet paper", quantity: "1 pack" });
		plan = addExtra(plan, { kind: "custom", name: "toilet  paper ", quantity: "2 rolls" });
		plan = addExtra(plan, { kind: "custom", name: "candles", quantity: null });
		plan = addExtra(plan, { kind: "custom", name: "   ", quantity: null });
		const list = aggregate(plan, d(0), d(13), data);
		expect(names(list)).toEqual(["Spices & Oils", "Other"]);
		expect(list[1]?.lines).toHaveLength(2);
		const paper = find(list, "custom:toilet paper");
		expect(paper).toMatchObject({ name: "Toilet paper", amount: null, unit: null, extra: true });
		expect(paper.customQuantities).toEqual(["1 pack", "2 rolls"]);
		expect(formatLineQuantity(paper)).toBe("1 pack + 2 rolls");
		expect(find(list, "custom:candles")).toMatchObject({ name: "Candles", customQuantities: [] });
		expect(customKey(" Bread ")).toBe("custom:bread");
	});

	it("appends a custom extra to the line of the dictionary ingredient it names", () => {
		const data = fixtureData([
			recipeFile("r", 1, [{ ingredient: "flour", amount: 500, unit: "g", optional: true }]),
		]);
		let plan = addMeal(EMPTY_PLAN, d(0), "r");
		plan = addExtra(plan, { kind: "custom", name: "Flour", quantity: "1 bag" });
		// Bread is in the dictionary but not on the list: its own line, in Other.
		plan = addExtra(plan, { kind: "custom", name: "Bread", quantity: "1 loaf" });
		const list = aggregate(plan, d(0), d(13), data);
		expect(names(list)).toEqual(["Bakery", "Other"]);
		const flour = find(list, "flour");
		expect(flour).toMatchObject({
			amount: 500,
			customQuantities: ["1 bag"],
			optional: false,
			extra: true,
		});
		expect(formatLineQuantity(flour)).toBe("500 g + 1 bag");
		expect(find(list, "custom:bread").customQuantities).toEqual(["1 loaf"]);
	});

	it("skips unknown recipes", () => {
		const data = fixtureData([recipeFile("r", 1, [{ ingredient: "salt", amount: 1, unit: "g" }])]);
		let plan = addMeal(EMPTY_PLAN, d(0), "r");
		plan = addMeal(plan, d(1), "ghost");
		expect(allLines(aggregate(plan, d(0), d(13), data))).toHaveLength(1);
	});

	it("counts only the meals in range, and always the extras", () => {
		const data = fixtureData([
			recipeFile("a", 1, [{ ingredient: "onion", amount: 100, unit: "g" }]),
			recipeFile("b", 1, [{ ingredient: "onion", amount: 50, unit: "g" }]),
		]);
		let plan = addMeal(EMPTY_PLAN, d(0), "a");
		plan = addMeal(plan, d(2), "b");
		plan = addMeal(plan, d(5), "a");
		plan = addExtra(plan, { kind: "catalog", key: "egg", amount: 6 });

		let list = aggregate(plan, d(0), d(2), data);
		expect(find(list, "onion").amount).toBe(150);
		expect(find(list, "onion").sources).toEqual(["A", "B"]);
		list = aggregate(plan, d(0), d(0), data);
		expect(find(list, "onion").amount).toBe(100);
		list = aggregate(plan, d(3), d(4), data);
		expect(names(list)).toEqual(["Dairy & Eggs"]); // only the extra
	});

	it("follows a meal's ingredient changes, for that meal only", () => {
		const data = fixtureData([
			recipeFile("soup", 2, [
				{ ingredient: "scallion", amount: 2 },
				{ ingredient: "garlic", amount: 3, unit: "cloves" },
				{ ingredient: "salt" },
			]),
		]);
		let plan = addMeal(EMPTY_PLAN, d(0), "soup");
		plan = addMeal(plan, d(1), "soup");
		plan = setServings(plan, d(1), 0, 4); // twice the recipe
		plan = setChanges(plan, d(1), 0, [
			{ kind: "swap", key: "scallion", for: "onion" },
			{ kind: "skip", key: "salt" },
			{ kind: "set", key: "garlic", amount: 1, unit: "clove" },
			{ kind: "add", key: "lemon", amount: 1 },
		]);
		const list = aggregate(plan, d(0), d(13), data);
		expect(find(list, "scallion").amount).toBe(30); // the unchanged meal: 2 x 15 g
		expect(find(list, "onion")).toMatchObject({ amount: 600, sources: ["SOUP"] }); // 2 onions, doubled
		expect(find(list, "garlic").amount).toBe(12 + 8); // 3 cloves + 1 clove doubled
		expect(find(list, "lemon").amount).toBe(2);
		expect(find(list, "salt").sources).toEqual(["SOUP"]); // still needed by the unchanged meal
		// Only the changed meal in range: no scallion, no salt.
		const later = aggregate(plan, d(1), d(13), data);
		expect(allLines(later).map((l) => l.key)).toEqual(["garlic", "lemon", "onion"]);
	});

	it("lists a meal's freely typed ingredients in Other, as typed, for that recipe", () => {
		const data = fixtureData([
			recipeFile("soup", 2, [{ ingredient: "scallion", amount: 2 }, { ingredient: "salt" }]),
		]);
		let plan = addMeal(EMPTY_PLAN, d(0), "soup");
		plan = setServings(plan, d(0), 0, 4);
		plan = setChanges(plan, d(0), 0, [
			{ kind: "swapFree", key: "scallion", name: "Shallots", quantity: "2" },
			{ kind: "addFree", key: "custom:bay leaves", name: "Bay leaves", quantity: null },
		]);
		plan = addMeal(plan, d(1), "soup");
		plan = setChanges(plan, d(1), 0, [
			{ kind: "addFree", key: "custom:shallots", name: "shallots", quantity: "1 bunch" },
		]);
		const list = aggregate(plan, d(0), d(13), data);
		expect(names(list)).toEqual(["Produce", "Spices & Oils", "Other"]);
		// Not scaled with the servings and not added up: the quantities side by side.
		expect(find(list, "custom:shallots")).toMatchObject({
			name: "Shallots",
			amount: null,
			customQuantities: ["2", "1 bunch"],
			sources: ["SOUP"],
			extra: false,
		});
		expect(formatLineQuantity(find(list, "custom:shallots"))).toBe("2 + 1 bunch");
		expect(find(list, "custom:bay leaves")).toMatchObject({
			customQuantities: [],
			sources: ["SOUP"],
		});
		expect(find(list, "scallion").amount).toBe(30); // only the second meal's
	});

	it("lists a day's extras that are to be bought, like any extra", () => {
		const data = fixtureData([
			recipeFile("r", 2, [{ ingredient: "salmon", amount: 2, unit: "fillets" }]),
		]);
		let plan = addItem(
			EMPTY_PLAN,
			d(0),
			{ kind: "custom", name: "Frozen pizza", quantity: null },
			true,
		);
		plan = addItem(plan, d(2), { kind: "custom", name: "frozen pizza", quantity: "2 boxes" }, true);
		plan = addItem(plan, d(0), { kind: "custom", name: "Leftovers", quantity: null }, false); // plan only
		plan = addItem(plan, d(9), { kind: "custom", name: "Ice cream", quantity: null }, true); // out of range
		plan = addItem(plan, d(1), { kind: "catalog", key: "salmon", amount: 1, unit: "fillet" }, true);
		plan = addItem(plan, d(1), { kind: "catalog", key: "egg", amount: 6 }, true);
		plan = addItem(plan, d(1), { kind: "catalog", key: "milk" }, false); // plan only
		plan = addMeal(plan, d(0), "r");
		const list = aggregate(plan, d(0), d(5), data);
		expect(names(list)).toEqual(["Fish", "Dairy & Eggs", "Other"]);
		// From the list: added to the recipe's amount, in its aisle, never scaled.
		expect(find(list, "salmon")).toMatchObject({ amount: 375, sources: ["R"], extra: true });
		expect(find(list, "egg")).toMatchObject({
			amount: 6,
			sources: [],
			extra: true,
			optional: false,
		});
		// Typed: one line in Other, the quantities as written.
		expect(find(list, "custom:frozen pizza")).toMatchObject({
			name: "Frozen pizza",
			amount: null,
			customQuantities: ["2 boxes"],
			sources: [],
			extra: true,
		});
		expect(allLines(list)).toHaveLength(3);
		// It joins an extra of the same name that has no day.
		const withExtra = addExtra(plan, { kind: "custom", name: "Frozen pizza", quantity: "1" });
		expect(
			find(aggregate(withExtra, d(0), d(5), data), "custom:frozen pizza").customQuantities,
		).toEqual(["2 boxes", "1"]);
	});

	it("orders aisles as in the shop and lines by name", () => {
		const data = fixtureData([
			recipeFile("r", 1, [
				{ ingredient: "salt" },
				{ ingredient: "olive_oil", amount: 1, unit: "tbsp" },
				{ ingredient: "salmon", amount: 1, unit: "fillet" },
				{ ingredient: "guanciale", amount: 50, unit: "g" },
				{ ingredient: "scallion", amount: 2 },
				{ ingredient: "onion", amount: 1 },
				{ ingredient: "lemon", amount: 1 },
				{ ingredient: "egg", amount: 1 },
				{ ingredient: "flour", amount: 100, unit: "g" },
			]),
		]);
		const plan = addExtra(addMeal(EMPTY_PLAN, d(0), "r"), {
			kind: "custom",
			name: "Soap",
			quantity: null,
		});
		const list = aggregate(plan, d(0), d(0), data);
		expect(names(list)).toEqual([
			"Produce",
			"Meat",
			"Fish",
			"Dairy & Eggs",
			"Bakery",
			"Spices & Oils",
			"Other",
		]);
		expect(list[0]?.lines.map((l) => l.name)).toEqual(["Lemon", "Onion", "Scallion"]);
		expect(list[5]?.lines.map((l) => l.name)).toEqual(["Olive oil", "Salt"]);
	});
});

function line(key: string, amount: number | null, customQuantities: string[] = []): GroceryLine {
	return {
		key,
		name: key.toUpperCase(),
		unit: "g",
		amount,
		aside: [],
		toTaste: amount === null,
		optional: false,
		sources: [],
		extra: false,
		customQuantities,
	};
}
const aisle = (name: string, ...lines: GroceryLine[]): GroceryAisle => ({ name, lines });
const tick = (state: GroceryState, ...lines: GroceryLine[]) => lines.reduce(toggleChecked, state);

describe("ticks", () => {
	it("drop when a quantity beside the total grows, and stay when it shrinks", () => {
		const data = fixtureData([
			recipeFile("cake", 1, [{ ingredient: "lemon", amount: 60, unit: "g" }]),
		]);
		const plan = addMeal(EMPTY_PLAN, TODAY, "cake");
		const list = (p: Plan) => aggregate(p, TODAY, d(1), data);
		const ticked = toggleChecked(DEFAULT_GROCERY, find(list(plan), "lemon"));
		expect(ticked.checked[0]?.aside).toEqual([{ unit: "g", amount: 60 }]);
		expect(pruneChecked(ticked, list(setServings(plan, TODAY, 0, 2, 1)))).toEqual({
			...ticked,
			checked: [],
		});
		expect(pruneChecked(ticked, list(plan))).toBe(ticked);
	});

	it("toggle on and off", () => {
		const onion = line("onion", 1);
		let state = toggleChecked(DEFAULT_GROCERY, onion);
		expect(isChecked(state, "onion")).toBe(true);
		expect(state.checked).toEqual([{ key: "onion", amount: 1, aside: [], custom: [] }]);
		state = toggleChecked(state, onion);
		expect(isChecked(state, "onion")).toBe(false);
		expect(DEFAULT_GROCERY.checked).toEqual([]);
	});

	it("drop when the line is gone or needs more; stay when it needs the same or less", () => {
		const state = tick(
			DEFAULT_GROCERY,
			line("onion", 250),
			line("garlic", 12),
			line("egg", 4),
			line("rice", 500),
			line("salt", null),
			line("pepper", null),
			line("flour", 500, ["1 bag"]),
			line("bread", null, ["1 loaf"]),
			line("soap", null, ["2", "2"]),
		);
		const current = [
			aisle(
				"Produce",
				line("onion", 250.0004), // float noise: still equal
				line("garlic", 16), // needs more
				// egg: gone
			),
			aisle(
				"Pantry",
				line("rice", 200), // needs less: still bought
				line("salt", null), // to taste: unchanged
				line("pepper", 2), // had no amount, now has one
				line("flour", 500, ["1 bag", "1 kg"]), // a custom quantity it didn't have
				line("bread", null, []), // custom quantity removed: needs less
				line("soap", null, ["2", "2", "2"]), // one more of the same text
			),
		];
		const pruned = pruneChecked(state, current);
		const kept = (key: string) => isChecked(pruned, key);
		expect(kept("onion")).toBe(true);
		expect(kept("garlic")).toBe(false);
		expect(kept("egg")).toBe(false);
		expect(kept("rice")).toBe(true);
		expect(kept("salt")).toBe(true);
		expect(kept("pepper")).toBe(false);
		expect(kept("flour")).toBe(false);
		expect(kept("bread")).toBe(true);
		expect(kept("soap")).toBe(false);
		expect(pruneChecked(pruned, current)).toBe(pruned); // second pass is a no-op
	});

	it("clear, keeping the range", () => {
		const state = tick({ checked: [], range: { days: 3 } }, line("onion", 1));
		expect(clearChecked(state)).toEqual({ checked: [], range: { days: 3 } });
		expect(clearChecked(DEFAULT_GROCERY)).toBe(DEFAULT_GROCERY);
	});

	it("count what is left, and sink ticked lines to the bottom of their aisle", () => {
		const list = [
			aisle("Produce", line("garlic", 12), line("lemon", 1), line("onion", 250)),
			aisle("Other", line("custom:bread", null, ["1 loaf"])),
		];
		expect(progress(list, DEFAULT_GROCERY)).toEqual({ left: 4, total: 4 });
		const state = tick(DEFAULT_GROCERY, line("garlic", 12), line("custom:bread", null, ["1 loaf"]));
		expect(progress(list, state)).toEqual({ left: 2, total: 4 });
		const shown = arrange(list, state);
		expect(shown[0]?.lines.map((l) => l.key)).toEqual(["lemon", "onion", "garlic"]);
		expect(shown[1]?.lines.map((l) => l.key)).toEqual(["custom:bread"]);
		expect(list[0]?.lines.map((l) => l.key)).toEqual(["garlic", "lemon", "onion"]); // input untouched
	});
});

describe("range", () => {
	it("ends on the last planned day, or after n days, never before today", () => {
		let plan: Plan = EMPTY_PLAN;
		expect(rangeEnd("all", plan, TODAY)).toBe(TODAY); // nothing planned
		plan = addMeal(plan, d(9), "dal");
		expect(rangeEnd("all", plan, TODAY)).toBe(d(9));
		expect(rangeEnd({ days: 1 }, plan, TODAY)).toBe(TODAY);
		expect(rangeEnd({ days: 3 }, plan, TODAY)).toBe(d(2));
		expect(rangeEnd({ days: 7 }, plan, TODAY)).toBe(d(6));
		expect(rangeEnd({ days: 0 }, plan, TODAY)).toBe(TODAY);
		// A plan last decoded yesterday still never ends the range in the past.
		expect(rangeEnd("all", plan, d(12))).toBe(d(12));
	});

	it("compares presets", () => {
		expect(sameRange("all", "all")).toBe(true);
		expect(sameRange({ days: 3 }, { days: 3 })).toBe(true);
		expect(sameRange({ days: 3 }, { days: 7 })).toBe(false);
		expect(sameRange("all", { days: 7 })).toBe(false);
	});
});
