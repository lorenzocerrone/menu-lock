/**
 * The meal plan and its operations (REWRITE_PLAN §5.4). A plan is plain data
 * and every operation returns a new plan (or the same one when nothing
 * changes), so the store can compare by identity.
 */
import type { IsoDate } from "./dates";

/** A planned meal. `servings` absent means the recipe's own. */
export type MealEntry = { recipe: string; servings?: number };

/** A grocery item added by hand, outside any recipe. */
export type Extra =
	/** A dictionary ingredient; summed like recipe lines. No unit is a count of pieces. */
	| { kind: "catalog"; key: string; amount?: number; unit?: string }
	/** Anything else. The quantity is free text, shown as typed. */
	| { kind: "custom"; name: string; quantity: string | null };

/** Days without meals are never stored. */
export type Plan = { dates: Record<IsoDate, MealEntry[]>; extras: Extra[] };

export const EMPTY_PLAN: Plan = { dates: {}, extras: [] };

export function isEmpty(plan: Plan): boolean {
	return Object.keys(plan.dates).length === 0 && plan.extras.length === 0;
}

/** The planned days, in date order. */
export function plannedDates(plan: Plan): IsoDate[] {
	return Object.keys(plan.dates).sort();
}

/** The meals planned for `date` (empty when none). */
export function day(plan: Plan, date: IsoDate): readonly MealEntry[] {
	return plan.dates[date] ?? [];
}

/** Every meal, in date order and each day's order. */
export function entries(plan: Plan): MealEntry[] {
	return plannedDates(plan).flatMap((date) => day(plan, date));
}

/** The meals dated `from` through `to`, in order. */
export function entriesIn(plan: Plan, from: IsoDate, to: IsoDate): MealEntry[] {
	return plannedDates(plan)
		.filter((date) => from <= date && date <= to)
		.flatMap((date) => day(plan, date));
}

export function mealCount(plan: Plan): number {
	return Object.values(plan.dates).reduce((n, meals) => n + meals.length, 0);
}

/** The last date holding a meal. */
export function lastDate(plan: Plan): IsoDate | null {
	return plannedDates(plan).at(-1) ?? null;
}

/** The plan with `date`'s meals replaced; an empty list drops the day. */
function withDay(plan: Plan, date: IsoDate, meals: MealEntry[]): Plan {
	const dates = { ...plan.dates };
	if (meals.length === 0) delete dates[date];
	else dates[date] = meals;
	return { ...plan, dates };
}

/** Append a recipe to a day, with the recipe's own servings. */
export function addMeal(plan: Plan, date: IsoDate, recipe: string): Plan {
	return withDay(plan, date, [...day(plan, date), { recipe }]);
}

/** Remove the `index`-th meal of a day. A day left without meals is dropped. */
export function removeMeal(plan: Plan, date: IsoDate, index: number): Plan {
	const meals = day(plan, date);
	if (!meals[index]) return plan;
	return withDay(
		plan,
		date,
		meals.filter((_, i) => i !== index),
	);
}

/**
 * Move the `index`-th meal of `from` to another day, keeping its servings: to
 * the end, or to position `toIndex`. Returns the new plan and where the meal
 * landed, or `null` (nothing to do) for a missing meal or the same day.
 */
export function moveMeal(
	plan: Plan,
	from: IsoDate,
	index: number,
	to: IsoDate,
	toIndex?: number,
): { plan: Plan; index: number } | null {
	const meal = day(plan, from)[index];
	if (from === to || !meal) return null;
	const target = [...day(plan, to)];
	const at = Math.max(0, Math.min(toIndex ?? target.length, target.length));
	target.splice(at, 0, meal);
	const without = removeMeal(plan, from, index);
	return { plan: withDay(without, to, target), index: at };
}

/** Move a meal within its day from position `from` to position `to`. */
export function reorderMeal(plan: Plan, date: IsoDate, from: number, to: number): Plan {
	const meals = [...day(plan, date)];
	const meal = meals[from];
	if (!meal || from === to || to < 0 || to >= meals.length) return plan;
	meals.splice(from, 1);
	meals.splice(to, 0, meal);
	return withDay(plan, date, meals);
}

/**
 * Set a meal's servings. A count equal to the recipe's own is stored as
 * absent, which keeps links short. Pass `recipeServings` when the recipe is known.
 */
export function setServings(
	plan: Plan,
	date: IsoDate,
	index: number,
	servings: number | undefined,
	recipeServings?: number,
): Plan {
	const meals = day(plan, date);
	const meal = meals[index];
	if (!meal) return plan;
	const next: MealEntry =
		servings === undefined || servings === recipeServings
			? { recipe: meal.recipe }
			: { recipe: meal.recipe, servings };
	if (next.servings === meal.servings) return plan;
	return withDay(
		plan,
		date,
		meals.map((m, i) => (i === index ? next : m)),
	);
}

/** Remove every meal, keeping the extras. */
export function clearMeals(plan: Plan): Plan {
	return { ...plan, dates: {} };
}

/** Forget the days before `today`. Past meals are never shown or shopped for. */
export function dropBefore(plan: Plan, today: IsoDate): Plan {
	const kept = Object.entries(plan.dates).filter(([date]) => date >= today);
	if (kept.length === Object.keys(plan.dates).length) return plan;
	return { ...plan, dates: Object.fromEntries(kept) };
}

export function addExtra(plan: Plan, extra: Extra): Plan {
	return { ...plan, extras: [...plan.extras, extra] };
}

export function removeExtra(plan: Plan, index: number): Plan {
	if (!plan.extras[index]) return plan;
	return { ...plan, extras: plan.extras.filter((_, i) => i !== index) };
}
