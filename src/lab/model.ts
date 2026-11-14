/**
 * The design lab's shared state: the real recipes, a fixture plan from today,
 * and a tickable grocery list. Everything the three directions render comes
 * from here, so they differ only in how they look and move.
 *
 * Phase 1 scaffolding: delete src/lab/ once a direction is chosen.
 */
import { useMemo, useState } from "react";
import { DATA } from "../dataset";
import type { Recipe } from "../lib/data";
import { addDays, type IsoDate, localIsoDate, planDays, weekday } from "../lib/dates";
import {
	EMPTY_QUERY,
	type FilterOption,
	filterRecipes,
	isOn,
	optionCount,
	optionLabel,
	type RecipeQuery,
	toggle,
} from "../lib/filters";
import { formatRange, formatSummary } from "../lib/format";
import {
	aggregate,
	allLines,
	arrange,
	DEFAULT_GROCERY,
	type GroceryAisle,
	type GroceryLine,
	type GroceryState,
	isChecked,
	progress,
	rangeEnd,
	toggleChecked,
} from "../lib/grocery";
import { day, lastDate, type MealEntry, mealCount, type Plan } from "../lib/plan";

export type Screen = "recipes" | "planner" | "grocery";
export const SCREENS: readonly { id: Screen; label: string }[] = [
	{ id: "recipes", label: "Recipes" },
	{ id: "planner", label: "Plan" },
	{ id: "grocery", label: "Grocery" },
];

/** The quick filters shown as chips on the lab's recipe screen. */
const CHIPS: readonly FilterOption[] = [
	{ kind: "diet", value: "veg" },
	{ kind: "time", value: 20 },
	{ kind: "tag", value: "dinner" },
	{ kind: "tag", value: "comfort" },
	{ kind: "cuisine", value: "Italian" },
];

function fixturePlan(today: IsoDate): Plan {
	const d = (n: number) => addDays(today, n);
	return {
		dates: {
			[d(0)]: [{ recipe: "carbonara" }, { recipe: "greek_salad" }],
			[d(1)]: [{ recipe: "lentil_dal", servings: 6 }],
			[d(3)]: [{ recipe: "teriyaki_salmon" }],
			[d(4)]: [{ recipe: "shakshuka" }, { recipe: "pancakes" }],
			[d(6)]: [{ recipe: "margherita_pizza", servings: 4 }],
			[d(8)]: [{ recipe: "mushroom_risotto" }],
		},
		extras: [
			{ kind: "catalog", key: "milk", amount: 1, unit: "l" },
			{ kind: "catalog", key: "egg", amount: 6 },
			{ kind: "custom", name: "Toilet paper", quantity: "1 pack" },
		],
	};
}

/** One day of the planner, ready to draw. */
export type PlanDay = {
	date: IsoDate;
	meals: { entry: MealEntry; recipe: Recipe | undefined }[];
	/** True for the first day of a later week: draw the "next week" divider before it. */
	startsWeek: boolean;
};

export type Chip = { label: string; on: boolean; count: number; toggle: () => void };

export type LabModel = {
	today: IsoDate;
	recipes: Recipe[];
	total: number;
	search: string;
	setSearch: (text: string) => void;
	chips: Chip[];
	days: PlanDay[];
	meals: number;
	aisles: GroceryAisle[];
	isTicked: (key: string) => boolean;
	tick: (line: GroceryLine) => void;
	left: number;
	lines: number;
	range: string;
	summary: string;
};

export function useLabModel(): LabModel {
	const today = useMemo(() => localIsoDate(new Date()), []);
	const plan = useMemo(() => fixturePlan(today), [today]);
	const [query, setQuery] = useState<RecipeQuery>(EMPTY_QUERY);

	const list = useMemo(
		() => aggregate(plan, today, rangeEnd("all", plan, today), DATA),
		[plan, today],
	);
	// Start with a few lines ticked, so the ticked state is visible at once.
	const [state, setState] = useState<GroceryState>(() =>
		allLines(list)
			.filter((line) => ["garlic", "spaghetti", "milk"].includes(line.key))
			.reduce(toggleChecked, DEFAULT_GROCERY),
	);

	const { left, total } = progress(list, state);
	const range = formatRange(today, rangeEnd("all", plan, today), today);
	const meals = mealCount(plan);

	return {
		today,
		recipes: filterRecipes(DATA.recipes, query),
		total: DATA.recipes.length,
		search: query.search,
		setSearch: (search) => setQuery((q) => ({ ...q, search })),
		chips: CHIPS.map((option) => ({
			label: optionLabel(option),
			on: isOn(query, option),
			count: optionCount(DATA.recipes, query, option),
			toggle: () => setQuery((q) => toggle(q, option)),
		})),
		days: planDays(today, lastDate(plan)).map((date) => ({
			date,
			meals: day(plan, date).map((entry) => ({ entry, recipe: DATA.recipeById.get(entry.recipe) })),
			startsWeek: date !== today && weekday(date) === 0,
		})),
		meals,
		aisles: arrange(list, state),
		isTicked: (key) => isChecked(state, key),
		tick: (line) => setState((s) => toggleChecked(s, line)),
		left,
		lines: total,
		range,
		summary: formatSummary(left, total, range, meals),
	};
}

/** The address of a recipe illustration. */
export function imageUrl(recipe: Recipe): string {
	return `${import.meta.env.BASE_URL}images/${recipe.image}`;
}
