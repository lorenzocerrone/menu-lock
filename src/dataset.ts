/**
 * The bundled data: every file in data/, validated and resolved once at
 * startup. `npm run check` validates the same files (src/lib/dataFiles.test.ts),
 * so a problem here means the build shipped without it.
 */
import rawDictionary from "../data/ingredients.json";
import { type Data, loadData } from "./lib/data";

const modules = import.meta.glob<unknown>("../data/recipes/*.json", {
	eager: true,
	import: "default",
});

const { data, problems } = loadData(
	rawDictionary,
	Object.entries(modules).map(([path, json]) => ({ file: path.split("/").pop() ?? path, json })),
);
if (!data) throw new Error(`The recipe data is not valid:\n${problems.join("\n")}`);

export const DATA: Data = data;
