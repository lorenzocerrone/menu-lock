/**
 * The plan on the wire: JSON, then base64url without padding, in `?plan=`
 * (REWRITE_PLAN §5.4). The format reads every dated link cooking-rs ever
 * wrote. Older shapes (weekday plans, meal slots) are not read.
 *
 *   {"dates":{"2026-11-16":["carbonara",{"recipe":"lentil_dal","servings":4}]},
 *    "extras":[{"name":"milk","amount":1,"unit":"l"},{"name":"Toilet paper","quantity":"1 pack"}]}
 *
 * Two things menu.lock added, which cooking-rs never wrote: a meal that is not
 * a recipe but an ingredient, `{"item":{"name":"Leftover pizza","quantity":null},"buy":true}`
 * (the item is written like an extra), and a planned recipe's
 * ingredient changes, `{"recipe":"lentil_dal","changes":[{"swap":"scallion","for":"onion"}]}`
 * (or, for something typed freely, `{"swap":"scallion","name":"Shallots","quantity":"2"}`).
 */
import { z } from "zod";
import { freeKey } from "./changes";
import { type Dictionary, lookup } from "./data";
import { addDays, type IsoDate, isIsoDate } from "./dates";
import {
	type Extra,
	isEmpty,
	isItem,
	type MealChange,
	type MealEntry,
	type Plan,
	type RecipeMeal,
} from "./plan";
import { resolveUnit, toShopping } from "./units";

/** A change to one ingredient of a planned recipe: the first field says which kind. */
type WireChange =
	| { skip: string }
	| { swap: string; for: string; amount?: number; unit?: string }
	| { set: string; amount?: number; unit?: string }
	| { add: string; amount?: number; unit?: string }
	/** Freely typed, not in the dictionary: the name and the quantity as written. */
	| { swap: string; name: string; quantity: string | null }
	| { addName: string; quantity: string | null };
/**
 * A meal is a bare recipe id (its own servings, no changes), `{recipe,
 * servings?, changes?}`, or `{note, buy?}` for something that is not a recipe.
 */
type WireMeal =
	| string
	| { recipe: string; servings?: number; changes?: WireChange[] }
	| { item: WireExtra; buy?: true };
/** Untagged: a custom extra always carries `quantity`, a catalog extra never does. */
type WireExtra =
	| { name: string; amount?: number; unit?: string }
	| { name: string; quantity: string | null };
/** `dates` and `extras` are left out when empty. */
export type WirePlan = { dates?: Record<string, WireMeal[]>; extras?: WireExtra[] };

const wireMeal = z.union([
	z.string(),
	z.looseObject({
		recipe: z.string(),
		// Read leniently: servings that make no sense fall back to the recipe's own.
		servings: z.unknown().optional(),
		changes: z.array(z.unknown()).nullish(),
	}),
	z.looseObject({ item: z.looseObject({}), buy: z.boolean().nullish() }),
]);

const wireChange = z.looseObject({
	skip: z.string().optional(),
	swap: z.string().optional(),
	set: z.string().optional(),
	add: z.string().optional(),
	for: z.string().optional(),
	name: z.string().optional(),
	addName: z.string().optional(),
	quantity: z.string().nullish().catch(undefined),
	amount: z.number().positive().nullish().catch(undefined),
	unit: z.string().nullish().catch(undefined),
});

const wireExtra = z.looseObject({
	name: z.string(),
	quantity: z.string().nullish(),
	amount: z.number().nullish(),
	unit: z.string().nullish(),
});

/** Only the outline is checked here: each day, meal and extra is read on its own, so one bad one is dropped, not fatal. */
const wirePlan = z.looseObject({
	dates: z.record(z.string(), z.unknown()).optional(),
	extras: z.array(z.unknown()).optional(),
});

/** The most servings a meal can have: more is a typo (or a hand-edited link). */
export const MAX_SERVINGS = 99;

/**
 * How far ahead a plan may reach. The planner draws every day up to the last
 * planned one, so a date centuries away (a hand-edited link) would hang it.
 */
export const PLAN_HORIZON_DAYS = 365;

/** Servings as read from a link or storage: a whole number from 1 to MAX_SERVINGS, or none. */
function readServings(raw: unknown): number | undefined {
	if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
	const n = Math.round(raw);
	return n < 1 ? undefined : Math.min(n, MAX_SERVINGS);
}

function writeChange(change: MealChange): WireChange {
	if (change.kind === "swapFree")
		return { swap: change.key, name: change.name, quantity: change.quantity };
	if (change.kind === "addFree") return { addName: change.name, quantity: change.quantity };
	const quantity: { amount?: number; unit?: string } = {};
	if (change.kind !== "skip") {
		if (change.amount !== undefined) quantity.amount = change.amount;
		if (change.unit !== undefined) quantity.unit = change.unit;
	}
	switch (change.kind) {
		case "skip":
			return { skip: change.key };
		case "swap":
			return { swap: change.key, for: change.for, ...quantity };
		case "set":
			return { set: change.key, ...quantity };
		case "add":
			return { add: change.key, ...quantity };
	}
}

function writeExtra(extra: Extra): WireExtra {
	if (extra.kind === "custom") return { name: extra.name, quantity: extra.quantity };
	const out: { name: string; amount?: number; unit?: string } = { name: extra.key };
	if (extra.amount !== undefined) out.amount = extra.amount;
	if (extra.unit !== undefined) out.unit = extra.unit;
	return out;
}

function writeMeal(meal: MealEntry): WireMeal {
	if (isItem(meal))
		return meal.buy ? { item: writeExtra(meal.item), buy: true } : { item: writeExtra(meal.item) };
	// The cooking-rs shapes, byte for byte, whenever nothing new is used.
	if (meal.servings === undefined && !meal.changes?.length) return meal.recipe;
	const out: { recipe: string; servings?: number; changes?: WireChange[] } = {
		recipe: meal.recipe,
	};
	if (meal.servings !== undefined) out.servings = meal.servings;
	if (meal.changes?.length) out.changes = meal.changes.map(writeChange);
	return out;
}

/** The plan as the JSON value that goes on the wire and into storage. */
export function toWire(plan: Plan): WirePlan {
	const wire: WirePlan = {};
	const dates = Object.keys(plan.dates).sort();
	if (dates.length > 0) {
		wire.dates = {};
		for (const date of dates) wire.dates[date] = (plan.dates[date] ?? []).map(writeMeal);
	}
	if (plan.extras.length > 0) {
		wire.extras = plan.extras.map(writeExtra);
	}
	return wire;
}

/** A change as written on the wire, or `null` for one that can't be read: it is dropped, not fatal. */
function readChange(raw: unknown, dictionary: Dictionary): MealChange | null {
	const parsed = wireChange.safeParse(raw);
	if (!parsed.success) return null;
	const c = parsed.data;
	const quantity: { amount?: number; unit?: string } = {};
	if (c.amount != null) quantity.amount = c.amount;
	const unit = c.unit?.trim();
	if (unit) quantity.unit = unit;
	const known = (key: string | undefined): key is string =>
		key !== undefined && dictionary.entries.has(key);
	const name = (c.addName ?? c.name)?.trim();
	const text = c.quantity?.trim() || null;
	if (c.skip) return { kind: "skip", key: c.skip };
	if (c.swap && c.for === undefined && name)
		return { kind: "swapFree", key: c.swap, name, quantity: text };
	if (c.addName !== undefined)
		return name ? { kind: "addFree", key: freeKey(name), name, quantity: text } : null;
	if (c.swap) return known(c.for) ? { kind: "swap", key: c.swap, for: c.for, ...quantity } : null;
	if (c.set) return { kind: "set", key: c.set, ...quantity };
	if (known(c.add)) return { kind: "add", key: c.add, ...quantity };
	return null;
}

function readMeal(meal: z.infer<typeof wireMeal>, dictionary: Dictionary): MealEntry | null {
	if (typeof meal === "string") return { recipe: meal };
	if ("item" in meal) {
		const parsed = wireExtra.safeParse(meal.item);
		const item = parsed.success ? readExtra(parsed.data, dictionary) : null;
		if (!item) return null;
		return meal.buy ? { item, buy: true } : { item };
	}
	if (!("recipe" in meal) || typeof meal.recipe !== "string") return null;
	const out: RecipeMeal = { recipe: meal.recipe };
	const servings = readServings(meal.servings);
	if (servings !== undefined) out.servings = servings;
	// One change per ingredient: a later one for the same key replaces the earlier.
	const changes = new Map<string, MealChange>();
	for (const raw of Array.isArray(meal.changes) ? meal.changes : []) {
		const change = readChange(raw, dictionary);
		if (change) changes.set(change.key, change);
	}
	if (changes.size > 0) out.changes = [...changes.values()];
	return out;
}

function readExtra(raw: z.infer<typeof wireExtra>, dictionary: Dictionary): Extra | null {
	const name = raw.name.trim();
	if (name === "") return null;
	if ("quantity" in raw) return { kind: "custom", name, quantity: raw.quantity ?? null };

	const amount = raw.amount != null && raw.amount > 0 ? raw.amount : undefined;
	const unit = raw.unit?.trim() || undefined;
	const written = amount === undefined ? null : [String(amount), unit].filter(Boolean).join(" ");
	const known = lookup(dictionary, name);
	// Not in the dictionary: keep it as typed, on its own line.
	if (!known) return { kind: "custom", name, quantity: written };
	if (amount === undefined) return { kind: "catalog", key: known.key };
	const { ingredient } = known;
	const resolved = resolveUnit(unit, ingredient.count);
	const converts =
		resolved !== null && toShopping(amount, resolved, ingredient.unit, ingredient.count) !== null;
	// An amount the list can't add up is kept as text, never mis-measured.
	if (!converts) return { kind: "custom", name: ingredient.name, quantity: written };
	return unit === undefined
		? { kind: "catalog", key: known.key, amount }
		: { kind: "catalog", key: known.key, amount, unit };
}

/** What reading a plan left out, besides days without meals. */
export type Dropped = {
	/** Days before today, with meals on them. */
	past: number;
	/** Days, meals and extras that couldn't be read, and days beyond the horizon. */
	unreadable: number;
};

/**
 * Read a wire value as of `today`: days before today, days more than
 * PLAN_HORIZON_DAYS ahead and days without meals are dropped; a day, meal or
 * extra that can't be read is dropped and the rest kept; unknown recipe ids
 * are kept. `plan` is `null` for anything that isn't a dated plan, and when
 * nothing at all could be read.
 */
export function readWire(
	json: unknown,
	today: IsoDate,
	dictionary: Dictionary,
): { plan: Plan | null; dropped: Dropped } {
	const dropped: Dropped = { past: 0, unreadable: 0 };
	const parsed = wirePlan.safeParse(json);
	if (!parsed.success) return { plan: null, dropped };
	const wire = parsed.data;
	// The weekday shape from before plans were dated is no longer read.
	if ("days" in wire && wire.dates === undefined) return { plan: null, dropped };

	const horizon = addDays(today, PLAN_HORIZON_DAYS);
	const dates: Record<IsoDate, MealEntry[]> = {};
	for (const date of Object.keys(wire.dates ?? {}).sort()) {
		const raw = wire.dates?.[date];
		if (!isIsoDate(date) || !Array.isArray(raw)) {
			dropped.unreadable++;
			continue;
		}
		if (raw.length === 0) continue;
		if (date < today) {
			dropped.past++;
			continue;
		}
		if (date > horizon) {
			dropped.unreadable++;
			continue;
		}
		const meals: MealEntry[] = [];
		for (const item of raw) {
			const meal = wireMeal.safeParse(item);
			const read = meal.success ? readMeal(meal.data, dictionary) : null;
			if (read) meals.push(read);
			else dropped.unreadable++;
		}
		if (meals.length > 0) dates[date] = meals;
	}
	const extras: Extra[] = [];
	for (const raw of wire.extras ?? []) {
		const parsedExtra = wireExtra.safeParse(raw);
		const extra = parsedExtra.success ? readExtra(parsedExtra.data, dictionary) : null;
		if (extra) extras.push(extra);
		else dropped.unreadable++;
	}
	const plan = { dates, extras };
	return { plan: dropped.unreadable > 0 && isEmpty(plan) ? null : plan, dropped };
}

/** `readWire`, for when only the plan matters (storage). */
export function fromWire(json: unknown, today: IsoDate, dictionary: Dictionary): Plan | null {
	return readWire(json, today, dictionary).plan;
}

const BASE64URL = /^[A-Za-z0-9_-]*={0,2}$/;

function toBase64Url(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string | null {
	if (!BASE64URL.test(encoded)) return null;
	try {
		const binary = atob(encoded.replaceAll("-", "+").replaceAll("_", "/").replace(/=+$/, ""));
		const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

/** The `plan` parameter for a plan, or `null` for an empty plan (no parameter at all). */
export function encodePlan(plan: Plan): string | null {
	if (isEmpty(plan)) return null;
	return toBase64Url(JSON.stringify(toWire(plan)));
}

/**
 * Read a `plan` parameter as of `today`. `plan` is `null` when there is nothing
 * to open: garbage, and a link whose days have all passed (`passed`), which
 * would otherwise open as an empty plan.
 */
export function readPlanParam(
	encoded: string,
	today: IsoDate,
	dictionary: Dictionary,
): { plan: Plan | null; passed: boolean; dropped: Dropped } {
	const none = { plan: null, passed: false, dropped: { past: 0, unreadable: 0 } };
	const text = fromBase64Url(encoded);
	if (text === null) return none;
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return none;
	}
	const { plan, dropped } = readWire(json, today, dictionary);
	const passed = plan !== null && dropped.past > 0 && Object.keys(plan.dates).length === 0;
	return { plan: passed || (plan && isEmpty(plan)) ? null : plan, passed, dropped };
}

/** Read a `plan` parameter as of `today`. Garbage, and a link with nothing left to cook, decode to `null`. */
export function decodePlan(encoded: string, today: IsoDate, dictionary: Dictionary): Plan | null {
	return readPlanParam(encoded, today, dictionary).plan;
}
