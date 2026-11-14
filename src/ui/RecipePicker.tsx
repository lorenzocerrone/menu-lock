import { useState } from "react";
import type { Recipe } from "../lib/data";
import { activeCount, EMPTY_QUERY, filterRecipes, type RecipeQuery } from "../lib/filters";
import { formatFiltersButton, formatRecipeMeta } from "../lib/format";
import { RecipeFilters } from "./RecipeFilters";
import { imageUrl } from "./recipeImage";
import { buttonPaper, input, rowButton } from "./styles";

type Props = {
	recipes: readonly Recipe[];
	onPick: (recipe: Recipe) => void;
	/** Offer the way out for what is not a recipe: add an extra instead. */
	onExtra?: () => void;
};

/**
 * Choose a recipe: search, the same filters as the recipe list (opened in
 * place, not as a sheet on a sheet), and the matching recipes to tap.
 */
export function RecipePicker({ recipes, onPick, onExtra }: Props) {
	const [query, setQuery] = useState<RecipeQuery>(EMPTY_QUERY);
	const [filters, setFilters] = useState(false);
	const found = filterRecipes(recipes, query);
	return (
		<div>
			<div className="flex gap-2">
				<input
					type="search"
					value={query.search}
					onChange={(event) => setQuery({ ...query, search: event.target.value })}
					placeholder="Search recipes"
					aria-label="Search recipes"
					className={input}
				/>
				<button
					type="button"
					aria-expanded={filters}
					onClick={() => setFilters(!filters)}
					className={`${buttonPaper} shrink-0`}
				>
					{formatFiltersButton(activeCount(query))}
				</button>
			</div>
			{filters ? (
				<div className="mt-3 rounded-card border border-rule border-dashed p-3">
					<RecipeFilters recipes={recipes} query={query} onChange={setQuery} />
				</div>
			) : null}
			{onExtra ? (
				<button type="button" onClick={onExtra} className={`${rowButton} mt-2`}>
					<span>Not a recipe? Add an extra</span>
					<span className="font-mono text-muted">›</span>
				</button>
			) : null}
			{found.length === 0 ? (
				<p className="mt-4 font-mono text-muted text-sm">0 recipes resolved. Too picky?</p>
			) : (
				<ul className="mt-1">
					{found.map((recipe) => (
						<li key={recipe.id}>
							<button
								type="button"
								onClick={() => onPick(recipe)}
								className="flex min-h-14 w-full items-center gap-3 border-rule-soft border-b py-2 text-left"
							>
								<img
									src={imageUrl(recipe)}
									alt=""
									loading="lazy"
									className="h-10 w-16 shrink-0 object-cover object-top"
								/>
								<span className="min-w-0">
									<span className="block truncate font-medium">{recipe.title}</span>
									<span className="block truncate font-mono text-[0.68rem] text-muted">
										{formatRecipeMeta(recipe).join(" · ")}
									</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
