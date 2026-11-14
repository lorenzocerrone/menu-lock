/**
 * The plan on the wire: JSON, then base64url without padding, in `?plan=`
 * (REWRITE_PLAN §5.4). The format reads every dated link cooking-rs ever
 * wrote. Older shapes (weekday plans, meal slots) are not read.
 *
 *   {"dates":{"2026-11-16":["carbonara",{"recipe":"lentil_dal","servings":4}]},
 *    "extras":[{"name":"milk","amount":1,"unit":"l"},{"name":"Toilet paper","quantity":"1 pack"}]}
 *
 * Two things menu.lock added, which cooking-rs never wrote: a meal that is not
 * a recipe, `{"note":"Frozen pizza","buy":true}`, and a planned recipe's
 * ingredient changes, `{"recipe":"lentil_dal","changes":[{"swap":"scallion","for":"onion"}]}`.
 */
import { z } from "zod";
import { type Dictionary, lookup } from "./data";
import { type IsoDate, isIsoDate } from "./dates";
import {
	type Extra,
	isEmpty,
	isNote,
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
	| { add: string; amount?: number; unit?: string };
/**
 * A meal is a bare recipe id (its own servings, no changes), `{recipe,
 * servings?, changes?}`, or `{note, buy?}` for something that is not a recipe.
 */
type WireMeal =
	| string
	| { recipe: string; servings?: number; changes?: WireChange[] }
	| { note: string; buy?: true };
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
		servings: z.number().int().min(1).nullish(),
		changes: z.array(z.unknown()).nullish(),
	}),
	z.looseObject({ note: z.string(), buy: z.boolean().nullish() }),
]);

const wireChange = z.looseObject({
	skip: z.string().optional(),
	swap: z.string().optional(),
	set: z.string().optional(),
	add: z.string().optional(),
	for: z.string().optional(),
	amount: z.number().positive().nullish().catch(undefined),
	unit: z.string().nullish().catch(undefined),
});

const wireExtra = z.looseObject({
	name: z.string(),
	quantity: z.string().nullish(),
	amount: z.number().nullish(),
	unit: z.string().nullish(),
});

const wirePlan = z.looseObject({
	dates: z.record(z.string(), z.array(wireMeal)).optional(),
	extras: z.array(wireExtra).optional(),
});

function writeChange(change: MealChange): WireChange {
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

function writeMeal(meal: MealEntry): WireMeal {
	if (isNote(meal)) return meal.buy ? { note: meal.note, buy: true } : { note: meal.note };
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
		wire.extras = plan.extras.map((extra): WireExtra => {
			if (extra.kind === "custom") return { name: extra.name, quantity: extra.quantity };
			const out: { name: string; amount?: number; unit?: string } = { name: extra.key };
			if (extra.amount !== undefined) out.amount = extra.amount;
			if (extra.unit !== undefined) out.unit = extra.unit;
			return out;
		});
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
	if (c.skip) return { kind: "skip", key: c.skip };
	if (c.swap) return known(c.for) ? { kind: "swap", key: c.swap, for: c.for, ...quantity } : null;
	if (c.set) return { kind: "set", key: c.set, ...quantity };
	if (known(c.add)) return { kind: "add", key: c.add, ...quantity };
	return null;
}

function readMeal(meal: z.infer<typeof wireMeal>, dictionary: Dictionary): MealEntry | null {
	if (typeof meal === "string") return { recipe: meal };
	if ("note" in meal && typeof meal.note === "string") {
		const note = meal.note.trim();
		if (note === "") return null;
		return meal.buy ? { note, buy: true } : { note };
	}
	if (!("recipe" in meal) || typeof meal.recipe !== "string") return null;
	const out: RecipeMeal = { recipe: meal.recipe };
	if (typeof meal.servings === "number") out.servings = meal.servings;
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

/**
 * Read a wire value as of `today`: days before today and days without meals
 * are dropped; unknown recipe ids are kept. `null` for anything that isn't a
 * dated plan.
 */
export function fromWire(json: unknown, today: IsoDate, dictionary: Dictionary): Plan | null {
	const parsed = wirePlan.safeParse(json);
	if (!parsed.success) return null;
	const wire = parsed.data;
	// The weekday shape from before plans were dated is no longer read.
	if ("days" in wire && wire.dates === undefined) return null;

	const dates: Record<IsoDate, MealEntry[]> = {};
	for (const date of Object.keys(wire.dates ?? {}).sort()) {
		if (!isIsoDate(date)) return null;
		if (date < today) continue;
		const meals = (wire.dates?.[date] ?? []).flatMap((meal) => readMeal(meal, dictionary) ?? []);
		if (meals.length > 0) dates[date] = meals;
	}
	const extras: Extra[] = [];
	for (const raw of wire.extras ?? []) {
		const extra = readExtra(raw, dictionary);
		if (extra) extras.push(extra);
	}
	return { dates, extras };
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

/** Read a `plan` parameter as of `today`. Garbage decodes to `null`: no plan in the URL. */
export function decodePlan(encoded: string, today: IsoDate, dictionary: Dictionary): Plan | null {
	const text = fromBase64Url(encoded);
	if (text === null) return null;
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return null;
	}
	return fromWire(json, today, dictionary);
}
