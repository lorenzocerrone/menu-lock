import type { Recipe } from "../lib/data";
import { formatServes, formatTotalTime } from "../lib/format";

/** "25 min", "Italian", "serves 2": leaving out what a recipe doesn't have. */
export function metaParts(recipe: Recipe): string[] {
	return [formatTotalTime(recipe), recipe.cuisine, formatServes(recipe.servings)].filter(
		(part): part is string => !!part,
	);
}
