import type { Recipe } from "../lib/data";

/** The address of a recipe's illustration. */
export function imageUrl(recipe: Pick<Recipe, "image">): string {
	return `${import.meta.env.BASE_URL}images/${recipe.image}`;
}

/** The name that ties a recipe's card to its page, so the illustration travels between them. */
export function imageTransition(recipe: Pick<Recipe, "id">): { viewTransitionName: string } {
	return { viewTransitionName: `recipe-${recipe.id}` };
}

/**
 * The old illustrations have their title drawn in at the bottom, so they are
 * shown cropped to the icon (design rules: illustrations).
 */
export const imageCrop = "aspect-[8/3] w-full object-cover object-top";
