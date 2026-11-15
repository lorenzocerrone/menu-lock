import { describe, expect, it } from "vitest";
import { loadData, lookup, normalizeName, type RecipeFile } from "./data";
import { DICTIONARY, recipeFile } from "./fixtures";

function load(files: RecipeFile[], dictionary: unknown = DICTIONARY, images?: Set<string>) {
	return loadData(dictionary, files, images ? { images } : {});
}

function problemsOf(files: RecipeFile[], dictionary: unknown = DICTIONARY, images?: Set<string>) {
	return load(files, dictionary, images).problems;
}

describe("dictionary lookup", () => {
	const { data } = load([recipeFile("r", 1, [{ ingredient: "salt" }])]);
	if (!data) throw new Error("fixture must load");
	const find = (name: string) => lookup(data.dictionary, name)?.key ?? null;

	it("matches the key, display name or an alias, any case and spacing", () => {
		expect(find("olive_oil")).toBe("olive_oil");
		expect(find("Olive  Oil")).toBe("olive_oil");
		expect(find(" SPRING onion ")).toBe("scallion");
		expect(find("Salmon fillet")).toBe("salmon");
	});

	it("folds singular and plural", () => {
		expect(find("onions")).toBe("onion");
		expect(find("Eggs")).toBe("egg");
		expect(find("chopped tomato")).toBe("chopped_tomatoes");
		expect(find("tinned tomatoes")).toBe("chopped_tomatoes");
		expect(find("scallions")).toBe("scallion");
	});

	it("does not guess", () => {
		expect(find("red onion")).toBeNull();
		expect(find("oil")).toBeNull();
		expect(find("")).toBeNull();
		expect(find("s")).toBeNull();
	});

	it("normalises names", () => {
		expect(normalizeName("  Olive   OIL ")).toBe("olive oil");
		expect(normalizeName("olive_oil")).toBe("olive oil");
	});
});

describe("loadData", () => {
	it("resolves each line once into a per-serving amount in the shopping unit", () => {
		const { data, problems } = load([
			recipeFile(
				"dal",
				2,
				[
					{ ingredient: "onion", amount: 1, note: "finely chopped" },
					{ ingredient: "garlic", amount: 3, unit: "cloves" },
					{ ingredient: "olive_oil", amount: 2, unit: "tbsp" },
					{ ingredient: "chopped_tomatoes", amount: 400, unit: "g" },
					{ ingredient: "egg", amount: 4 },
					{ ingredient: "salt", optional: true },
				],
				{ prepTime: 10, cookTime: 30, tags: ["dinner"], cuisine: "Indian" },
			),
		]);
		expect(problems).toEqual([]);
		const dal = data?.recipeById.get("dal");
		expect(dal?.lines.map((l) => [l.key, l.perServing, l.unit])).toEqual([
			["onion", 75, "pcs"],
			["garlic", 6, "pcs"],
			["olive_oil", 15, "tbsp"],
			["chopped_tomatoes", 0.5, "g"],
			["egg", 2, "pcs"],
			["salt", null, null],
		]);
		expect(dal?.lines[0]).toMatchObject({
			name: "Onion",
			amount: 1,
			note: "finely chopped",
			optional: false,
		});
		expect(dal?.lines[5]).toMatchObject({ amount: null, optional: true });
		expect(dal?.totalTime).toBe(40);
		expect(dal?.vegetarian).toBe(true);
		expect(dal?.image).toBe("placeholder.svg");
	});

	it("computes vegetarian from the Meat and Fish aisles, and total time", () => {
		const { data } = load([
			recipeFile("carbonara", 2, [{ ingredient: "guanciale", amount: 100, unit: "g" }], {
				prepTime: 10,
			}),
			recipeFile("salmon_rice", 2, [{ ingredient: "salmon", amount: 2, unit: "fillets" }]),
			recipeFile("eggs", 1, [{ ingredient: "egg", amount: 2 }], { cookTime: 0 }),
		]);
		expect(data?.recipes.map((r) => [r.id, r.vegetarian, r.totalTime])).toEqual([
			["carbonara", false, 10],
			["eggs", true, 0],
			["salmon_rice", false, null],
		]);
	});

	it("sorts recipes by title", () => {
		const { data } = load([
			recipeFile("b", 1, [{ ingredient: "salt" }], { title: "Zuppa" }),
			recipeFile("a", 1, [{ ingredient: "salt" }], { title: "Arrabbiata" }),
		]);
		expect(data?.recipes.map((r) => r.title)).toEqual(["Arrabbiata", "Zuppa"]);
	});

	it("names the file and the line of every problem, in plain words", () => {
		const problems = problemsOf([
			recipeFile("bad", 2, [
				{ ingredient: "onions", amount: 1 },
				{ ingredient: "star_anise", amount: 2 },
				{ ingredient: "salt", amount: 1, unit: "tbsp" },
				{ ingredient: "lemon", amount: 100, unit: "g" },
				{ ingredient: "olive_oil", amount: 1 },
				{ ingredient: "garlic", amount: 1, unit: "bunch" },
				{ ingredient: "salt", unit: "g" },
			]),
		]);
		expect(problems).toEqual([
			'data/recipes/bad.json, ingredient 1 (onions): "onions" is not a key in data/ingredients.json; use "onion"',
			'data/recipes/bad.json, ingredient 2 (star_anise): "star_anise" is not in data/ingredients.json; add it there first',
			'data/recipes/bad.json, ingredient 7 (salt): "unit" without "amount" ("to taste" has no unit)',
		]);
	});

	it("keeps an amount that doesn't convert aside, in its own unit, for one serving", () => {
		const { data, problems } = loadData(DICTIONARY, [
			recipeFile("flexible", 2, [
				{ ingredient: "salt", amount: 1, unit: "tbsp" },
				{ ingredient: "lemon", amount: 100, unit: "g" },
				{ ingredient: "olive_oil", amount: 1 },
				{ ingredient: "garlic", amount: 1, unit: "bunch" },
				{ ingredient: "milk", amount: 0.5, unit: "l" },
				{ ingredient: "salt", amount: 2, unit: "g" },
			]),
		]);
		expect(problems).toEqual([]);
		const lines = data?.recipeById.get("flexible")?.lines ?? [];
		expect(lines.map((l) => [l.key, l.amount, l.unit, l.perServing, l.aside ?? null])).toEqual([
			["salt", 1, "tbsp", null, { unit: "tbsp", perServing: 0.5 }],
			["lemon", 100, "g", null, { unit: "g", perServing: 50 }],
			["olive_oil", 1, "pcs", null, { unit: "pcs", perServing: 0.5 }],
			["garlic", 1, "bunch", null, { unit: "bunch", perServing: 0.5 }],
			// What converts is resolved as always, and the same ingredient may appear twice.
			["milk", 0.5, "l", 250, null],
			["salt", 2, "g", 1, null],
		]);
	});

	it("rejects wrong shapes, unknown fields and the vegetarian tag", () => {
		const ok = [{ ingredient: "salt" }];
		expect(problemsOf([recipeFile("x", 0, ok)])[0]).toMatch(/^data\/recipes\/x\.json: servings: /);
		expect(problemsOf([recipeFile("x", 1, ok, { prep_time: 5 })])).toEqual([
			'data/recipes/x.json: unknown field "prep_time"',
		]);
		expect(
			problemsOf([recipeFile("x", 1, [{ ingredient: "salt", aisle: "Pantry" } as never])]),
		).toEqual(['data/recipes/x.json: ingredient 1: unknown field "aisle"']);
		expect(
			problemsOf([recipeFile("x", 1, [{ ingredient: "salt", amount: 0, unit: "g" }])])[0],
		).toMatch(/^data\/recipes\/x\.json: ingredient 1, amount: /);
		expect(problemsOf([recipeFile("x", 1, ok, { steps: ["Mix.", " "] })])[0]).toMatch(
			/^data\/recipes\/x\.json: step 2: /,
		);
		expect(problemsOf([recipeFile("x", 1, [])])[0]).toMatch(
			/^data\/recipes\/x\.json: ingredients: /,
		);
		expect(problemsOf([recipeFile("x", 1, ok, { author: undefined })])[0]).toMatch(
			/x\.json: author: /,
		);
		expect(problemsOf([recipeFile("x", 1, ok, { tags: ["dinner", "vegetarian"] })])).toEqual([
			'data/recipes/x.json: remove the "vegetarian" tag; it is computed from the ingredients',
		]);
		expect(problemsOf([{ ...recipeFile("x", 1, ok), file: "y.json" }])).toEqual([
			'data/recipes/y.json: id "x" does not match the file name',
		]);
		expect(problemsOf([])).toEqual(["data/recipes: no recipe files found"]);
	});

	it("checks images when told which exist", () => {
		const withImage = recipeFile("x", 1, [{ ingredient: "salt" }], { image: "x.svg" });
		expect(problemsOf([withImage])).toEqual([]);
		expect(problemsOf([withImage], DICTIONARY, new Set(["x.svg"]))).toEqual([]);
		expect(problemsOf([withImage], DICTIONARY, new Set(["y.svg"]))).toEqual([
			'data/recipes/x.json: image "x.svg" not found in public/images/',
		]);
		const withPath = recipeFile("x", 1, [{ ingredient: "salt" }], { image: "images/x.svg" });
		expect(problemsOf([withPath])).toEqual([
			'data/recipes/x.json: image must be a file name in public/images/, got "images/x.svg"',
		]);
	});

	it("checks the dictionary", () => {
		const files = [recipeFile("x", 1, [{ ingredient: "salt" }])];
		const salt = { name: "Salt", unit: "g", aisle: "Spices & Oils" };
		const check = (extra: Record<string, unknown>) => problemsOf(files, { salt, ...extra });
		expect(check({ oil: { name: "Oil", unit: "tbsp", aisle: "Pantry" } })[0]).toMatch(
			/^data\/ingredients\.json: oil, unit: /,
		);
		expect(check({ oil: { name: "Oil", unit: "ml", aisle: "Oils" } })[0]).toMatch(/oil, aisle: /);
		expect(check({ oil: { name: "Oil", unit: "ml", category: "Pantry" } })).toContain(
			'data/ingredients.json: oil: unknown field "category"',
		);
		expect(check({ "Olive Oil": { name: "Oil", unit: "ml", aisle: "Pantry" } })[0]).toMatch(
			/snake_case/,
		);
		expect(
			check({ onion: { name: "Onion", unit: "g", aisle: "Produce", count: { perPiece: 0 } } })[0],
		).toMatch(/onion, count, perPiece: /);
		expect(check({ onion: { name: "Onion", unit: "g", aisle: "Produce", count: {} } })).toEqual([
			"data/ingredients.json: onion: count is empty; give it a label, a perPiece, or remove it",
		]);
		expect(
			check({
				onion: {
					name: "Onion",
					unit: "g",
					aisle: "Produce",
					count: { plural: "onions", perPiece: 1 },
				},
			}),
		).toEqual(["data/ingredients.json: onion: count.plural without count.label"]);
		expect(
			check({ sea_salt: { name: "Sea salt", unit: "g", aisle: "Pantry", aliases: ["SALT"] } }),
		).toEqual(['data/ingredients.json: "salt" names both salt and sea_salt']);
		expect(
			check({
				pea: { name: "Pea", unit: "g", aisle: "Frozen" },
				peas: { name: "Frozen peas", unit: "g", aisle: "Frozen" },
			}),
		).toEqual([
			'data/ingredients.json: "pea" (pea) and "peas" (peas) are the same name in singular and plural',
		]);
		expect(problemsOf(files, {})).toContain("data/ingredients.json: the dictionary is empty");
		expect(problemsOf(files, [])[0]).toMatch(/^data\/ingredients\.json: /);
	});
});
