import type { Recipe } from "../lib/data";
import {
	DIETS,
	type FilterOption,
	facets,
	isOn,
	optionCount,
	optionLabel,
	type RecipeQuery,
	TIME_CAPS,
	toggle,
} from "../lib/filters";
import { formatOption } from "../lib/format";
import { Chip } from "./Chip";

type Props = {
	/** All the recipes: the options and their counts are computed from them. */
	recipes: readonly Recipe[];
	query: RecipeQuery;
	onChange: (query: RecipeQuery) => void;
};

/**
 * The filter sections: diet, author (with two or more), cuisine, time, tags.
 * Each option says how many recipes it would give; one that gives none is dimmed.
 */
export function RecipeFilters({ recipes, query, onChange }: Props) {
	const found = facets(recipes);
	const sections: { name: string; options: FilterOption[] }[] = [
		{ name: "Diet", options: DIETS.map((value) => ({ kind: "diet", value })) },
		...(found.authors.length >= 2
			? [
					{
						name: "Author",
						options: found.authors.map((value) => ({ kind: "author", value }) as const),
					},
				]
			: []),
		{ name: "Cuisine", options: found.cuisines.map((value) => ({ kind: "cuisine", value })) },
		{ name: "Time", options: TIME_CAPS.map((value) => ({ kind: "time", value })) },
		{ name: "Tags", options: found.tags.map((value) => ({ kind: "tag", value })) },
	];
	return (
		<div className="space-y-4">
			{sections
				.filter((section) => section.options.length > 0)
				.map((section) => (
					<section key={section.name}>
						<h3 className="font-mono text-muted text-xs uppercase tracking-[0.2em]">
							{section.name}
						</h3>
						<div className="mt-2 flex flex-wrap gap-2">
							{section.options.map((option) => {
								const count = optionCount(recipes, query, option);
								return (
									<Chip
										key={`${option.kind}:${option.value}`}
										label={formatOption(optionLabel(option), count)}
										on={isOn(query, option)}
										dim={count === 0}
										onClick={() => onChange(toggle(query, option))}
									/>
								);
							})}
						</div>
					</section>
				))}
		</div>
	);
}
