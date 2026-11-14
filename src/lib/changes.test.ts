import { describe, expect, it } from "vitest";
import { applyChanges, changeFor, freeKey, withChange, withoutChange } from "./changes";
import { fixtureData, recipeFile } from "./fixtures";
import type { MealChange } from "./plan";

const data = fixtureData([
	recipeFile("soup", 2, [
		{ ingredient: "scallion", amount: 2, note: "sliced" },
		{ ingredient: "garlic", amount: 3, unit: "cloves" },
		{ ingredient: "olive_oil", amount: 2, unit: "tbsp" },
		{ ingredient: "salt", optional: true },
	]),
]);
const recipe = data.recipeById.get("soup");
if (!recipe) throw new Error("fixture");
const apply = (...changes: MealChange[]) => applyChanges(recipe, changes, data.dictionary);
const brief = (...changes: MealChange[]) =>
	apply(...changes).lines.map((l) => [l.key, l.amount, l.unit, l.perServing, l.change ?? null]);

describe("applyChanges", () => {
	it("returns the recipe's own lines when nothing changed", () => {
		expect(apply().lines).toBe(recipe.lines);
		expect(applyChanges(recipe, undefined, data.dictionary).skipped).toEqual([]);
	});

	it("swaps an ingredient, keeping the amount when it means something for the new one", () => {
		// 2 scallions -> 2 onions: a count is a count.
		const { lines } = apply({ kind: "swap", key: "scallion", for: "onion" });
		expect(lines[0]).toMatchObject({
			key: "onion",
			name: "Onion",
			amount: 2,
			unit: "pcs",
			perServing: 150,
			note: "sliced",
			change: "swap",
			instead: { key: "scallion", name: "Scallion" },
		});
		expect(lines).toHaveLength(4);
		// With its own amount.
		expect(
			brief({ kind: "swap", key: "scallion", for: "onion", amount: 100, unit: "g" })[0],
		).toEqual(["onion", 100, "g", 50, "swap"]);
		// 2 tbsp of oil means nothing for salt (sold in g): to taste, never a wrong number.
		expect(brief({ kind: "swap", key: "olive_oil", for: "salt" })[2]).toEqual([
			"salt",
			null,
			null,
			null,
			"swap",
		]);
		// "3 cloves" of garlic become 3 lemons: pieces stay pieces.
		expect(brief({ kind: "swap", key: "garlic", for: "lemon" })[1]).toEqual([
			"lemon",
			3,
			"pcs",
			1.5,
			"swap",
		]);
	});

	it("leaves an ingredient out", () => {
		const { lines, skipped } = apply({ kind: "skip", key: "garlic" });
		expect(lines.map((l) => l.key)).toEqual(["scallion", "olive_oil", "salt"]);
		expect(skipped.map((l) => l.key)).toEqual(["garlic"]);
	});

	it("changes an amount, or makes it to taste", () => {
		expect(brief({ kind: "set", key: "garlic", amount: 6, unit: "cloves" })[1]).toEqual([
			"garlic",
			6,
			"pcs",
			12,
			"set",
		]);
		expect(brief({ kind: "set", key: "garlic", amount: 10, unit: "g" })[1]).toEqual([
			"garlic",
			10,
			"g",
			5,
			"set",
		]);
		expect(brief({ kind: "set", key: "garlic" })[1]).toEqual(["garlic", null, null, null, "set"]);
		// An amount for an ingredient that had none.
		expect(apply({ kind: "set", key: "salt", amount: 5, unit: "g" }).lines[3]).toMatchObject({
			amount: 5,
			perServing: 2.5,
			optional: true,
		});
	});

	it("adds an ingredient after the recipe's own", () => {
		const { lines } = apply({ kind: "add", key: "lemon", amount: 1 }, { kind: "add", key: "milk" });
		expect(lines.slice(4).map((l) => [l.key, l.amount, l.perServing, l.change])).toEqual([
			["lemon", 1, 0.5, "add"],
			["milk", null, null, "add"],
		]);
	});

	it("takes ingredients typed freely, which are not in the dictionary", () => {
		const { lines } = apply(
			{ kind: "swapFree", key: "scallion", name: "Shallots", quantity: " 2 " },
			{ kind: "addFree", key: freeKey("Bay leaves"), name: "Bay leaves", quantity: null },
		);
		expect(lines[0]).toEqual({
			key: "custom:shallots",
			name: "Shallots",
			amount: null,
			unit: null,
			optional: false,
			perServing: null,
			free: { quantity: "2" },
			change: "swap",
			instead: { key: "scallion", name: "Scallion" },
		});
		expect(lines.at(-1)).toMatchObject({
			key: "custom:bay leaves",
			name: "Bay leaves",
			free: { quantity: null },
			change: "add",
		});
		expect(lines).toHaveLength(5);
		expect(freeKey("  Bay   LEAVES ")).toBe("custom:bay leaves");
	});

	it("ignores changes it can't apply", () => {
		expect(
			brief(
				{ kind: "skip", key: "not_in_the_recipe" },
				{ kind: "swap", key: "garlic", for: "not_in_the_dictionary" },
				{ kind: "add", key: "not_in_the_dictionary" },
			),
		).toEqual(recipe.lines.map((l) => [l.key, l.amount, l.unit, l.perServing, null]));
	});

	it("combines several changes", () => {
		expect(
			brief(
				{ kind: "swap", key: "scallion", for: "onion" },
				{ kind: "skip", key: "salt" },
				{ kind: "set", key: "olive_oil", amount: 1, unit: "tbsp" },
				{ kind: "add", key: "egg", amount: 2 },
			).map(([key]) => key),
		).toEqual(["onion", "garlic", "olive_oil", "egg"]);
	});
});

describe("a meal's list of changes", () => {
	it("holds one change per ingredient", () => {
		let changes = withChange(undefined, { kind: "skip", key: "salt" });
		changes = withChange(changes, { kind: "swap", key: "scallion", for: "onion" });
		changes = withChange(changes, { kind: "set", key: "salt", amount: 5, unit: "g" });
		expect(changes).toEqual([
			{ kind: "swap", key: "scallion", for: "onion" },
			{ kind: "set", key: "salt", amount: 5, unit: "g" },
		]);
		expect(changeFor(changes, "salt")?.kind).toBe("set");
		expect(changeFor(changes, "garlic")).toBeUndefined();
		expect(changeFor(undefined, "garlic")).toBeUndefined();
		expect(withoutChange(changes, "scallion")).toEqual([
			{ kind: "set", key: "salt", amount: 5, unit: "g" },
		]);
		expect(withoutChange(undefined, "salt")).toEqual([]);
	});
});
