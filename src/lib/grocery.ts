/**
 * The grocery list (REWRITE_PLAN §5.5): the plan's meals in a date range, plus
 * its extras, summed per dictionary ingredient in its shopping unit and grouped
 * by aisle; and this device's ticks and day range.
 */
import { applyChanges } from "./changes";
import { type Data, lookup, normalizeName } from "./data";
import { addDays, type IsoDate } from "./dates";
import { entriesIn, isNote, lastDate, type Plan } from "./plan";
import { AISLES, type CountSpec, OTHER_AISLE, type ShoppingUnit } from "./schema";
import { resolveUnit, toShopping } from "./units";

/** One line of the list: one thing to buy. */
export type GroceryLine = {
	/** Dictionary key, or `custom:<name>` for a hand-typed extra. The tick identity. */
	key: string;
	name: string;
	/** The shopping unit; `null` for a hand-typed extra. */
	unit: ShoppingUnit | null;
	/** The ingredient's piece spec, for labelling counts ("2 cans"). */
	count?: CountSpec;
	/** The summed amount in `unit`; `null` when nothing has an amount. */
	amount: number | null;
	/** True if at least one contribution had no amount. */
	toTaste: boolean;
	/** True only if every contribution was optional. */
	optional: boolean;
	/** Titles of the recipes that need it, de-duplicated, in plan order. */
	sources: string[];
	/** True if an extra contributed. */
	extra: boolean;
	/** Free-text quantities of custom extras ("1 loaf"), shown as typed. */
	customQuantities: string[];
};

export type GroceryAisle = { name: string; lines: GroceryLine[] };

/** What a grocery line is "for" when it comes from a non-recipe item on the plan. */
export const PLAN_SOURCE = "plan";

/** Line key for a hand-typed extra: stable per name, case-insensitive. */
export function customKey(name: string): string {
	return `custom:${normalizeName(name)}`;
}

/** "bread" → "Bread" (first character only; the rest is kept as typed). */
export function capitalize(s: string): string {
	const [first] = s;
	return first === undefined ? "" : first.toUpperCase() + s.slice(first.length);
}

function aisleRank(name: string): number {
	if (name === OTHER_AISLE) return Number.POSITIVE_INFINITY;
	const i = (AISLES as readonly string[]).indexOf(name);
	return i === -1 ? AISLES.length : i;
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The grocery list for the meals dated `from` through `to` and all of the
 * plan's extras. Deterministic: aisles in shop order, lines by name then key.
 */
export function aggregate(plan: Plan, from: IsoDate, to: IsoDate, data: Data): GroceryAisle[] {
	const lines = new Map<string, { aisle: string; line: GroceryLine }>();

	const lineFor = (key: string): GroceryLine | null => {
		const existing = lines.get(key);
		if (existing) return existing.line;
		const entry = data.dictionary.entries.get(key);
		if (!entry) return null;
		const line: GroceryLine = {
			key,
			name: entry.name,
			unit: entry.unit,
			amount: null,
			toTaste: false,
			optional: true,
			sources: [],
			extra: false,
			customQuantities: [],
		};
		if (entry.count) line.count = entry.count;
		lines.set(key, { aisle: entry.aisle, line });
		return line;
	};

	const add = (line: GroceryLine, amount: number | null, optional: boolean) => {
		line.optional &&= optional;
		if (amount === null) line.toTaste = true;
		else line.amount = (line.amount ?? 0) + amount;
	};

	/**
	 * Hand-typed things, which have no dictionary entry: custom extras, non-recipe
	 * items on the plan that are to be bought, and ingredients typed freely into a
	 * meal. `source` is what the line is for; `extra` marks a grocery-page extra.
	 */
	const typed: { name: string; quantity: string | null; source?: string; extra: boolean }[] = [];
	for (const meal of entriesIn(plan, from, to)) {
		if (isNote(meal)) {
			if (meal.buy)
				typed.push({ name: meal.note, quantity: null, source: PLAN_SOURCE, extra: false });
			continue;
		}
		const recipe = data.recipeById.get(meal.recipe);
		if (!recipe) continue;
		const servings = meal.servings ?? recipe.servings;
		// The meal's own version of the recipe, if it changed any ingredient.
		for (const item of applyChanges(recipe, meal.changes, data.dictionary).lines) {
			if (item.free) {
				typed.push({
					name: item.name,
					quantity: item.free.quantity,
					source: recipe.title,
					extra: false,
				});
				continue;
			}
			const line = lineFor(item.key);
			if (!line) continue;
			add(line, item.perServing === null ? null : item.perServing * servings, item.optional);
			if (!line.sources.includes(recipe.title)) line.sources.push(recipe.title);
		}
	}

	// Catalog extras are plain grocery items: never scaled, no recipe source.
	for (const extra of plan.extras) {
		if (extra.kind !== "catalog") continue;
		const entry = data.dictionary.entries.get(extra.key);
		const line = lineFor(extra.key);
		if (!entry || !line) continue;
		const unit = resolveUnit(extra.unit, entry.count);
		const amount =
			extra.amount === undefined || unit === null
				? null
				: toShopping(extra.amount, unit, entry.unit, entry.count);
		add(line, amount, false);
		line.extra = true;
	}

	// Hand-typed things join the line of the dictionary ingredient they name, if it
	// is on the list; otherwise they get their own line in "Other", by name.
	for (const extra of plan.extras) {
		if (extra.kind === "custom")
			typed.push({ name: extra.name, quantity: extra.quantity, extra: true });
	}
	for (const extra of typed) {
		const name = extra.name.trim();
		if (name === "") continue;
		const known = lookup(data.dictionary, name);
		const key = known && lines.has(known.key) ? known.key : customKey(name);
		let slot = lines.get(key);
		if (!slot) {
			slot = {
				aisle: OTHER_AISLE,
				line: {
					key,
					name: capitalize(name),
					unit: null,
					amount: null,
					toTaste: false,
					optional: false,
					sources: [],
					extra: false,
					customQuantities: [],
				},
			};
			lines.set(key, slot);
		}
		slot.line.optional = false;
		if (extra.extra) slot.line.extra = true;
		if (extra.source && !slot.line.sources.includes(extra.source))
			slot.line.sources.push(extra.source);
		const quantity = extra.quantity?.trim();
		if (quantity) slot.line.customQuantities.push(quantity);
	}

	const aisles = new Map<string, GroceryLine[]>();
	for (const { aisle, line } of lines.values()) {
		const list = aisles.get(aisle);
		if (list) list.push(line);
		else aisles.set(aisle, [line]);
	}
	return [...aisles]
		.map(([name, list]) => ({
			name,
			lines: list.sort((a, b) => byText(a.name, b.name) || byText(a.key, b.key)),
		}))
		.sort((a, b) => aisleRank(a.name) - aisleRank(b.name) || byText(a.name, b.name));
}

export function allLines(aisles: readonly GroceryAisle[]): GroceryLine[] {
	return aisles.flatMap((aisle) => aisle.lines);
}

/** The days the list covers, always starting today. */
export type GroceryRange = "all" | { days: number };

/** The presets offered on the grocery page, with their chip labels. */
export const RANGE_PRESETS: readonly { range: GroceryRange; label: string }[] = [
	{ range: { days: 1 }, label: "Today" },
	{ range: { days: 3 }, label: "3 days" },
	{ range: { days: 7 }, label: "7 days" },
	{ range: "all", label: "All planned" },
];

export function sameRange(a: GroceryRange, b: GroceryRange): boolean {
	return a === "all" || b === "all" ? a === b : a.days === b.days;
}

/** The last day covered (never before `today`). "All" is through the last planned day. */
export function rangeEnd(range: GroceryRange, plan: Plan, today: IsoDate): IsoDate {
	if (range !== "all") return addDays(today, Math.max(1, Math.trunc(range.days)) - 1);
	const last = lastDate(plan);
	return last !== null && last > today ? last : today;
}

/** A ticked line and what it needed at the time, so the tick goes once the plan needs more. */
export type CheckedItem = { key: string; amount: number | null; custom: string[] };

/** Per-device grocery state. Never shared in the URL. */
export type GroceryState = { checked: CheckedItem[]; range: GroceryRange };

export const DEFAULT_GROCERY: GroceryState = { checked: [], range: "all" };

/** Amounts are compared at 3 decimals, so float noise never unticks a line. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function snapshot(line: GroceryLine): CheckedItem {
	return {
		key: line.key,
		amount: line.amount === null ? null : round3(line.amount),
		custom: [...line.customQuantities],
	};
}

export function isChecked(state: GroceryState, key: string): boolean {
	return state.checked.some((c) => c.key === key);
}

/** Tick or untick a line, recording what it needs now. */
export function toggleChecked(state: GroceryState, line: GroceryLine): GroceryState {
	const checked = isChecked(state, line.key)
		? state.checked.filter((c) => c.key !== line.key)
		: [...state.checked, snapshot(line)];
	return { ...state, checked };
}

/** Untick every line (for a new plan). */
export function clearChecked(state: GroceryState): GroceryState {
	return state.checked.length === 0 ? state : { ...state, checked: [] };
}

function stillCovers(ticked: CheckedItem, line: GroceryLine): boolean {
	if (line.amount !== null && (ticked.amount === null || round3(line.amount) > ticked.amount))
		return false;
	const had = [...ticked.custom];
	return line.customQuantities.every((quantity) => {
		const i = had.indexOf(quantity);
		if (i === -1) return false;
		had.splice(i, 1);
		return true;
	});
}

/**
 * Drop the ticks of lines that are gone or now need more than when ticked (a
 * larger amount, or a custom quantity they didn't have). A line that needs
 * less, as when a past day drops off the plan, stays ticked. Returns the same
 * state when nothing changes.
 */
export function pruneChecked(state: GroceryState, aisles: readonly GroceryAisle[]): GroceryState {
	const lines = new Map(allLines(aisles).map((line) => [line.key, line]));
	const checked = state.checked.filter((c) => {
		const line = lines.get(c.key);
		return line !== undefined && stillCovers(c, line);
	});
	return checked.length === state.checked.length ? state : { ...state, checked };
}

/** How many lines there are, and how many are not ticked yet (the tab badge). */
export function progress(
	aisles: readonly GroceryAisle[],
	state: GroceryState,
): { left: number; total: number } {
	const lines = allLines(aisles);
	return { left: lines.filter((l) => !isChecked(state, l.key)).length, total: lines.length };
}

/** The list as shown: within each aisle, unticked lines first, ticked lines sink to the bottom. */
export function arrange(aisles: readonly GroceryAisle[], state: GroceryState): GroceryAisle[] {
	return aisles.map((aisle) => ({
		name: aisle.name,
		lines: [
			...aisle.lines.filter((l) => !isChecked(state, l.key)),
			...aisle.lines.filter((l) => isChecked(state, l.key)),
		],
	}));
}
