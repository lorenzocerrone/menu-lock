/**
 * Every user-facing number, date and quantity string. Pure: the UI calls into
 * here, so what something says is decided (and tested) in one place.
 */

import type { PlannedLine } from "./changes";
import type { Dictionary, Recipe, RecipeLine } from "./data";
import { daysUntil, type IsoDate, MONTH_SHORT, WEEKDAY_SHORT, weekday, ymd } from "./dates";
import type { GroceryAisle, GroceryLine } from "./grocery";
import { type Extra, isNote, type MealEntry } from "./plan";
import type { CountSpec } from "./schema";
import { labelFor, type Unit } from "./units";

/** At most `max` decimals, trailing zeros dropped: 1.50 → "1.5", 2.00 → "2", 0.333 → "0.33". */
export function trimDecimals(n: number, max: number): string {
	const s = n.toFixed(max);
	return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/**
 * A quantity as authored in a recipe: at most two decimals, then the unit, or
 * the ingredient's piece label for counts ("3 cloves"), or nothing ("4").
 */
export function formatQuantity(amount: number, unit: Unit, count: CountSpec | undefined): string {
	const num = trimDecimals(amount, 2);
	if (unit !== "pcs") return `${num} ${unit}`;
	const label = labelFor(count, amount);
	return label ? `${num} ${label}` : num;
}

/**
 * The amount column of a recipe line, rescaled from the recipe's servings to
 * `servings`. "To taste" never scales.
 */
export function formatLineAmount(
	line: RecipeLine,
	servings: number,
	recipeServings: number,
): string {
	if (line.amount === null || line.unit === null) return "to taste";
	return formatQuantity((line.amount * servings) / recipeServings, line.unit, line.count);
}

/** Mass or volume with a step up to the large unit at 1000. */
function scaled(amount: number, small: string, big: string): string {
	if (amount >= 1000) return `${trimDecimals(amount / 1000, 2)} ${big}`;
	return `${trimDecimals(amount, amount < 10 ? 1 : 0)} ${small}`;
}

/**
 * A summed grocery amount in shop-friendly numbers: g below 1 kg (one decimal
 * under 10 g) then kg; ml and l likewise; pieces rounded up to whole items and
 * labelled ("2 cans"), bare without a label ("4").
 */
export function formatGroceryAmount(
	amount: number,
	line: Pick<GroceryLine, "unit" | "count">,
): string {
	if (line.unit === "g") return scaled(amount, "g", "kg");
	if (line.unit === "ml") return scaled(amount, "ml", "l");
	const n = Math.max(0, Math.ceil(amount - 1e-6));
	const label = labelFor(line.count, n);
	return label ? `${n} ${label}` : String(n);
}

/**
 * The quantity text of a grocery line: its amount, any custom quantities and
 * "to taste" joined with " + ", then "(optional)". Empty when there is nothing to say.
 */
export function formatLineQuantity(line: GroceryLine): string {
	const parts: string[] = [];
	if (line.amount !== null) parts.push(formatGroceryAmount(line.amount, line));
	parts.push(...line.customQuantities);
	if (line.toTaste) parts.push("to taste");
	const out = parts.join(" + ");
	return line.optional ? `${out} (optional)`.trim() : out;
}

/** What a grocery line is for: the recipes that need it, and "extra". */
export function formatSources(line: GroceryLine): string {
	return [...line.sources, ...(line.extra ? ["extra"] : [])].join(", ");
}

/** The whole list as plain text, for copying. */
export function formatText(aisles: readonly GroceryAisle[]): string {
	if (aisles.length === 0) return "No meals selected yet.";
	return aisles
		.map((aisle) =>
			[
				aisle.name,
				...aisle.lines.map((line) => {
					const quantity = formatLineQuantity(line);
					return quantity ? `- ${line.name}: ${quantity}` : `- ${line.name}`;
				}),
			].join("\n"),
		)
		.join("\n\n");
}

/** "N of M left to buy · <range> · <K meals>". */
export function formatSummary(left: number, total: number, range: string, meals: number): string {
	return `${left} of ${total} left to buy · ${range} · ${meals} ${meals === 1 ? "meal" : "meals"}`;
}

/** How many a recipe or a planned meal is for: "serves 4". */
export function formatServes(servings: number): string {
	return `serves ${servings}`;
}

/** The facts under a recipe's title: "25 min", "Italian", "serves 2", leaving out what it lacks. */
export function formatRecipeMeta(
	recipe: Pick<Recipe, "totalTime" | "cuisine" | "servings">,
): string[] {
	return [formatTotalTime(recipe), recipe.cuisine, formatServes(recipe.servings)].filter(
		(part): part is string => !!part,
	);
}

/** Total time as a short label ("40 min"), if any time is set. */
export function formatTotalTime(recipe: Pick<Recipe, "totalTime">): string | null {
	return recipe.totalTime === null ? null : `${recipe.totalTime} min`;
}

/** "10 min prep + 15 min cook", leaving out absent parts; empty when neither is set. */
export function formatTiming(recipe: Pick<Recipe, "prepTime" | "cookTime">): string {
	const parts: string[] = [];
	if (recipe.prepTime !== undefined) parts.push(`${recipe.prepTime} min prep`);
	if (recipe.cookTime !== undefined) parts.push(`${recipe.cookTime} min cook`);
	return parts.join(" + ");
}

/** A date as "Mon 27 Oct". */
export function formatDate(date: IsoDate): string {
	const [, month, day] = ymd(date);
	return `${WEEKDAY_SHORT[weekday(date)]} ${day} ${MONTH_SHORT[month - 1]}`;
}

/** A plan day as a label: "Today", "Tomorrow", otherwise "Mon 27 Oct". */
export function formatDay(date: IsoDate, today: IsoDate): string {
	const ahead = daysUntil(today, date);
	return ahead === 0 ? "Today" : ahead === 1 ? "Tomorrow" : formatDate(date);
}

/** `formatDay` for use mid-sentence ("Added to tomorrow"). */
export function formatDayInline(date: IsoDate, today: IsoDate): string {
	const ahead = daysUntil(today, date);
	return ahead === 0 || ahead === 1 ? formatDay(date, today).toLowerCase() : formatDay(date, today);
}

/**
 * The days a grocery list covers: "Today", "Today – Tomorrow", "Sun 25 – Sat 31"
 * (no month: the dates of a range are at most weeks apart).
 */
export function formatRange(from: IsoDate, to: IsoDate, today: IsoDate): string {
	const short = (date: IsoDate) => {
		const ahead = daysUntil(today, date);
		if (ahead === 0) return "Today";
		if (ahead === 1) return "Tomorrow";
		return `${WEEKDAY_SHORT[weekday(date)]} ${ymd(date)[2]}`;
	};
	return to <= from ? short(from) : `${short(from)} – ${short(to)}`;
}

/** A count with its noun: "1 meal", "3 meals", "0 recipes". */
export function formatCount(n: number, singular: string, plural = `${singular}s`): string {
	return `${n} ${n === 1 ? singular : plural}`;
}

/** The recipe list's caption: "12 of 25". */
export function formatShown(shown: number, total: number): string {
	return `${shown} of ${total}`;
}

/** The filter button: "Filters", or "Filters · 2" when some are active. */
export function formatFiltersButton(active: number): string {
	return active === 0 ? "Filters" : `Filters · ${active}`;
}

/** The filter sheet's confirm button: "Show 12 recipes", "Show 1 recipe". */
export function formatShowRecipes(n: number): string {
	return `Show ${formatCount(n, "recipe")}`;
}

/** A filter option with what it would give: "Italian 6". */
export function formatOption(label: string, count: number): string {
	return `${label} ${count}`;
}

/** The plan's caption: "8 meals · 14 days". */
export function formatPlanCaption(meals: number, days: number): string {
	return `${formatCount(meals, "meal")} · ${formatCount(days, "day")}`;
}

/** The receipt's header line: "resolved from 8 meals". */
export function formatResolvedFrom(meals: number): string {
	return `resolved from ${formatCount(meals, "meal")}`;
}

/** The receipt's total: "40 / 43". */
export function formatLeft(left: number, total: number): string {
	return `${left} / ${total}`;
}

/** A meal whose recipe this build doesn't know (a link from a newer version). */
export function formatUnknownRecipe(id: string): string {
	return `Unknown recipe (${id})`;
}

/** The toast after adding a recipe to a day: "Added to tomorrow". */
export function formatAddedTo(date: IsoDate, today: IsoDate): string {
	return `Added to ${formatDayInline(date, today)}`;
}

/** The toast after moving a meal: "Moved to Fri 31 Oct". */
export function formatMovedTo(date: IsoDate, today: IsoDate): string {
	return `Moved to ${formatDayInline(date, today)}`;
}

/** A step's number in a recipe: "1", "2". */
export function formatStepNumber(index: number): string {
	return String(index + 1);
}

/** An extra as listed under the grocery list: its name and what was asked for. */
export function formatExtra(
	extra: Extra,
	dictionary: Dictionary,
): { name: string; quantity: string } {
	if (extra.kind === "custom") return { name: extra.name, quantity: extra.quantity ?? "" };
	const name = dictionary.entries.get(extra.key)?.name ?? extra.key;
	if (extra.amount === undefined) return { name, quantity: "" };
	return { name, quantity: [trimDecimals(extra.amount, 2), extra.unit].filter(Boolean).join(" ") };
}

/** What a planned meal says beside its title: "serves 6", "changed", or "to buy" for a non-recipe item. */
export function formatMealDetails(meal: MealEntry): string[] {
	if (isNote(meal)) return meal.buy ? ["to buy"] : [];
	return [
		...(meal.servings === undefined ? [] : [formatServes(meal.servings)]),
		...(meal.changes?.length ? ["changed"] : []),
	];
}

/**
 * The amount column of a planned meal's line: like a recipe line, except that a
 * freely typed ingredient shows its quantity as written (and nothing when it has none).
 */
export function formatPlannedAmount(
	line: PlannedLine,
	servings: number,
	recipeServings: number,
): string {
	if (line.free) return line.free.quantity ?? "";
	return formatLineAmount(line, servings, recipeServings);
}

/** What was changed about a planned meal's ingredient line: "instead of Scallion", "added", "changed". */
export function formatLineChange(line: PlannedLine): string | null {
	if (line.change === "swap") return `instead of ${line.instead?.name ?? "another"}`;
	if (line.change === "add") return "added";
	if (line.change === "set") return "changed";
	return null;
}

/** A recipe opened from a planned meal: "As planned for tomorrow". */
export function formatPlannedFor(date: IsoDate, today: IsoDate): string {
	return `As planned for ${formatDayInline(date, today)}`;
}

/** An amount as typed into a field: at most two decimals, no unit. Empty for "to taste". */
export function formatAmountInput(amount: number | null): string {
	return amount === null ? "" : trimDecimals(amount, 2);
}
