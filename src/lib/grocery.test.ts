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
import { addExtra, addMeal, EMPTY_PLAN, type Plan, setServings } from "./plan";

const TODAY = "2026-10-25";
const d = (n: number) => addDays(TODAY, n);

function find(aisles: GroceryAisle[], key: string): GroceryLine {
	const line = allLines(aisles).find((l) => l.key === key);
	if (!line) throw new Error(`no line for ${key}`);
	return line;
}
const names = (aisles: GroceryAisle[]) => aisles.map((a) => a.name);

describe("aggregate", () => {
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
	it("toggle on and off", () => {
		const onion = line("onion", 1);
		let state = toggleChecked(DEFAULT_GROCERY, onion);
		expect(isChecked(state, "onion")).toBe(true);
		expect(state.checked).toEqual([{ key: "onion", amount: 1, custom: [] }]);
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
