/**
 * Load, validate and resolve the data files: the ingredient dictionary and the
 * recipes (REWRITE_PLAN §5.1–5.3). The world is closed: every recipe line
 * names a dictionary key and converts into that ingredient's shopping unit, so
 * each line is resolved once into a per-serving amount and the grocery list
 * only multiplies and adds.
 */
import type { z } from "zod";
import {
	type CountSpec,
	dictionarySchema,
	type Ingredient,
	PLACEHOLDER_IMAGE,
	type RawRecipe,
	recipeSchema,
	VEGETARIAN_TAG,
} from "./schema";
import { convertibleUnits, resolveUnit, toShopping, type Unit } from "./units";

/** The dictionary, with every name it answers to. */
export type Dictionary = {
	/** key → entry, in file order. */
	entries: ReadonlyMap<string, Ingredient>;
	/** normalised key, display name and aliases → key. */
	index: ReadonlyMap<string, string>;
};

/** One ingredient line of a recipe, resolved against the dictionary. */
export type RecipeLine = {
	/** Dictionary key: the grocery line it adds to. */
	key: string;
	/** The dictionary's display name. */
	name: string;
	count?: CountSpec;
	/** As written, for the recipe page. `null` is "to taste". */
	amount: number | null;
	/** The unit as written ("pcs" for a bare count or a piece label). `null` with no amount. */
	unit: Unit | null;
	note?: string;
	optional: boolean;
	/** The amount for one serving, in the shopping unit. `null` is "to taste". */
	perServing: number | null;
};

export type Recipe = {
	id: string;
	title: string;
	author: string;
	servings: number;
	description?: string;
	cuisine?: string;
	tags: string[];
	prepTime?: number;
	cookTime?: number;
	/** File name in public/images/ (the placeholder when the recipe has none). */
	image: string;
	lines: RecipeLine[];
	steps: string[];
	/** Computed: no ingredient from the Meat or Fish aisle. */
	vegetarian: boolean;
	/** Computed: prep + cook minutes, `null` when neither is set. */
	totalTime: number | null;
};

export type Data = {
	dictionary: Dictionary;
	/** Sorted by title. */
	recipes: Recipe[];
	recipeById: ReadonlyMap<string, Recipe>;
};

/** A recipe file as read from disk: its name ("lentil_dal.json") and parsed JSON. */
export type RecipeFile = { file: string; json: unknown };

export const DICTIONARY_PATH = "data/ingredients.json";
export const RECIPES_DIR = "data/recipes";

/** Aisles whose ingredients make a recipe not vegetarian. */
const MEAT_AISLES: readonly string[] = ["Meat", "Fish"];

/** Lowercase, single spaces, underscores as spaces: how names are compared. */
export function normalizeName(name: string): string {
	return name.replaceAll("_", " ").trim().split(/\s+/).join(" ").toLowerCase();
}

/** The spellings tried for a name: as is, without "es", without "s", with "s", with "es". */
function pluralForms(name: string): string[] {
	const forms = [name];
	if (name.endsWith("es")) forms.push(name.slice(0, -2));
	if (name.endsWith("s")) forms.push(name.slice(0, -1));
	forms.push(`${name}s`, `${name}es`);
	return forms.filter((f) => f !== "");
}

/** Every name an entry answers to, normalised: its key, display name and aliases. */
function namesOf(key: string, entry: Ingredient): string[] {
	return [key, entry.name, ...(entry.aliases ?? [])].map(normalizeName);
}

export function buildDictionary(raw: Record<string, Ingredient>): Dictionary {
	const entries = new Map(Object.entries(raw));
	const index = new Map<string, string>();
	for (const [key, entry] of entries) {
		for (const name of namesOf(key, entry)) if (!index.has(name)) index.set(name, key);
	}
	return { entries, index };
}

/**
 * The entry for a name as a person writes it: its key, display name or an
 * alias, ignoring case and extra spaces, singular or plural ("tomatoes" →
 * tomato). Exact otherwise: what the dictionary doesn't know stays unknown.
 */
export function lookup(
	dictionary: Dictionary,
	name: string,
): { key: string; ingredient: Ingredient } | null {
	for (const form of pluralForms(normalizeName(name))) {
		const key = dictionary.index.get(form);
		const ingredient = key === undefined ? undefined : dictionary.entries.get(key);
		if (key !== undefined && ingredient) return { key, ingredient };
	}
	return null;
}

/**
 * One ingredient line for a recipe of `servings`, resolved against the
 * dictionary: used for the lines a planned meal changes or adds. An amount that
 * does not convert for the ingredient becomes "to taste" rather than a wrong
 * number. `null` for a key the dictionary doesn't have.
 */
export function makeLine(
	dictionary: Dictionary,
	key: string,
	amount: number | undefined,
	unitText: string | undefined,
	servings: number,
	keep: { note?: string | undefined; optional?: boolean } = {},
): RecipeLine | null {
	const entry = dictionary.entries.get(key);
	if (!entry) return null;
	const line: RecipeLine = {
		key,
		name: entry.name,
		amount: null,
		unit: null,
		optional: keep.optional ?? false,
		perServing: null,
	};
	if (entry.count) line.count = entry.count;
	if (keep.note !== undefined) line.note = keep.note;
	const unit = resolveUnit(unitText, entry.count);
	const inShoppingUnit =
		amount === undefined || !(amount > 0) || unit === null
			? null
			: toShopping(amount, unit, entry.unit, entry.count);
	if (amount !== undefined && unit !== null && inShoppingUnit !== null) {
		line.amount = amount;
		line.unit = unit;
		line.perServing = inShoppingUnit / servings;
	}
	return line;
}

function describePath(path: PropertyKey[]): string {
	const parts: string[] = [];
	for (let i = 0; i < path.length; i++) {
		const part = path[i];
		const next = path[i + 1];
		if ((part === "ingredients" || part === "steps") && typeof next === "number") {
			parts.push(`${part === "steps" ? "step" : "ingredient"} ${next + 1}`);
			i++;
		} else {
			parts.push(String(part));
		}
	}
	return parts.join(", ");
}

function zodProblems(where: string, error: z.ZodError): string[] {
	return error.issues.map((issue) => {
		const at = describePath(issue.path);
		const what =
			issue.code === "unrecognized_keys"
				? `unknown field ${issue.keys.map((k) => `"${k}"`).join(", ")}`
				: issue.code === "invalid_key"
					? "the key must be snake_case: a-z, 0-9 and single underscores"
					: issue.message;
		return `${where}: ${at ? `${at}: ` : ""}${what}`;
	});
}

function dictionaryProblems(raw: Record<string, Ingredient>): string[] {
	const problems: string[] = [];
	const owner = new Map<string, string>();
	for (const [key, entry] of Object.entries(raw)) {
		const at = `${DICTIONARY_PATH}: ${key}`;
		if (entry.count) {
			if (entry.count.plural && !entry.count.label)
				problems.push(`${at}: count.plural without count.label`);
			if (!entry.count.label && entry.count.perPiece === undefined)
				problems.push(`${at}: count is empty; give it a label, a perPiece, or remove it`);
		}
		for (const name of new Set(namesOf(key, entry))) {
			const other = owner.get(name);
			if (other !== undefined && other !== key)
				problems.push(`${DICTIONARY_PATH}: "${name}" names both ${other} and ${key}`);
			else owner.set(name, key);
		}
	}
	// Singular and plural are the same name: "pea" and "peas" can't be two entries.
	for (const [name, key] of owner) {
		for (const form of pluralForms(name).slice(1)) {
			const other = owner.get(form);
			if (other !== undefined && other !== key && key < other)
				problems.push(
					`${DICTIONARY_PATH}: "${name}" (${key}) and "${form}" (${other}) are the same name in singular and plural`,
				);
		}
	}
	return problems;
}

function resolveRecipe(
	raw: RawRecipe,
	where: string,
	dictionary: Dictionary,
	images: ReadonlySet<string> | undefined,
	problems: string[],
): Recipe {
	const lines: RecipeLine[] = [];
	let vegetarian = true;
	raw.ingredients.forEach((line, i) => {
		const at = `${where}, ingredient ${i + 1} (${line.ingredient})`;
		const entry = dictionary.entries.get(line.ingredient);
		if (!entry) {
			const near = lookup(dictionary, line.ingredient);
			problems.push(
				near
					? `${at}: "${line.ingredient}" is not a key in ${DICTIONARY_PATH}; use "${near.key}"`
					: `${at}: "${line.ingredient}" is not in ${DICTIONARY_PATH}; add it there first`,
			);
			return;
		}
		if (MEAT_AISLES.includes(entry.aisle)) vegetarian = false;
		const resolved: RecipeLine = {
			key: line.ingredient,
			name: entry.name,
			amount: null,
			unit: null,
			optional: line.optional ?? false,
			perServing: null,
		};
		if (entry.count) resolved.count = entry.count;
		if (line.note !== undefined) resolved.note = line.note;
		if (line.amount === undefined) {
			if (line.unit !== undefined)
				problems.push(`${at}: "unit" without "amount" ("to taste" has no unit)`);
		} else {
			const written = `${line.amount}${line.unit === undefined ? "" : ` ${line.unit}`}`;
			const unit = resolveUnit(line.unit, entry.count);
			const usable = convertibleUnits(entry.unit, entry.count).join(", ");
			if (unit === null) {
				problems.push(
					`${at}: "${line.unit}" is not a unit, nor the piece label of ${line.ingredient}. Use one of: ${usable}`,
				);
			} else {
				const inShoppingUnit = toShopping(line.amount, unit, entry.unit, entry.count);
				if (inShoppingUnit === null) {
					const what =
						line.unit === undefined ? `"${written}" (a count of pieces)` : `"${written}"`;
					problems.push(
						`${at}: ${what} does not convert into ${entry.unit}, the shopping unit of ${line.ingredient}. Use one of: ${usable}; or add "count" to ${line.ingredient} in ${DICTIONARY_PATH}`,
					);
				} else {
					resolved.amount = line.amount;
					resolved.unit = unit;
					resolved.perServing = inShoppingUnit / raw.servings;
				}
			}
		}
		lines.push(resolved);
	});

	if (raw.tags?.includes(VEGETARIAN_TAG))
		problems.push(
			`${where}: remove the "${VEGETARIAN_TAG}" tag; it is computed from the ingredients`,
		);
	if (raw.image !== undefined) {
		if (raw.image.includes("/"))
			problems.push(`${where}: image must be a file name in public/images/, got "${raw.image}"`);
		else if (images && !images.has(raw.image))
			problems.push(`${where}: image "${raw.image}" not found in public/images/`);
	}

	const recipe: Recipe = {
		id: raw.id,
		title: raw.title,
		author: raw.author,
		servings: raw.servings,
		tags: raw.tags ?? [],
		image: raw.image ?? PLACEHOLDER_IMAGE,
		lines,
		steps: raw.steps,
		vegetarian,
		totalTime:
			raw.prepTime === undefined && raw.cookTime === undefined
				? null
				: (raw.prepTime ?? 0) + (raw.cookTime ?? 0),
	};
	if (raw.description !== undefined) recipe.description = raw.description;
	if (raw.cuisine !== undefined) recipe.cuisine = raw.cuisine;
	if (raw.prepTime !== undefined) recipe.prepTime = raw.prepTime;
	if (raw.cookTime !== undefined) recipe.cookTime = raw.cookTime;
	return recipe;
}

/**
 * Validate and resolve everything. `problems` lists every violation in plain
 * words, each naming its file (and ingredient line); `data` is `null` unless
 * there are none. Pass `images` (the file names in public/images/) to also
 * check that every recipe image exists.
 */
export function loadData(
	rawDictionary: unknown,
	recipeFiles: readonly RecipeFile[],
	options: { images?: ReadonlySet<string> } = {},
): { data: Data | null; problems: string[] } {
	const problems: string[] = [];

	const parsedDictionary = dictionarySchema.safeParse(rawDictionary);
	if (!parsedDictionary.success) {
		problems.push(...zodProblems(DICTIONARY_PATH, parsedDictionary.error));
		return { data: null, problems };
	}
	if (Object.keys(parsedDictionary.data).length === 0)
		problems.push(`${DICTIONARY_PATH}: the dictionary is empty`);
	problems.push(...dictionaryProblems(parsedDictionary.data));
	const dictionary = buildDictionary(parsedDictionary.data);

	if (recipeFiles.length === 0) problems.push(`${RECIPES_DIR}: no recipe files found`);
	const recipes: Recipe[] = [];
	const recipeById = new Map<string, Recipe>();
	for (const { file, json } of [...recipeFiles].sort((a, b) => (a.file < b.file ? -1 : 1))) {
		const where = `${RECIPES_DIR}/${file}`;
		const parsed = recipeSchema.safeParse(json);
		if (!parsed.success) {
			problems.push(...zodProblems(where, parsed.error));
			continue;
		}
		const stem = file.replace(/\.json$/, "");
		if (parsed.data.id !== stem)
			problems.push(`${where}: id "${parsed.data.id}" does not match the file name`);
		if (recipeById.has(parsed.data.id)) problems.push(`${where}: duplicate id "${parsed.data.id}"`);
		const recipe = resolveRecipe(parsed.data, where, dictionary, options.images, problems);
		recipes.push(recipe);
		recipeById.set(recipe.id, recipe);
	}
	recipes.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));

	if (problems.length > 0) return { data: null, problems };
	return { data: { dictionary, recipes, recipeById }, problems };
}
