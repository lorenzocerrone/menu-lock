import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { fixtureData, recipeFile } from "./fixtures";
import {
	formatAddedTo,
	formatAmountInput,
	formatCount,
	formatDate,
	formatDay,
	formatDayInline,
	formatExtra,
	formatFiltersButton,
	formatGroceryAmount,
	formatLeft,
	formatLineAmount,
	formatLineChange,
	formatLineQuantity,
	formatMealDetails,
	formatMovedTo,
	formatOption,
	formatPlanCaption,
	formatPlannedAmount,
	formatPlannedFor,
	formatQuantity,
	formatRange,
	formatRecipeMeta,
	formatResolvedFrom,
	formatServes,
	formatShown,
	formatShowRecipes,
	formatSources,
	formatStepNumber,
	formatSummary,
	formatText,
	formatTiming,
	formatTotalTime,
	formatUnknownRecipe,
	trimDecimals,
} from "./format";
import type { GroceryLine } from "./grocery";
import type { CountSpec } from "./schema";

const clove: CountSpec = { label: "clove", perPiece: 4 };

function line(over: Partial<GroceryLine> = {}): GroceryLine {
	return {
		key: "k",
		name: "Thing",
		unit: "g",
		amount: null,
		aside: [],
		toTaste: false,
		optional: false,
		sources: [],
		extra: false,
		customQuantities: [],
		...over,
	};
}

describe("format", () => {
	it("trims decimals", () => {
		expect(trimDecimals(1.5, 2)).toBe("1.5");
		expect(trimDecimals(2, 2)).toBe("2");
		expect(trimDecimals(0.333, 2)).toBe("0.33");
		expect(trimDecimals(100, 0)).toBe("100");
		expect(trimDecimals(10.04, 1)).toBe("10");
	});

	it("writes a recipe quantity in the authored unit", () => {
		expect(formatQuantity(200, "g", undefined)).toBe("200 g");
		expect(formatQuantity(0.5, "cup", undefined)).toBe("0.5 cup");
		expect(formatQuantity(2, "tbsp", undefined)).toBe("2 tbsp");
		expect(formatQuantity(1.333, "kg", undefined)).toBe("1.33 kg");
		expect(formatQuantity(4, "pcs", undefined)).toBe("4");
		expect(formatQuantity(1, "pcs", clove)).toBe("1 clove");
		expect(formatQuantity(3, "pcs", clove)).toBe("3 cloves");
	});

	it("rescales a recipe line with the servings; to taste never scales", () => {
		const data = fixtureData([
			recipeFile("r", 2, [
				{ ingredient: "garlic", amount: 3, unit: "cloves" },
				{ ingredient: "garlic", amount: 10, unit: "g" },
				{ ingredient: "olive_oil", amount: 2, unit: "tbsp" },
				{ ingredient: "egg", amount: 2 },
				{ ingredient: "onion", amount: 1, unit: "pcs" },
				{ ingredient: "salt" },
			]),
		]);
		const lines = data.recipeById.get("r")?.lines ?? [];
		const at = (servings: number) => lines.map((l) => formatLineAmount(l, servings, 2));
		expect(at(2)).toEqual(["3 cloves", "10 g", "2 tbsp", "2", "1", "to taste"]);
		expect(at(3)).toEqual(["4.5 cloves", "15 g", "3 tbsp", "3", "1.5", "to taste"]);
		expect(at(1)).toEqual(["1.5 cloves", "5 g", "1 tbsp", "1", "0.5", "to taste"]);
		const [garlic] = lines;
		expect(garlic && formatLineAmount(garlic, 2, 6)).toBe("1 clove");
	});

	it("rounds grocery amounts for the shop", () => {
		const cases: [number, Pick<GroceryLine, "unit" | "count">, string][] = [
			[2.5, { unit: "g" }, "2.5 g"],
			[2.54, { unit: "g" }, "2.5 g"],
			[249.6, { unit: "g" }, "250 g"],
			[999, { unit: "g" }, "999 g"],
			[1000, { unit: "g" }, "1 kg"],
			[1500, { unit: "g" }, "1.5 kg"],
			[1234, { unit: "g" }, "1.23 kg"],
			[1250, { unit: "g" }, "1.25 kg"],
			[500, { unit: "ml" }, "500 ml"],
			[1200, { unit: "ml" }, "1.2 l"],
			[1.3, { unit: "pcs" }, "2"],
			[1.2, { unit: "pcs" }, "2"],
			[2.0000001, { unit: "pcs" }, "2"],
			[4, { unit: "pcs" }, "4"],
			[1, { unit: "pcs", count: { label: "can", perPiece: 400 } }, "1 can"],
			[2, { unit: "pcs", count: { label: "can", perPiece: 400 } }, "2 cans"],
			[2.2, { unit: "pcs", count: clove }, "3 cloves"],
			[0.5, { unit: "pcs", count: { label: "can", perPiece: 400 } }, "1 can"],
			// Grams stay grams even when the ingredient has a piece spec.
			[12, { unit: "g", count: clove }, "12 g"],
		];
		for (const [amount, of, want] of cases)
			expect(formatGroceryAmount(amount, of), want).toBe(want);
	});

	it("joins a line's amount, custom quantities, to taste and optional", () => {
		expect(formatLineQuantity(line({ amount: 5, toTaste: true }))).toBe("5 g + to taste");
		expect(formatLineQuantity(line({ toTaste: true, optional: true }))).toBe("to taste (optional)");
		expect(formatLineQuantity(line({ amount: 100, optional: true }))).toBe("100 g (optional)");
		expect(formatLineQuantity(line({ customQuantities: ["1 loaf", "2 rolls"] }))).toBe(
			"1 loaf + 2 rolls",
		);
		expect(formatLineQuantity(line({ amount: 500, customQuantities: ["1 bag"] }))).toBe(
			"500 g + 1 bag",
		);
		expect(formatLineQuantity(line())).toBe("");
		// Beside the total: what doesn't convert, in its own unit.
		expect(
			formatLineQuantity(
				line({
					amount: 250,
					aside: [
						{ unit: "pcs", amount: 1.2 },
						{ unit: "tbsp", amount: 1.5 },
						{ unit: "ball", amount: 0.5 },
						{ unit: "g", amount: 1500 },
					],
				}),
			),
		).toBe("250 g + 2 + 1.5 tbsp + 1 ball + 1.5 kg");
		expect(formatLineQuantity(line({ count: clove, aside: [{ unit: "pcs", amount: 3 }] }))).toBe(
			"3 cloves",
		);
	});

	it("says what a line is for", () => {
		expect(formatSources(line({ sources: ["Carbonara", "Lentil Dal"] }))).toBe(
			"Carbonara, Lentil Dal",
		);
		expect(formatSources(line({ extra: true }))).toBe("extra");
		expect(formatSources(line({ sources: ["Lentil Dal"], extra: true }))).toBe("Lentil Dal, extra");
		expect(formatSources(line())).toBe("");
	});

	it("exports the list as text", () => {
		expect(formatText([])).toBe("No meals selected yet.");
		const list = [
			{ name: "Produce", lines: [line({ amount: 1500 }), line({ name: "Salt", toTaste: true })] },
			{ name: "Other", lines: [line({ name: "Candles", unit: null })] },
		];
		expect(formatText(list)).toBe("Produce\n- Thing: 1.5 kg\n- Salt: to taste\n\nOther\n- Candles");
	});

	it("summarises the list", () => {
		expect(formatSummary(3, 12, "Today – Sat 31", 5)).toBe(
			"3 of 12 left to buy · Today – Sat 31 · 5 meals",
		);
		expect(formatSummary(0, 1, "Today", 1)).toBe("0 of 1 left to buy · Today · 1 meal");
	});

	it("writes recipe times", () => {
		expect(formatServes(4)).toBe("serves 4");
		expect(formatRecipeMeta({ totalTime: 25, cuisine: "Italian", servings: 2 })).toEqual([
			"25 min",
			"Italian",
			"serves 2",
		]);
		expect(formatRecipeMeta({ totalTime: null, servings: 1 })).toEqual(["serves 1"]);
		expect(formatTotalTime({ totalTime: 25 })).toBe("25 min");
		expect(formatTotalTime({ totalTime: null })).toBeNull();
		expect(formatTiming({ prepTime: 10, cookTime: 15 })).toBe("10 min prep + 15 min cook");
		expect(formatTiming({ prepTime: 10 })).toBe("10 min prep");
		expect(formatTiming({ cookTime: 15 })).toBe("15 min cook");
		expect(formatTiming({})).toBe("");
	});

	it("labels days and ranges", () => {
		const today = "2026-10-25"; // a Sunday
		const d = (n: number) => addDays(today, n);
		expect(formatDay(today, today)).toBe("Today");
		expect(formatDay(d(1), today)).toBe("Tomorrow");
		expect(formatDay(d(2), today)).toBe("Tue 27 Oct");
		expect(formatDay(d(7), today)).toBe("Sun 1 Nov");
		expect(formatDay(d(-1), today)).toBe("Sat 24 Oct");
		expect(formatDate(today)).toBe("Sun 25 Oct");
		expect(formatDayInline(today, today)).toBe("today");
		expect(formatDayInline(d(1), today)).toBe("tomorrow");
		expect(formatDayInline(d(2), today)).toBe("Tue 27 Oct");

		expect(formatRange(today, today, today)).toBe("Today");
		expect(formatRange(today, d(1), today)).toBe("Today – Tomorrow");
		expect(formatRange(today, d(6), today)).toBe("Today – Sat 31");
		expect(formatRange(d(2), d(9), today)).toBe("Tue 27 – Tue 3");
	});

	it("counts things, with the right noun", () => {
		expect(formatCount(1, "meal")).toBe("1 meal");
		expect(formatCount(0, "meal")).toBe("0 meals");
		expect(formatCount(2, "loaf", "loaves")).toBe("2 loaves");
		expect(formatShown(12, 25)).toBe("12 of 25");
		expect(formatFiltersButton(0)).toBe("Filters");
		expect(formatFiltersButton(2)).toBe("Filters · 2");
		expect(formatShowRecipes(12)).toBe("Show 12 recipes");
		expect(formatShowRecipes(1)).toBe("Show 1 recipe");
		expect(formatOption("Italian", 6)).toBe("Italian 6");
		expect(formatPlanCaption(8, 14)).toBe("8 meals · 14 days");
		expect(formatPlanCaption(1, 14)).toBe("1 meal · 14 days");
		expect(formatResolvedFrom(1)).toBe("resolved from 1 meal");
		expect(formatLeft(40, 43)).toBe("40 / 43");
		expect(formatStepNumber(0)).toBe("1");
		expect(formatUnknownRecipe("ghost")).toBe("Unknown recipe (ghost)");
	});

	it("words the toasts", () => {
		const today = "2026-10-25";
		expect(formatAddedTo(today, today)).toBe("Added to today");
		expect(formatAddedTo(addDays(today, 1), today)).toBe("Added to tomorrow");
		expect(formatMovedTo(addDays(today, 6), today)).toBe("Moved to Sat 31 Oct");
	});

	it("lists an extra by name and what was asked for", () => {
		const { dictionary } = fixtureData([recipeFile("r", 1, [{ ingredient: "salt" }])]);
		expect(formatExtra({ kind: "catalog", key: "milk", amount: 1, unit: "l" }, dictionary)).toEqual(
			{
				name: "Milk",
				quantity: "1 l",
			},
		);
		expect(formatExtra({ kind: "catalog", key: "egg", amount: 6 }, dictionary)).toEqual({
			name: "Egg",
			quantity: "6",
		});
		expect(formatExtra({ kind: "catalog", key: "salt" }, dictionary)).toEqual({
			name: "Salt",
			quantity: "",
		});
		expect(formatExtra({ kind: "catalog", key: "gone" }, dictionary)).toEqual({
			name: "gone",
			quantity: "",
		});
		expect(
			formatExtra({ kind: "custom", name: "Toilet paper", quantity: "1 pack" }, dictionary),
		).toEqual({
			name: "Toilet paper",
			quantity: "1 pack",
		});
		expect(formatExtra({ kind: "custom", name: "Candles", quantity: null }, dictionary)).toEqual({
			name: "Candles",
			quantity: "",
		});
	});

	it("describes a planned meal and its changed lines", () => {
		const { dictionary } = fixtureData([recipeFile("r", 1, [{ ingredient: "salt" }])]);
		const details = (meal: Parameters<typeof formatMealDetails>[0]) =>
			formatMealDetails(meal, dictionary);
		expect(details({ recipe: "dal" })).toEqual([]);
		expect(details({ recipe: "dal", servings: 6 })).toEqual(["serves 6"]);
		expect(details({ recipe: "dal", changes: [{ kind: "skip", key: "salt" }] })).toEqual([
			"changed",
		]);
		expect(
			details({ recipe: "dal", servings: 6, changes: [{ kind: "skip", key: "salt" }] }),
		).toEqual(["serves 6", "changed"]);
		expect(details({ recipe: "dal", changes: [] })).toEqual([]);
		// An extra on a day: how much, and "plan only" when it is not to be bought.
		expect(details({ item: { kind: "custom", name: "Leftover pizza", quantity: null } })).toEqual([
			"plan only",
		]);
		expect(
			details({ item: { kind: "custom", name: "Frozen pizza", quantity: "2 boxes" }, buy: true }),
		).toEqual(["2 boxes"]);
		expect(
			details({ item: { kind: "catalog", key: "salmon", amount: 2, unit: "fillets" }, buy: true }),
		).toEqual(["2 fillets"]);
		expect(details({ item: { kind: "catalog", key: "milk" } })).toEqual(["plan only"]);
		expect(details({ item: { kind: "catalog", key: "milk" }, buy: true })).toEqual([]);

		const base = {
			key: "onion",
			name: "Onion",
			amount: 1,
			unit: "pcs",
			optional: false,
			perServing: 75,
		} as const;
		expect(formatLineChange(base)).toBeNull();
		expect(formatLineChange({ ...base, change: "set" })).toBe("changed");
		expect(formatLineChange({ ...base, change: "add" })).toBe("added");
		expect(
			formatLineChange({ ...base, change: "swap", instead: { key: "scallion", name: "Scallion" } }),
		).toBe("instead of Scallion");
		expect(formatPlannedAmount(base, 4, 2)).toBe("2");
		const typed = {
			...base,
			key: "custom:shallots",
			name: "Shallots",
			amount: null,
			unit: null,
			perServing: null,
		};
		expect(formatPlannedAmount({ ...typed, free: { quantity: "1 bunch" } }, 4, 2)).toBe("1 bunch");
		expect(formatPlannedAmount({ ...typed, free: { quantity: null } }, 4, 2)).toBe("");
		expect(formatPlannedFor("2026-10-26", "2026-10-25")).toBe("As planned for tomorrow");
		expect(formatPlannedFor("2026-10-28", "2026-10-25")).toBe("As planned for Wed 28 Oct");
		expect(formatAmountInput(1.5)).toBe("1.5");
		expect(formatAmountInput(0.333)).toBe("0.33");
		expect(formatAmountInput(null)).toBe("");
	});
});
