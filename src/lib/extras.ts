/**
 * The grocery page's one-line "extras" input (REWRITE_PLAN §6.4): parse what
 * was typed ("milk 1 l"), suggest dictionary ingredients, and build the extra
 * to store.
 */
import type { Dictionary } from "./data";
import { capitalize } from "./grocery";
import type { Extra } from "./plan";
import { resolveUnit, toShopping } from "./units";

/** A typed extra, split into the item name and an optional quantity text. */
export type ParsedExtra = { name: string; quantity: string | null };

const NUMBER = /^(\d+([.,]\d*)?|[.,]\d+)$/;

/** A positive number; a decimal comma is accepted ("0,5"). */
export function parseNumber(token: string): number | null {
	if (!NUMBER.test(token)) return null;
	const n = Number(token.replace(",", "."));
	return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Split "milk 1 l" into `milk` and "1 l". The first number starts the
 * quantity; the token after it joins the quantity unless that would leave no
 * name ("2 eggs" → `eggs`, "2").
 */
export function parseExtra(input: string): ParsedExtra {
	const tokens = input.trim().split(/\s+/).filter(Boolean);
	const at = tokens.findIndex((t) => parseNumber(t) !== null);
	if (at === -1) return { name: tokens.join(" "), quantity: null };
	const name = tokens.slice(0, at);
	const quantity = tokens.slice(at, at + 1);
	const rest = tokens.slice(at + 1);
	if (rest.length > 0 && (name.length > 0 || rest.length > 1)) quantity.push(...rest.splice(0, 1));
	return { name: [...name, ...rest].join(" "), quantity: quantity.join(" ") };
}

/** A dictionary ingredient offered while typing. */
export type Suggestion = { key: string; name: string; aisle: string };

/**
 * Dictionary ingredients whose name or an alias matches `name`
 * (case-insensitive, singular or plural): starts-with first, then contains,
 * each sorted by name. Empty input gives nothing.
 */
export function suggest(dictionary: Dictionary, name: string, max: number): Suggestion[] {
	const needle = name.trim().toLowerCase();
	if (needle === "") return [];
	// What was typed, and its singular: "eggs" finds Egg.
	const needles = [needle];
	if (needle.endsWith("es") && needle.length > 3) needles.push(needle.slice(0, -2));
	if (needle.endsWith("s") && needle.length > 2) needles.push(needle.slice(0, -1));
	const prefix: Suggestion[] = [];
	const inner: Suggestion[] = [];
	for (const [key, entry] of dictionary.entries) {
		const names = [entry.name, ...(entry.aliases ?? [])].map((n) => n.toLowerCase());
		const suggestion = { key, name: entry.name, aisle: entry.aisle };
		if (names.some((n) => needles.some((needle) => n.startsWith(needle)))) prefix.push(suggestion);
		else if (names.some((n) => needles.some((needle) => n.includes(needle))))
			inner.push(suggestion);
	}
	const byName = (a: Suggestion, b: Suggestion) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
	return [...prefix.sort(byName), ...inner.sort(byName)].slice(0, max);
}

/**
 * The extra to store. With a dictionary pick (`key`), the quantity becomes an
 * amount if it converts for that ingredient; if it doesn't ("1 loaf" of bread
 * sold by weight) the item is kept exactly as typed, so nothing is silently
 * mis-measured. Without a pick it is a custom extra.
 */
export function toExtra(parsed: ParsedExtra, key: string | null, dictionary: Dictionary): Extra {
	const entry = key === null ? undefined : dictionary.entries.get(key);
	if (key === null || !entry) {
		return { kind: "custom", name: capitalize(parsed.name.trim()), quantity: parsed.quantity };
	}
	if (parsed.quantity === null) return { kind: "catalog", key };

	const [number, unit, ...more] = parsed.quantity.split(/\s+/);
	const amount = number === undefined ? null : parseNumber(number);
	// No unit means the shopping unit ("flour 500" is 500 g), written out for
	// g and ml, since on the wire a bare number counts pieces.
	const written = unit ?? (entry.unit === "pcs" ? undefined : entry.unit);
	const resolved = resolveUnit(written, entry.count);
	if (
		amount === null ||
		more.length > 0 ||
		resolved === null ||
		toShopping(amount, resolved, entry.unit, entry.count) === null
	) {
		return { kind: "custom", name: entry.name, quantity: parsed.quantity };
	}
	return written === undefined
		? { kind: "catalog", key, amount }
		: { kind: "catalog", key, amount, unit: written };
}
