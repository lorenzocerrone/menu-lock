import { useState } from "react";
import { DATA } from "../dataset";
import { lookup, type Recipe } from "../lib/data";
import { parseExtra, suggest, toExtra } from "../lib/extras";
import { activeCount, EMPTY_QUERY, filterRecipes, type RecipeQuery } from "../lib/filters";
import { formatFiltersButton, formatRecipeMeta } from "../lib/format";
import { capitalize } from "../lib/grocery";
import type { Extra } from "../lib/plan";
import { RecipeFilters } from "./RecipeFilters";
import { imageUrl } from "./recipeImage";
import { buttonPaper, input, rowButton } from "./styles";

type Props = {
	recipes: readonly Recipe[];
	onPick: (recipe: Recipe) => void;
	/**
	 * Also offer ingredients for what was typed ("salmon 2 fillets", "leftover
	 * pizza"): the matching ones from the list, and what was typed as it is.
	 */
	onItem?: (item: Extra, buy: boolean) => void;
};

/**
 * Choose what goes on a day: search, the same filters as the recipe list
 * (opened in place, not as a sheet on a sheet), the matching recipes to tap,
 * and, with `onItem`, ingredients for the same text.
 */
export function RecipePicker({ recipes, onPick, onItem }: Props) {
	const [query, setQuery] = useState<RecipeQuery>(EMPTY_QUERY);
	const [filters, setFilters] = useState(false);
	const found = filterRecipes(recipes, query);
	// The same text read as an ingredient: a name, and maybe a quantity.
	const parsed = parseExtra(query.search);
	const typed = capitalize(parsed.name);
	const ingredients = onItem ? suggest(DATA.dictionary, parsed.name, 4) : [];
	const listed = typed !== "" && lookup(DATA.dictionary, typed) !== null;
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
			{onItem && typed === "" ? (
				<p className="mt-3 font-mono text-muted text-xs">
					Not a recipe? Type an ingredient (salmon 2 fillets, leftover pizza).
				</p>
			) : null}
			{found.length === 0 ? (
				<p className="mt-4 font-mono text-muted text-sm">
					{onItem && typed !== "" ? "0 recipes resolved." : "0 recipes resolved. Too picky?"}
				</p>
			) : (
				<ul className="mt-3">
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
			{onItem && typed !== "" ? (
				<section aria-label="Ingredients" className="mt-5">
					<h3 className="font-mono text-muted text-xs uppercase tracking-[0.2em]">Ingredients</h3>
					{/* From the list: they add up on the grocery list, in their aisle. */}
					{ingredients.map((s) => (
						<button
							key={s.key}
							type="button"
							onClick={() => onItem(toExtra(parsed, s.key, DATA.dictionary), true)}
							className={rowButton}
						>
							<span className="min-w-0 truncate">
								{s.name}
								{parsed.quantity ? (
									<span className="font-mono text-muted text-sm"> {parsed.quantity}</span>
								) : null}
							</span>
							<span className="shrink-0 font-mono text-muted text-xs">{s.aisle}</span>
						</button>
					))}
					{/* Anything else, as typed: on the plan only, or also on the grocery list. */}
					{listed ? null : (
						<>
							<button
								type="button"
								onClick={() => onItem(toExtra(parsed, null, DATA.dictionary), false)}
								className={rowButton}
							>
								<span className="min-w-0 truncate">Add “{typed}”</span>
								<span className="shrink-0 font-mono text-muted text-xs">plan only</span>
							</button>
							<button
								type="button"
								onClick={() => onItem(toExtra(parsed, null, DATA.dictionary), true)}
								className={rowButton}
							>
								<span className="min-w-0 truncate">Add “{typed}”</span>
								<span className="shrink-0 font-mono text-sienna text-xs">and buy it</span>
							</button>
						</>
					)}
				</section>
			) : null}
		</div>
	);
}
