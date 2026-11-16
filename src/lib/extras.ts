/**
 * The grocery page's one-line "extras" input (REWRITE_PLAN §6.4): parse what
 * was typed ("milk 1 l"), suggest dictionary ingredients, and build the extra
 * to store.
 */
import { type Dictionary, lookup } from "./data";
import { capitalize } from "./grocery";
import type { Extra } from "./plan";
import { parseUnit, resolveUnit, toShopping } from "./units";

/** A typed extra, split into the item name and an optional quantity text. */
export type ParsedExtra = { name: string; quantity: string | null };

const NUMBER = /^(\d+([.,]\d*)?|[.,]\d+)$/;

/** A positive number; a decimal comma is accepted ("0,5"). */
export function parseNumber(token: string): number | null {
	if (!NUMBER.test(token)) return null;
	const n = Number(token.replace(",", "."));
	return Number.isFinite(n) && n > 0 ? n : null;
}

/** A number with a unit stuck to it ("500g", "1,5l"). */
const GLUED = /^(\d+(?:[.,]\d*)?|[.,]\d+)([a-z]+)$/i;

/** "500g" as "500", "g" when the letters are a unit; anything else as it is. */
function unglue(token: string): string[] {
	const m = GLUED.exec(token);
	return m?.[1] && m[2] && parseUnit(m[2]) !== null ? [m[1], m[2]] : [token];
}

/**
 * Split "milk 1 l" into `milk` and "1 l". The first number starts the
 * quantity; the token after it joins the quantity unless that would leave no
 * name ("2 eggs" → `eggs`, "2"). A unit written without a space counts as its
 * own word ("pasta 500g").
 */
export function parseExtra(input: string): ParsedExtra {
	const tokens = input.trim().split(/\s+/).filter(Boolean).flatMap(unglue);
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

/** How many edits apart two short strings are; swapping two neighbouring letters counts as one. */
function editDistance(a: string, b: string): number {
	let twoBack: number[] = [];
	let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++) {
			const same = a[i - 1] === b[j - 1];
			let best = Math.min(
				(previous[j] ?? 0) + 1,
				(row[j - 1] ?? 0) + 1,
				(previous[j - 1] ?? 0) + (same ? 0 : 1),
			);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
				best = Math.min(best, (twoBack[j - 2] ?? 0) + 1);
			row.push(best);
		}
		twoBack = previous;
		previous = row;
	}
	return previous[b.length] ?? 0;
}

/** True when the letters of `needle` appear in `text` in that order ("brd" in "bread"). */
function inOrder(needle: string, text: string): boolean {
	let at = 0;
	for (const letter of text) if (letter === needle[at]) at++;
	return at === needle.length;
}

/**
 * How well `needle` matches a name, lower is better, `null` for no match:
 * 0 the name starts with it; 1 one of its words does; 2 it is inside the name;
 * 3 it is a near miss of the start of a word (a typo: "galric", "onoin");
 * 4 its letters appear in order ("brd").
 */
function matchRank(needle: string, name: string): number | null {
	if (name.startsWith(needle)) return 0;
	const words = name.split(/[\s-]+/);
	if (words.some((word) => word.startsWith(needle))) return 1;
	if (name.includes(needle)) return 2;
	if (needle.length < 3) return null;
	// Guesses, kept tight so they don't drown the real matches: the first letter
	// must be right (typos rarely hit it).
	const candidates = words.filter((word) => word[0] === needle[0]);
	// One slip from four letters on, two from eight; compared with as much of
	// each word as has been typed, so it works while typing.
	const slips = needle.length >= 8 ? 2 : needle.length >= 4 ? 1 : 0;
	const near = candidates.some(
		(word) =>
			slips > 0 &&
			word.length >= needle.length - 1 &&
			Math.min(
				editDistance(needle, word.slice(0, needle.length)),
				editDistance(needle, word.slice(0, needle.length + 1)),
			) <= slips,
	);
	if (near) return 3;
	return candidates.some((word) => inOrder(needle, word)) ? 4 : null;
}

/**
 * Dictionary ingredients for what is being typed, best first: names (or
 * aliases) that start with it, then a word that does, then names containing
 * it, then near misses and letters in order, so a typo or a half-typed word
 * still finds its ingredient. Singular and plural are the same; within a group
 * the shorter name comes first. Empty input gives nothing.
 */
export function suggest(dictionary: Dictionary, name: string, max: number): Suggestion[] {
	const needle = name.trim().toLowerCase();
	if (needle === "") return [];
	// What was typed, and its singular: "eggs" finds Egg.
	const needles = [needle];
	if (needle.endsWith("es") && needle.length > 3) needles.push(needle.slice(0, -2));
	if (needle.endsWith("s") && needle.length > 2) needles.push(needle.slice(0, -1));

	const ranked: { rank: number; suggestion: Suggestion }[] = [];
	for (const [key, entry] of dictionary.entries) {
		const names = [entry.name, ...(entry.aliases ?? [])].map((n) => n.toLowerCase());
		const ranks = names.flatMap((n) =>
			needles.map((form) => matchRank(form, n) ?? Number.POSITIVE_INFINITY),
		);
		const rank = Math.min(...ranks);
		if (Number.isFinite(rank))
			ranked.push({ rank, suggestion: { key, name: entry.name, aisle: entry.aisle } });
	}
	// Within a group, the shorter name first ("Milk" before "Coconut milk"), then by name.
	const byName = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
	return ranked
		.sort((a, b) => a.rank - b.rank || byName(a.suggestion.name, b.suggestion.name))
		.slice(0, max)
		.map((r) => r.suggestion);
}

/**
 * The extra to store. With a dictionary pick (`key`), the quantity becomes an
 * amount if it converts for that ingredient; if it doesn't ("1 loaf" of bread
 * sold by weight) the item is kept exactly as typed, so nothing is silently
 * mis-measured. Without a pick, a name that is exactly a dictionary name or
 * alias counts as picking it ("milk 2 l" adds up with the recipes' milk);
 * anything else is a custom extra.
 */
export function toExtra(parsed: ParsedExtra, picked: string | null, dictionary: Dictionary): Extra {
	const key = picked ?? lookup(dictionary, parsed.name)?.key ?? null;
	const entry = key === null ? undefined : dictionary.entries.get(key);
	if (key === null || !entry) {
		return { kind: "custom", name: capitalize(parsed.name.trim()), quantity: parsed.quantity };
	}
	if (parsed.quantity === null) return { kind: "catalog", key };

	const [number, unit, ...more] = parsed.quantity.split(/\s+/);
	const amount = number === undefined ? null : parseNumber(number);
	// No unit: pieces for something that is counted ("2 onions", "3 garlic" as
	// cloves), else the shopping unit ("flour 500" is 500 g), written out since on
	// the wire a bare number counts pieces.
	const counted = entry.unit === "pcs" || entry.count?.perPiece !== undefined;
	const written = unit ?? (counted ? undefined : entry.unit);
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
