import { describe, expect, it } from "vitest";
import { parseExtra, parseNumber, suggest, toExtra } from "./extras";
import { fixtureData, recipeFile } from "./fixtures";

const { dictionary } = fixtureData([recipeFile("r", 1, [{ ingredient: "salt" }])]);

describe("extras", () => {
	it("splits what was typed into a name and a quantity", () => {
		expect(parseExtra("milk 1 l")).toEqual({ name: "milk", quantity: "1 l" });
		expect(parseExtra("2 eggs")).toEqual({ name: "eggs", quantity: "2" });
		expect(parseExtra("bread")).toEqual({ name: "bread", quantity: null });
		expect(parseExtra("bread 1 loaf")).toEqual({ name: "bread", quantity: "1 loaf" });
		expect(parseExtra("1 loaf bread")).toEqual({ name: "bread", quantity: "1 loaf" });
		expect(parseExtra("  olive   oil 0,5 l ")).toEqual({ name: "olive oil", quantity: "0,5 l" });
		expect(parseExtra("coffee 250")).toEqual({ name: "coffee", quantity: "250" });
		expect(parseExtra("")).toEqual({ name: "", quantity: null });
		expect(parseExtra("7up")).toEqual({ name: "7up", quantity: null });
	});

	it("reads positive numbers, with a decimal comma", () => {
		expect(parseNumber("2")).toBe(2);
		expect(parseNumber("0,5")).toBe(0.5);
		expect(parseNumber("1.25")).toBe(1.25);
		expect(parseNumber(".5")).toBe(0.5);
		for (const bad of ["0", "-1", "1e3", "0x10", "", "two", "1/2", "Infinity"])
			expect(parseNumber(bad), bad).toBeNull();
	});

	it("suggests starts-with matches first, then contains, by name, capped", () => {
		const names = (q: string, max: number) => suggest(dictionary, q, max).map((s) => s.name);
		expect(names("bre", 5)).toEqual(["Bread", "Breadcrumbs"]);
		expect(names("crumb", 5)).toEqual(["Breadcrumbs"]);
		expect(names("B", 1)).toEqual(["Bread"]);
		expect(names("  ", 5)).toEqual([]);
		expect(names("zzz", 5)).toEqual([]);
		expect(names("on", 5)).toEqual(["Onion", "Lemon", "Salmon fillet", "Scallion"]);
		// An alias finds its entry.
		expect(names("spring", 5)).toEqual(["Scallion"]);
		expect(suggest(dictionary, "milk", 5)[0]).toEqual({
			key: "milk",
			name: "Milk",
			aisle: "Dairy & Eggs",
		});
	});

	it("makes a catalog extra when the quantity converts, else keeps it as typed", () => {
		const make = (name: string, quantity: string | null, key: string | null) =>
			toExtra({ name, quantity }, key, dictionary);

		expect(make("milk", "1 l", "milk")).toEqual({
			kind: "catalog",
			key: "milk",
			amount: 1,
			unit: "l",
		});
		// No unit: the shopping unit, written out.
		expect(make("flour", "500", "flour")).toEqual({
			kind: "catalog",
			key: "flour",
			amount: 500,
			unit: "g",
		});
		expect(make("milk", "0,5", "milk")).toEqual({
			kind: "catalog",
			key: "milk",
			amount: 0.5,
			unit: "ml",
		});
		// A pcs ingredient without a unit stays a bare count.
		expect(make("eggs", "6", "egg")).toEqual({ kind: "catalog", key: "egg", amount: 6 });
		// Piece labels resolve too, kept as typed.
		expect(make("bread", "2 loaves", "bread")).toEqual({
			kind: "catalog",
			key: "bread",
			amount: 2,
			unit: "loaves",
		});
		expect(make("garlic", "3 cloves", "garlic")).toEqual({
			kind: "catalog",
			key: "garlic",
			amount: 3,
			unit: "cloves",
		});
		// No quantity at all.
		expect(make("milk", null, "milk")).toEqual({ kind: "catalog", key: "milk" });
		// A unit the ingredient can't convert keeps the text, under the dictionary's name.
		expect(make("flour", "1 bag", "flour")).toEqual({
			kind: "custom",
			name: "Flour",
			quantity: "1 bag",
		});
		expect(make("flour", "1 cup", "flour")).toEqual({
			kind: "custom",
			name: "Flour",
			quantity: "1 cup",
		});
		expect(make("salt", "2 pcs", "salt")).toEqual({
			kind: "custom",
			name: "Salt",
			quantity: "2 pcs",
		});
		// No pick: custom, trimmed and capitalised.
		expect(make(" candles ", "3", null)).toEqual({
			kind: "custom",
			name: "Candles",
			quantity: "3",
		});
		expect(make("éclair", null, null)).toEqual({ kind: "custom", name: "Éclair", quantity: null });
		expect(make("milk", "1 l", "no_such_key")).toEqual({
			kind: "custom",
			name: "Milk",
			quantity: "1 l",
		});
	});
});
