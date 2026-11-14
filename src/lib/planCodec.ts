/**
 * The plan on the wire: JSON, then base64url without padding, in `?plan=`
 * (REWRITE_PLAN §5.4). The format reads every dated link cooking-rs ever
 * wrote. Older shapes (weekday plans, meal slots) are not read.
 *
 *   {"dates":{"2026-11-16":["carbonara",{"recipe":"lentil_dal","servings":4}]},
 *    "extras":[{"name":"milk","amount":1,"unit":"l"},{"name":"Toilet paper","quantity":"1 pack"}]}
 */
import { z } from "zod";
import { type Dictionary, lookup } from "./data";
import { type IsoDate, isIsoDate } from "./dates";
import { type Extra, isEmpty, type MealEntry, type Plan } from "./plan";
import { resolveUnit, toShopping } from "./units";

/** A meal is a bare id (the recipe's own servings) or `{recipe, servings}`. */
type WireMeal = string | { recipe: string; servings: number };
/** Untagged: a custom extra always carries `quantity`, a catalog extra never does. */
type WireExtra =
	| { name: string; amount?: number; unit?: string }
	| { name: string; quantity: string | null };
/** `dates` and `extras` are left out when empty. */
export type WirePlan = { dates?: Record<string, WireMeal[]>; extras?: WireExtra[] };

const wireMeal = z.union([
	z.string(),
	z.looseObject({ recipe: z.string(), servings: z.number().int().min(1).nullish() }),
]);

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

/** The plan as the JSON value that goes on the wire and into storage. */
export function toWire(plan: Plan): WirePlan {
	const wire: WirePlan = {};
	const dates = Object.keys(plan.dates).sort();
	if (dates.length > 0) {
		wire.dates = {};
		for (const date of dates) {
			wire.dates[date] = (plan.dates[date] ?? []).map((meal) =>
				meal.servings === undefined
					? meal.recipe
					: { recipe: meal.recipe, servings: meal.servings },
			);
		}
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
		const meals = wire.dates?.[date] ?? [];
		if (date < today || meals.length === 0) continue;
		dates[date] = meals.map((meal) =>
			typeof meal === "string"
				? { recipe: meal }
				: meal.servings == null
					? { recipe: meal.recipe }
					: { recipe: meal.recipe, servings: meal.servings },
		);
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
