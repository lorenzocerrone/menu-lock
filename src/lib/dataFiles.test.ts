/**
 * Validation of the real data files: `npm run check` fails, naming the file
 * and the line, when a recipe or the dictionary breaks a rule. The add-recipe
 * skill reads these messages.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadData } from "./data";
import { formatLineQuantity } from "./format";
import { aggregate, allLines } from "./grocery";
import { addMeal, EMPTY_PLAN } from "./plan";
import { jsonSchemas, PLACEHOLDER_IMAGE } from "./schema";

const root = join(import.meta.dirname, "../..");
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), "utf8"));

function loadFiles() {
	const images = new Set(readdirSync(join(root, "public/images")));
	const files = readdirSync(join(root, "data/recipes"))
		.filter((file) => file.endsWith(".json"))
		.map((file) => {
			try {
				return { file, json: readJson(`data/recipes/${file}`) };
			} catch (error) {
				throw new Error(`data/recipes/${file} is not valid JSON: ${String(error)}`);
			}
		});
	return { images, ...loadData(readJson("data/ingredients.json"), files, { images }) };
}

it("every data file is valid", () => {
	const { problems, images } = loadFiles();
	expect(images.has(PLACEHOLDER_IMAGE), `public/images/${PLACEHOLDER_IMAGE} must exist`).toBe(true);
	// Shown one per line, so a data pass reads as a checklist.
	expect(problems.join("\n")).toBe("");
});

it("every recipe's grocery list is one amount in one unit per line", () => {
	const { data } = loadFiles();
	if (!data) throw new Error("the data must load (see the test above)");
	expect(data.recipes.length).toBeGreaterThan(0);
	for (const recipe of data.recipes) {
		const plan = addMeal(EMPTY_PLAN, "2026-01-01", recipe.id);
		const lines = allLines(aggregate(plan, "2026-01-01", "2026-01-01", data));
		expect(lines.length, recipe.id).toBeGreaterThan(0);
		for (const line of lines)
			expect(formatLineQuantity(line), `${recipe.id}: ${line.key}`).not.toBe("");
	}
});

it("the JSON Schemas in schema/ are up to date (npm run schema)", () => {
	for (const [file, schema] of Object.entries(jsonSchemas())) {
		expect(readJson(`schema/${file}`), `schema/${file}`).toEqual(
			JSON.parse(JSON.stringify(schema)),
		);
	}
});
