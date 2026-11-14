import { describe, expect, it } from "vitest";
import {
	activeCount,
	activeOptions,
	clearFilters,
	EMPTY_QUERY,
	type FilterOption,
	facets,
	filterRecipes,
	optionCount,
	optionLabel,
	queryFromSearch,
	queryToSearch,
	type RecipeQuery,
	toggle,
} from "./filters";
import { fixtureData, recipeFile } from "./fixtures";

const veg = [{ ingredient: "salt" }];
const meat = [{ ingredient: "guanciale", amount: 100, unit: "g" }];

// Titles chosen so the title order is carbonara, salad, oats, dal.
const { recipes } = fixtureData([
	recipeFile("carbonara", 2, meat, {
		title: "A Spaghetti Carbonara",
		author: "Claude",
		cuisine: "Italian",
		tags: ["pasta", "quick", "dinner"],
		description: "Roman classic",
		prepTime: 10,
		cookTime: 15,
	}),
	recipeFile("salad", 2, veg, {
		title: "B Greek Salad",
		author: "Lorenzo",
		cuisine: "Greek",
		tags: ["salad", "quick"],
		description: "Crunchy and fresh",
		prepTime: 15,
	}),
	recipeFile("oats", 1, veg, {
		title: "C Overnight Oats",
		author: "Lorenzo",
		cuisine: "American",
		tags: ["breakfast"],
	}),
	recipeFile("dal", 4, veg, {
		title: "D Lentil Dal",
		author: "Anna",
		cuisine: "Indian",
		tags: ["dinner"],
		prepTime: 10,
		cookTime: 30,
	}),
]);

const ids = (query: RecipeQuery) => filterRecipes(recipes, query).map((r) => r.id);
const query = (...options: FilterOption[]) => options.reduce(toggle, EMPTY_QUERY);
const diet = (value: "veg" | "meat"): FilterOption => ({ kind: "diet", value });
const author = (value: string): FilterOption => ({ kind: "author", value });
const cuisine = (value: string): FilterOption => ({ kind: "cuisine", value });
const tag = (value: string): FilterOption => ({ kind: "tag", value });
const time = (value: number): FilterOption => ({ kind: "time", value });

describe("filters", () => {
	it("returns everything for an empty query", () => {
		expect(ids(EMPTY_QUERY)).toEqual(["carbonara", "salad", "oats", "dal"]);
	});

	it("searches title and description, case-insensitive", () => {
		expect(ids({ ...EMPTY_QUERY, search: "greek" })).toEqual(["salad"]);
		expect(ids({ ...EMPTY_QUERY, search: " roman " })).toEqual(["carbonara"]);
	});

	it("matches any selected author, cuisine or diet", () => {
		expect(ids(query(author("Lorenzo"), author("Anna")))).toEqual(["salad", "oats", "dal"]);
		expect(ids(query(cuisine("Italian"), cuisine("Indian")))).toEqual(["carbonara", "dal"]);
		expect(ids(query(diet("meat")))).toEqual(["carbonara"]);
		expect(ids(query(diet("veg")))).toEqual(["salad", "oats", "dal"]);
		expect(ids(query(diet("meat"), diet("veg")))).toHaveLength(4);
	});

	it("requires all selected tags, and combines the sections with AND", () => {
		expect(ids(query(tag("quick"), tag("dinner")))).toEqual(["carbonara"]);
		const vegByLorenzoQuick = query(diet("veg"), author("Lorenzo"), tag("quick"));
		expect(ids(vegByLorenzoQuick)).toEqual(["salad"]);
		expect(ids({ ...vegByLorenzoQuick, search: "oats" })).toEqual([]);
	});

	it("keeps timed recipes at or under the cap; one cap at a time", () => {
		// Oats have no time set and so never pass a cap.
		expect(ids(query(time(20)))).toEqual(["salad"]);
		expect(ids(query(time(40)))).toEqual(["carbonara", "salad", "dal"]);
		const replaced = query(time(20), time(40));
		expect(replaced.maxMinutes).toBe(40);
		expect(toggle(replaced, time(40)).maxMinutes).toBeNull();
	});

	it("counts what each option would give", () => {
		const onlyVeg = query(diet("veg"));
		expect(optionCount(recipes, onlyVeg, tag("dinner"))).toBe(1);
		expect(optionCount(recipes, onlyVeg, cuisine("Italian"))).toBe(0);
		// A selected option counts its own recipes, and so do its neighbours.
		expect(optionCount(recipes, onlyVeg, diet("veg"))).toBe(3);
		expect(optionCount(recipes, onlyVeg, diet("meat"))).toBe(1);
		const lorenzo = query(author("Lorenzo"));
		expect(optionCount(recipes, lorenzo, author("Anna"))).toBe(1);
		expect(optionCount(recipes, lorenzo, author("Lorenzo"))).toBe(2);
		// A time cap stands in for the selected one.
		expect(optionCount(recipes, query(time(20)), time(40))).toBe(3);
		// A tag is added to the selected tags.
		expect(optionCount(recipes, query(tag("quick")), tag("dinner"))).toBe(1);
	});

	it("lists the active chips in sheet order, and clears keeping the search", () => {
		const q = { ...query(tag("quick"), time(20), diet("veg"), author("Anna")), search: "salad" };
		expect(activeCount(q)).toBe(4);
		expect(activeOptions(q).map(optionLabel)).toEqual([
			"vegetarian",
			"by Anna",
			"≤20 min",
			"quick",
		]);
		expect(optionLabel(diet("meat"))).toBe("meat & fish");
		expect(clearFilters(q)).toEqual({ ...EMPTY_QUERY, search: "salad" });
	});

	it("toggles off, and keeps selections sorted", () => {
		expect(toggle(query(tag("quick")), tag("quick"))).toEqual(EMPTY_QUERY);
		expect(query(tag("quick"), tag("dinner")).tags).toEqual(["dinner", "quick"]);
		expect(query(diet("meat"), diet("veg")).diet).toEqual(["veg", "meat"]);
		expect(EMPTY_QUERY.tags).toEqual([]);
	});

	it("round-trips through URL search params and ignores garbage", () => {
		const q: RecipeQuery = {
			...query(
				diet("veg"),
				author("Anna Maria"),
				author("Lorenzo"),
				cuisine("Middle Eastern"),
				tag("make-ahead"),
				tag("sweet, sour"),
				time(20),
			),
			search: "dal & rice",
		};
		const search = queryToSearch(q);
		expect(search).toEqual({
			q: "dal & rice",
			diet: "veg",
			by: "Anna Maria,Lorenzo",
			cuisine: "Middle Eastern",
			tag: "make-ahead,sweet%2C sour",
			time: 20,
		});
		expect(queryFromSearch(search)).toEqual(q);
		expect(queryToSearch(EMPTY_QUERY)).toEqual({});
		expect(queryFromSearch({})).toEqual(EMPTY_QUERY);
		expect(
			queryFromSearch({ diet: "fish", time: "soon", x: 1, by: "", tag: null, plan: "abc" }),
		).toEqual(EMPTY_QUERY);
		expect(queryFromSearch({ time: 0 }).maxMinutes).toBeNull();
		expect(queryFromSearch({ time: "40" }).maxMinutes).toBe(40);
		expect(queryFromSearch({ diet: "meat,veg,veg" }).diet).toEqual(["veg", "meat"]);
		// The router parses bare numbers and booleans; they are still text here.
		expect(queryFromSearch({ q: 20, tag: true })).toEqual({
			...EMPTY_QUERY,
			search: "20",
			tags: ["true"],
		});
	});

	it("computes the facets from the data", () => {
		expect(facets(recipes)).toEqual({
			authors: ["Anna", "Claude", "Lorenzo"],
			cuisines: ["American", "Greek", "Indian", "Italian"],
			tags: ["breakfast", "dinner", "pasta", "quick", "salad"],
		});
	});
});
