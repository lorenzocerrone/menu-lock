/**
 * A planned meal can change its recipe for that one meal: swap an ingredient,
 * leave one out, use more or less, add one. The recipe itself never changes.
 * The changes live on the meal in the plan, so the grocery list follows them
 * and they travel with the link.
 */
import { type Dictionary, makeLine, normalizeName, type Recipe, type RecipeLine } from "./data";
import type { MealChange } from "./plan";

/** A line of a planned meal, with what was changed about it, if anything. */
export type PlannedLine = RecipeLine & {
	/** "swap": it replaces `instead`; "set": its amount differs; "add": the recipe doesn't have it. */
	change?: "swap" | "set" | "add";
	/** For a swap: the key and name of the recipe's ingredient it replaces. */
	instead?: { key: string; name: string };
	/**
	 * Set when the ingredient was typed freely and is not in the dictionary: its
	 * quantity as written. Such a line has no amount: nothing scales or sums it.
	 */
	free?: { quantity: string | null };
};

/** The key of a freely typed ingredient: stable per name, and never a dictionary key. */
export function freeKey(name: string): string {
	return `custom:${normalizeName(name)}`;
}

/** A line for an ingredient that is not in the dictionary. */
function freeLine(name: string, quantity: string | null): PlannedLine {
	return {
		key: freeKey(name),
		name,
		amount: null,
		unit: null,
		optional: false,
		perServing: null,
		free: { quantity: quantity?.trim() || null },
	};
}

/** The unit of a resolved line as a recipe would write it: pieces are written without a unit. */
function unitText(line: RecipeLine): string | undefined {
	return line.unit === null || line.unit === "pcs" ? undefined : line.unit;
}

/**
 * The meal's ingredient lines after its changes, and the recipe lines it
 * leaves out. A change that names an ingredient the recipe or the dictionary
 * doesn't have is ignored.
 */
export function applyChanges(
	recipe: Recipe,
	changes: readonly MealChange[] | undefined,
	dictionary: Dictionary,
): { lines: PlannedLine[]; skipped: RecipeLine[] } {
	if (!changes || changes.length === 0) return { lines: recipe.lines, skipped: [] };
	const byKey = new Map(
		changes.filter((c) => c.kind !== "add" && c.kind !== "addFree").map((c) => [c.key, c]),
	);
	const lines: PlannedLine[] = [];
	const skipped: RecipeLine[] = [];

	for (const line of recipe.lines) {
		const change = byKey.get(line.key);
		const keep = { note: line.note, optional: line.optional };
		if (!change) {
			lines.push(line);
		} else if (change.kind === "skip") {
			skipped.push(line);
		} else if (change.kind === "set") {
			const made = makeLine(
				dictionary,
				line.key,
				change.amount,
				change.unit,
				recipe.servings,
				keep,
			);
			lines.push(made ? { ...made, change: "set" } : line);
		} else if (change.kind === "swap") {
			// No amount given: the recipe's own amount, if it means something for the new ingredient.
			const amount = change.amount ?? line.amount ?? undefined;
			const unit = change.amount === undefined ? unitText(line) : change.unit;
			const made = makeLine(dictionary, change.for, amount, unit, recipe.servings, keep);
			lines.push(
				made ? { ...made, change: "swap", instead: { key: line.key, name: line.name } } : line,
			);
		} else if (change.kind === "swapFree") {
			lines.push({
				...freeLine(change.name, change.quantity),
				change: "swap",
				instead: { key: line.key, name: line.name },
			});
		}
	}
	for (const change of changes) {
		if (change.kind === "addFree") {
			lines.push({ ...freeLine(change.name, change.quantity), change: "add" });
		} else if (change.kind === "add") {
			const made = makeLine(dictionary, change.key, change.amount, change.unit, recipe.servings);
			if (made) lines.push({ ...made, change: "add" });
		}
	}
	return { lines, skipped };
}

/** The change a meal has for an ingredient key, if any. */
export function changeFor(
	changes: readonly MealChange[] | undefined,
	key: string,
): MealChange | undefined {
	return changes?.find((c) => c.key === key);
}

/** The changes with `change` put in: it replaces any earlier change for the same key. */
export function withChange(
	changes: readonly MealChange[] | undefined,
	change: MealChange,
): MealChange[] {
	return [...withoutChange(changes, change.key), change];
}

/** The changes without the one for `key`: that ingredient is back to the recipe's. */
export function withoutChange(
	changes: readonly MealChange[] | undefined,
	key: string,
): MealChange[] {
	return (changes ?? []).filter((c) => c.key !== key);
}
