/**
 * Recipe search and filters (REWRITE_PLAN §6.1).
 *
 * Diet, author and cuisine match **any** selected value (a recipe has one of
 * each); tags match **all** selected (they are attributes: "quick" + "dinner"
 * means quick dinners); a time cap keeps recipes at or under it; the sections
 * combine with AND. The query travels in the URL as search params.
 */
import type { Recipe } from "./data";

export type Diet = "veg" | "meat";
export const DIETS: readonly Diet[] = ["veg", "meat"];

/** The time caps offered, in minutes of prep + cook. */
export const TIME_CAPS: readonly number[] = [20, 40];

/** The active search and filters. Empty fields mean "no constraint". Lists are sorted and unique. */
export type RecipeQuery = {
	/** Free text over title and description, case-insensitive. */
	search: string;
	diet: Diet[];
	authors: string[];
	cuisines: string[];
	/** All of these tags are required. */
	tags: string[];
	/** Keep recipes whose total time is at most this many minutes. */
	maxMinutes: number | null;
};

export const EMPTY_QUERY: RecipeQuery = {
	search: "",
	diet: [],
	authors: [],
	cuisines: [],
	tags: [],
	maxMinutes: null,
};

/** One selectable value in the filter sheet, or one active-filter chip. */
export type FilterOption =
	| { kind: "diet"; value: Diet }
	| { kind: "author"; value: string }
	| { kind: "cuisine"; value: string }
	| { kind: "tag"; value: string }
	| { kind: "time"; value: number };

/** The chip label: "vegetarian", "by Lorenzo", "≤20 min". */
export function optionLabel(option: FilterOption): string {
	switch (option.kind) {
		case "diet":
			return option.value === "veg" ? "vegetarian" : "meat & fish";
		case "author":
			return `by ${option.value}`;
		case "time":
			return `≤${option.value} min`;
		default:
			return option.value;
	}
}

function dietOf(recipe: Recipe): Diet {
	return recipe.vegetarian ? "veg" : "meat";
}

function matches(query: RecipeQuery, recipe: Recipe): boolean {
	const q = query.search.trim().toLowerCase();
	const text =
		q === "" ||
		recipe.title.toLowerCase().includes(q) ||
		(recipe.description?.toLowerCase().includes(q) ?? false);
	return (
		text &&
		(query.diet.length === 0 || query.diet.includes(dietOf(recipe))) &&
		(query.authors.length === 0 || query.authors.includes(recipe.author)) &&
		(query.cuisines.length === 0 ||
			(recipe.cuisine !== undefined && query.cuisines.includes(recipe.cuisine))) &&
		query.tags.every((tag) => recipe.tags.includes(tag)) &&
		(query.maxMinutes === null ||
			(recipe.totalTime !== null && recipe.totalTime <= query.maxMinutes))
	);
}

/** The recipes matching `query`, in their given order. */
export function filterRecipes(recipes: readonly Recipe[], query: RecipeQuery): Recipe[] {
	return recipes.filter((recipe) => matches(query, recipe));
}

export function isOn(query: RecipeQuery, option: FilterOption): boolean {
	switch (option.kind) {
		case "diet":
			return query.diet.includes(option.value);
		case "author":
			return query.authors.includes(option.value);
		case "cuisine":
			return query.cuisines.includes(option.value);
		case "tag":
			return query.tags.includes(option.value);
		case "time":
			return query.maxMinutes === option.value;
	}
}

const sortedUnique = <T extends string>(values: Iterable<T>): T[] => [...new Set(values)].sort();

function flip<T extends string>(list: readonly T[], value: T): T[] {
	return list.includes(value) ? list.filter((v) => v !== value) : sortedUnique([...list, value]);
}

/** Select or deselect `option`. A time cap replaces any other cap. */
export function toggle(query: RecipeQuery, option: FilterOption): RecipeQuery {
	switch (option.kind) {
		case "diet":
			// "veg" sorts after "meat"; keep sheet order instead.
			return { ...query, diet: DIETS.filter((d) => flip(query.diet, option.value).includes(d)) };
		case "author":
			return { ...query, authors: flip(query.authors, option.value) };
		case "cuisine":
			return { ...query, cuisines: flip(query.cuisines, option.value) };
		case "tag":
			return { ...query, tags: flip(query.tags, option.value) };
		case "time":
			return { ...query, maxMinutes: query.maxMinutes === option.value ? null : option.value };
	}
}

/** The selected options, in sheet order (the active-filter chips). */
export function activeOptions(query: RecipeQuery): FilterOption[] {
	return [
		...query.diet.map((value): FilterOption => ({ kind: "diet", value })),
		...query.authors.map((value): FilterOption => ({ kind: "author", value })),
		...query.cuisines.map((value): FilterOption => ({ kind: "cuisine", value })),
		...(query.maxMinutes === null ? [] : [{ kind: "time", value: query.maxMinutes } as const]),
		...query.tags.map((value): FilterOption => ({ kind: "tag", value })),
	];
}

/** Number of selected options (the "Filters · N" button). */
export function activeCount(query: RecipeQuery): number {
	return activeOptions(query).length;
}

/** Drop every filter, keeping the search text. */
export function clearFilters(query: RecipeQuery): RecipeQuery {
	return { ...EMPTY_QUERY, search: query.search };
}

/**
 * The count shown next to an option: how many recipes it would give. For the
 * any-of sections and the time cap the option stands in for its section's
 * selection; a tag is added to the selected tags.
 */
export function optionCount(
	recipes: readonly Recipe[],
	query: RecipeQuery,
	option: FilterOption,
): number {
	let q: RecipeQuery;
	switch (option.kind) {
		case "diet":
			q = { ...query, diet: [option.value] };
			break;
		case "author":
			q = { ...query, authors: [option.value] };
			break;
		case "cuisine":
			q = { ...query, cuisines: [option.value] };
			break;
		case "tag":
			q = { ...query, tags: sortedUnique([...query.tags, option.value]) };
			break;
		case "time":
			q = { ...query, maxMinutes: option.value };
			break;
	}
	return filterRecipes(recipes, q).length;
}

/** The values present in the recipes, for the filter sheet's sections. Computed from the data. */
export type Facets = { authors: string[]; cuisines: string[]; tags: string[] };

export function facets(recipes: readonly Recipe[]): Facets {
	return {
		authors: sortedUnique(recipes.map((r) => r.author)),
		cuisines: sortedUnique(recipes.flatMap((r) => (r.cuisine === undefined ? [] : [r.cuisine]))),
		tags: sortedUnique(recipes.flatMap((r) => r.tags)),
	};
}

/**
 * The query as URL search params: `q`, `diet=veg,meat`, `by`, `cuisine`, `tag`
 * (comma lists) and `time=20`. Only what is set is present.
 */
export type QuerySearch = {
	q?: string;
	diet?: string;
	by?: string;
	cuisine?: string;
	tag?: string;
	time?: number;
};

// A comma inside a value must not split it.
const escapeValue = (v: string) => v.replaceAll("%", "%25").replaceAll(",", "%2C");
const unescapeValue = (v: string) => v.replaceAll("%2C", ",").replaceAll("%25", "%");
const joinValues = (values: readonly string[]) => values.map(escapeValue).join(",");

export function queryToSearch(query: RecipeQuery): QuerySearch {
	const search: QuerySearch = {};
	if (query.search.trim() !== "") search.q = query.search.trim();
	if (query.diet.length > 0) search.diet = query.diet.join(",");
	if (query.authors.length > 0) search.by = joinValues(query.authors);
	if (query.cuisines.length > 0) search.cuisine = joinValues(query.cuisines);
	if (query.tags.length > 0) search.tag = joinValues(query.tags);
	if (query.maxMinutes !== null) search.time = query.maxMinutes;
	return search;
}

/**
 * Read search params back into a query. Values arrive as whatever the router
 * parsed (a number for `time=20`, even for `q=20`); unknown keys and unreadable
 * values are ignored.
 */
export function queryFromSearch(search: Record<string, unknown>): RecipeQuery {
	const text = (key: string): string => {
		const value = search[key];
		return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
			? String(value)
			: "";
	};
	const list = (key: string) =>
		sortedUnique(
			text(key)
				.split(",")
				.map((v) => unescapeValue(v).trim())
				.filter((v) => v !== ""),
		);
	const selected = list("diet");
	const minutes = Number(text("time"));
	return {
		search: text("q").trim(),
		diet: DIETS.filter((d) => selected.includes(d)),
		authors: list("by"),
		cuisines: list("cuisine"),
		tags: list("tag"),
		maxMinutes: text("time") !== "" && Number.isInteger(minutes) && minutes > 0 ? minutes : null,
	};
}
