/** Test fixtures shared by the logic tests. Not imported by the app. */
import { type Data, loadData, type RecipeFile } from "./data";

/** A small dictionary shared by the logic tests. */
export const DICTIONARY = {
	onion: { name: "Onion", unit: "g", aisle: "Produce", count: { perPiece: 150 } },
	garlic: { name: "Garlic", unit: "g", aisle: "Produce", count: { label: "clove", perPiece: 4 } },
	olive_oil: { name: "Olive oil", unit: "ml", aisle: "Spices & Oils" },
	chopped_tomatoes: {
		name: "Chopped tomatoes",
		unit: "pcs",
		aisle: "Pantry",
		count: { label: "can", perPiece: 400 },
		aliases: ["tinned tomatoes", "canned tomatoes"],
	},
	egg: { name: "Egg", unit: "pcs", aisle: "Dairy & Eggs" },
	lemon: { name: "Lemon", unit: "pcs", aisle: "Produce" },
	salt: { name: "Salt", unit: "g", aisle: "Spices & Oils" },
	scallion: {
		name: "Scallion",
		unit: "g",
		aisle: "Produce",
		count: { perPiece: 15 },
		aliases: ["spring onion", "green onion"],
	},
	guanciale: { name: "Guanciale", unit: "g", aisle: "Meat" },
	milk: { name: "Milk", unit: "ml", aisle: "Dairy & Eggs" },
	bread: {
		name: "Bread",
		unit: "pcs",
		aisle: "Bakery",
		count: { label: "loaf", plural: "loaves" },
	},
	breadcrumbs: { name: "Breadcrumbs", unit: "g", aisle: "Pantry" },
	gelatin: { name: "Gelatin sheets", unit: "g", aisle: "Pantry", vegetarian: false },
	flour: { name: "Flour", unit: "g", aisle: "Bakery" },
	salmon: {
		name: "Salmon fillet",
		unit: "g",
		aisle: "Fish",
		count: { label: "fillet", perPiece: 125 },
	},
} as const;

type Line = {
	ingredient: string;
	amount?: number;
	unit?: string;
	note?: string;
	optional?: boolean;
};

export function recipeFile(
	id: string,
	servings: number,
	ingredients: Line[],
	extra = {},
): RecipeFile {
	return {
		file: `${id}.json`,
		json: {
			id,
			title: id.toUpperCase(),
			author: "Claude",
			servings,
			ingredients,
			steps: ["Cook."],
			...extra,
		},
	};
}

/** Resolved data for a set of recipe files; throws on any validation problem. */
export function fixtureData(files: RecipeFile[], dictionary: unknown = DICTIONARY): Data {
	const { data, problems } = loadData(dictionary, files);
	if (!data) throw new Error(`fixture does not load:\n${problems.join("\n")}`);
	return data;
}
