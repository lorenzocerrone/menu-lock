/**
 * The single definition of the data files (REWRITE_PLAN §5.1, §5.2): TypeScript
 * types, validation and the JSON Schemas in schema/ all come from these.
 * Shape only; the rules that need the dictionary (does this key exist, does
 * this amount convert) live in data.ts.
 */
import { z } from "zod";

/** Grocery aisles, in display order. Hand-typed extras go to OTHER_AISLE, always last. */
export const AISLES = [
	"Produce",
	"Meat",
	"Fish",
	"Dairy & Eggs",
	"Pasta & Grains",
	"Bakery",
	"Legumes",
	"Pantry",
	"Frozen",
	"Spices & Oils",
] as const;
export type Aisle = (typeof AISLES)[number];
export const OTHER_AISLE = "Other";

/** The units an ingredient can be bought and summed in. */
export const SHOPPING_UNITS = ["g", "ml", "pcs"] as const;
export type ShoppingUnit = (typeof SHOPPING_UNITS)[number];

const text = z.string().trim().min(1);

export const countSchema = z
	.strictObject({
		label: text.optional().describe('What one piece is called: "clove", "can", "fillet".'),
		plural: text.optional().describe('Plural of the label, if it is not label + "s".'),
		perPiece: z
			.number()
			.positive()
			.optional()
			.describe(
				"One piece in the shopping unit (g or ml). For a pcs ingredient: the grams in one piece.",
			),
	})
	.describe("How the ingredient is counted in pieces.");
export type CountSpec = z.infer<typeof countSchema>;

export const ingredientSchema = z.strictObject({
	name: text.describe("Display name, capitalised: shown on the recipe and the grocery list."),
	unit: z.enum(SHOPPING_UNITS).describe("The shopping unit: how it is bought and summed."),
	aisle: z.enum(AISLES).describe("Grocery aisle. Meat and Fish make a recipe non-vegetarian."),
	count: countSchema.optional(),
	aliases: z.array(text).optional().describe("Other names for the same thing to buy."),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

/** Dictionary keys and recipe ids: snake_case, stable forever (they are in share links). */
export const KEY_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/;
const key = z.string().regex(KEY_PATTERN, "must be snake_case: a-z, 0-9 and single underscores");

export const dictionarySchema = z
	.record(key, ingredientSchema)
	.describe("The ingredient dictionary: key → entry.");
export type RawDictionary = z.infer<typeof dictionarySchema>;

export const recipeLineSchema = z.strictObject({
	ingredient: key.describe("A key of data/ingredients.json."),
	amount: z.number().positive().optional().describe('Absent means "to taste".'),
	unit: text
		.optional()
		.describe(
			"g kg ml l tsp tbsp cup pcs, or the ingredient's piece label. Absent means a count of pieces.",
		),
	note: text.optional().describe('Shown after the name: "finely chopped".'),
	optional: z.boolean().optional(),
});
export type RawRecipeLine = z.infer<typeof recipeLineSchema>;

export const recipeSchema = z.strictObject({
	id: key.describe("Equals the file name. Never changes once published."),
	title: text,
	author: text,
	servings: z.number().int().min(1),
	description: text.optional(),
	cuisine: text.optional(),
	tags: z.array(text).optional(),
	prepTime: z.number().int().min(0).optional().describe("Minutes."),
	cookTime: z.number().int().min(0).optional().describe("Minutes."),
	image: text.optional().describe("A file in public/images/. Absent means the shared placeholder."),
	ingredients: z.array(recipeLineSchema).min(1),
	steps: z.array(text).min(1),
});
export type RawRecipe = z.infer<typeof recipeSchema>;

/** The tag that is computed from the ingredients and so never written. */
export const VEGETARIAN_TAG = "vegetarian";

/** The image used when a recipe has none. */
export const PLACEHOLDER_IMAGE = "placeholder.svg";

/** JSON Schemas for editor autocomplete (written to schema/ by scripts/gen-schema.ts). */
export function jsonSchemas(): Record<string, unknown> {
	return {
		"recipe.schema.json": z.toJSONSchema(recipeSchema),
		"ingredients.schema.json": z.toJSONSchema(dictionarySchema),
	};
}
