/**
 * Every user-facing number, date and quantity string. Pure: the UI calls into
 * here, so what something says is decided (and tested) in one place.
 */
import type { Recipe, RecipeLine } from "./data";
import { daysUntil, type IsoDate, MONTH_SHORT, WEEKDAY_SHORT, weekday, ymd } from "./dates";
import type { GroceryAisle, GroceryLine } from "./grocery";
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
