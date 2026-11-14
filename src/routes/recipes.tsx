import { getRouteApi } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { DATA } from "../dataset";
import {
	activeCount,
	activeOptions,
	clearFilters,
	filterRecipes,
	optionLabel,
	queryFromSearch,
	queryToSearch,
	type RecipeQuery,
	toggle,
} from "../lib/filters";
import { formatFiltersButton, formatShown, formatShowRecipes } from "../lib/format";
import { Chip } from "../ui/Chip";
import { PageTitle } from "../ui/PageTitle";
import { RecipeCard } from "../ui/RecipeCard";
import { RecipeFilters } from "../ui/RecipeFilters";
import { Sheet } from "../ui/Sheet";
import { buttonPaper, buttonPrimary, input } from "../ui/styles";

const route = getRouteApi("/shell/");

/** Every recipe, with search and filters. The query lives in the address, so a filtered list can be sent. */
export function RecipesPage() {
	const search = route.useSearch();
	const navigate = route.useNavigate();
	const query = useMemo(() => queryFromSearch(search), [search]);
	const [sheet, setSheet] = useState(false);

	const setQuery = (next: RecipeQuery) =>
		navigate({
			search: (prev) => ({ ...(prev.plan ? { plan: prev.plan } : {}), ...queryToSearch(next) }),
			replace: true,
		});

	// The field keeps what is typed (a trailing space included); the address holds it trimmed.
	const [text, setText] = useState(query.search);
	useEffect(() => {
		setText((current) => (current.trim() === query.search ? current : query.search));
	}, [query.search]);

	const recipes = filterRecipes(DATA.recipes, query);
	const active = activeOptions(query);

	return (
		<>
			<PageTitle caption={formatShown(recipes.length, DATA.recipes.length)}>Recipes</PageTitle>
			<div className="flex gap-2">
				<input
					type="search"
					value={text}
					onChange={(event) => {
						setText(event.target.value);
						setQuery({ ...query, search: event.target.value });
					}}
					placeholder="Search recipes"
					aria-label="Search recipes"
					className={input}
				/>
				<button type="button" onClick={() => setSheet(true)} className={`${buttonPaper} shrink-0`}>
					{formatFiltersButton(activeCount(query))}
				</button>
			</div>
			{active.length > 0 ? (
				<div className="mt-3 flex flex-wrap gap-2">
					{active.map((option) => (
						<Chip
							key={`${option.kind}:${option.value}`}
							label={`${optionLabel(option)} ×`}
							ariaLabel={`Remove filter ${optionLabel(option)}`}
							on
							onClick={() => setQuery(toggle(query, option))}
						/>
					))}
				</div>
			) : null}

			{recipes.length === 0 ? (
				<div className="mt-7 rounded-card border border-rule-soft bg-inset p-4 shadow-card">
					<p className="font-mono text-muted text-sm">0 recipes resolved. Too picky?</p>
					<button
						type="button"
						onClick={() => {
							setText("");
							setQuery(clearFilters({ ...query, search: "" }));
						}}
						className={`${buttonPaper} mt-3`}
					>
						Clear search and filters
					</button>
				</div>
			) : (
				<ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-7 wide:grid-cols-3">
					<AnimatePresence mode="popLayout" initial={false}>
						{recipes.map((recipe, i) => (
							<RecipeCard key={recipe.id} recipe={recipe} index={i} />
						))}
					</AnimatePresence>
				</ul>
			)}

			<Sheet
				open={sheet}
				onClose={() => setSheet(false)}
				title="Filters"
				footer={
					<>
						<button
							type="button"
							disabled={active.length === 0}
							onClick={() => setQuery(clearFilters(query))}
							className={buttonPaper}
						>
							Clear
						</button>
						<button
							type="button"
							onClick={() => setSheet(false)}
							className={`${buttonPrimary} flex-1`}
						>
							{formatShowRecipes(recipes.length)}
						</button>
					</>
				}
			>
				<RecipeFilters recipes={DATA.recipes} query={query} onChange={setQuery} />
			</Sheet>
		</>
	);
}
