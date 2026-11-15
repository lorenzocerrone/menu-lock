/**
 * Units and conversion into shopping units (REWRITE_PLAN §5.3). Every unit rule
 * lives here. There is no density table: mass never converts to volume.
 */
import type { CountSpec, ShoppingUnit } from "./schema";

export const UNITS = ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "pcs"] as const;
/** A unit a recipe may write. Piece labels ("clove") resolve to "pcs". */
export type Unit = (typeof UNITS)[number];

export type Dimension = "mass" | "volume" | "count";

const SPELLINGS: Record<string, Unit> = {
	g: "g",
	gr: "g",
	gram: "g",
	grams: "g",
	kg: "kg",
	kilogram: "kg",
	kilograms: "kg",
	ml: "ml",
	milliliter: "ml",
	milliliters: "ml",
	millilitre: "ml",
	millilitres: "ml",
	l: "l",
	liter: "l",
	liters: "l",
	litre: "l",
	litres: "l",
	tsp: "tsp",
	teaspoon: "tsp",
	teaspoons: "tsp",
	tbsp: "tbsp",
	tablespoon: "tbsp",
	tablespoons: "tbsp",
	cup: "cup",
	cups: "cup",
	pc: "pcs",
	pcs: "pcs",
	piece: "pcs",
	pieces: "pcs",
};

/** Parse a unit as written. Case-insensitive, a few long spellings, otherwise strict. */
export function parseUnit(s: string): Unit | null {
	return SPELLINGS[s.trim().toLowerCase()] ?? null;
}

export function dimension(unit: Unit): Dimension {
	switch (unit) {
		case "g":
		case "kg":
			return "mass";
		case "pcs":
			return "count";
		default:
			return "volume";
	}
}

/** Multiplier into the dimension's base unit (g, ml or pieces). */
export function toBase(unit: Unit): number {
	switch (unit) {
		case "kg":
		case "l":
			return 1000;
		case "tsp":
			return 5;
		case "tbsp":
			return 15;
		case "cup":
			return 240;
		default:
			return 1;
	}
}

/** Plural of the piece label (explicit, or label + "s"). */
export function pluralLabel(count: CountSpec | undefined): string | null {
	if (!count?.label) return null;
	return count.plural ?? `${count.label}s`;
}

/** True when `s` is this ingredient's piece label, singular or plural. */
export function matchesLabel(count: CountSpec | undefined, s: string): boolean {
	const word = s.trim().toLowerCase();
	if (!count?.label || !word) return false;
	return count.label.toLowerCase() === word || pluralLabel(count)?.toLowerCase() === word;
}

/** The label to print after `n` pieces, if the ingredient has one. */
export function labelFor(count: CountSpec | undefined, n: number): string | null {
	if (!count?.label) return null;
	return Math.abs(n - 1) < 1e-9 ? count.label : pluralLabel(count);
}

/**
 * The unit a line means. No unit is a count of pieces, whatever the shopping
 * unit; a piece label is a count too. `null` for a word that is neither.
 */
export function resolveUnit(raw: string | undefined, count: CountSpec | undefined): Unit | null {
	if (raw === undefined || raw.trim() === "") return "pcs";
	return parseUnit(raw) ?? (matchesLabel(count, raw) ? "pcs" : null);
}

/**
 * `amount` of `unit`, expressed in the ingredient's shopping unit, or `null`
 * when it does not convert:
 * - same dimension: the base unit (g, ml, pcs);
 * - count → mass or volume: pieces × perPiece;
 * - mass → count: grams ÷ perPiece.
 */
export function toShopping(
	amount: number,
	unit: Unit,
	shoppingUnit: ShoppingUnit,
	count: CountSpec | undefined,
): number | null {
	const from = dimension(unit);
	const target = dimension(shoppingUnit);
	if (from === target) return amount * toBase(unit);
	const perPiece = count?.perPiece;
	if (perPiece === undefined || !(perPiece > 0)) return null;
	if (from === "count") return amount * perPiece;
	if (from === "mass" && target === "count") return (amount * toBase(unit)) / perPiece;
	return null;
}

/**
 * A quantity that does not convert into the shopping unit (pieces of something
 * sold by weight, a tablespoon of butter, "1 ball"), in the unit it is summed in
 * beside the total: grams for any mass, ml for ml and l, pieces for a count, and
 * otherwise the unit as written (tsp, tbsp, cup, or the recipe's own word).
 */
export function asideQuantity(
	amount: number,
	raw: string | undefined,
	count: CountSpec | undefined,
): { unit: string; amount: number } {
	const unit = resolveUnit(raw, count);
	if (unit === null) return { unit: (raw ?? "").trim().toLowerCase(), amount };
	if (unit === "g" || unit === "kg") return { unit: "g", amount: amount * toBase(unit) };
	if (unit === "ml" || unit === "l") return { unit: "ml", amount: amount * toBase(unit) };
	return { unit, amount };
}

/** The units that convert for an ingredient: "g, kg, pcs, clove". */
export function convertibleUnits(
	shoppingUnit: ShoppingUnit,
	count: CountSpec | undefined,
): string[] {
	const units: string[] = UNITS.filter((u) => toShopping(1, u, shoppingUnit, count) !== null);
	if (count?.label && units.includes("pcs")) units.push(count.label);
	return units;
}
