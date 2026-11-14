import { DATA } from "../dataset";
import { EmptyState } from "../ui/EmptyState";

export function RecipesPage() {
	return (
		<EmptyState
			title="Recipes"
			line={`${DATA.recipes.length} recipes resolved from ${DATA.dictionary.entries.size} ingredients. Screens land in phase 3.`}
		/>
	);
}
