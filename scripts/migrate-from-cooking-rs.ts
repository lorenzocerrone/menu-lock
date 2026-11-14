/**
 * One-off: convert cooking-rs's data into menu.lock's format (REWRITE_PLAN §8,
 * phase 2). Kept for reference; the data it wrote is committed.
 *
 *   tsx scripts/migrate-from-cooking-rs.ts ../cooking-rs
 *
 * - ingredients.json: `category` → `aisle`, `per_piece` → `perPiece`.
 * - recipes: `prep_time`/`cook_time` → `prepTime`/`cookTime`, `image:
 *   "images/x.svg"` → `"x.svg"`, each line's `name` → the dictionary key (the
 *   old lookup: key, display name or alias; case-insensitive; singular/plural),
 *   the `vegetarian` tag dropped after checking it agrees with the ingredients,
 *   the per-line `aisle` dropped.
 * - images/*.svg → public/images/.
 *
 * Fails loudly, writing nothing, on anything it can't map.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type OldCount = { label?: string; plural?: string; per_piece?: number };
type OldIngredient = {
	name: string;
	unit: string;
	category: string;
	count?: OldCount;
	aliases?: string[];
};
type OldLine = {
	name: string;
	amount?: number;
	unit?: string;
	note?: string;
	optional?: boolean;
	aisle?: string;
};
type OldRecipe = {
	id: string;
	title: string;
	author: string;
	servings: number;
	description?: string;
	cuisine?: string;
	tags?: string[];
	prep_time?: number;
	cook_time?: number;
	image?: string;
	ingredients: OldLine[];
	steps: string[];
};

const source = process.argv[2];
if (!source) {
	console.error("usage: tsx scripts/migrate-from-cooking-rs.ts <path to cooking-rs>");
	process.exit(2);
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const problems: string[] = [];

// ---- dictionary ----
const oldDictionary = readJson<Record<string, OldIngredient>>(join(source, "ingredients.json"));

const normalize = (name: string) => name.trim().split(/\s+/).join(" ").toLowerCase();

/** cooking-rs's IngredientCatalog::lookup. */
function lookup(name: string): string | null {
	const n = normalize(name);
	const candidates = [n];
	if (n.endsWith("es")) candidates.push(n.slice(0, -2));
	if (n.endsWith("s")) candidates.push(n.slice(0, -1));
	candidates.push(`${n}s`);
	for (const c of candidates) {
		const key = c.replaceAll(" ", "_");
		if (key in oldDictionary) return key;
		for (const [k, entry] of Object.entries(oldDictionary)) {
			if (normalize(entry.name) === c || (entry.aliases ?? []).some((a) => normalize(a) === c))
				return k;
		}
	}
	return null;
}

const inline = (value: unknown): string =>
	Array.isArray(value)
		? `[${value.map(inline).join(", ")}]`
		: typeof value === "object" && value !== null
			? `{ ${Object.entries(value)
					.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`)
					.join(", ")} }`
			: JSON.stringify(value);

let previousAisle = "";
const dictionaryLines = Object.entries(oldDictionary).map(([key, old]) => {
	// A blank line between aisles, as in the old file.
	const gap = previousAisle !== "" && previousAisle !== old.category ? "\n" : "";
	previousAisle = old.category;
	const entry: Record<string, unknown> = { name: old.name, unit: old.unit, aisle: old.category };
	if (old.count) {
		const count: Record<string, unknown> = {};
		if (old.count.label !== undefined) count.label = old.count.label;
		if (old.count.plural !== undefined) count.plural = old.count.plural;
		if (old.count.per_piece !== undefined) count.perPiece = old.count.per_piece;
		entry.count = count;
	}
	if (old.aliases?.length) entry.aliases = old.aliases;
	return `${gap}  ${JSON.stringify(key)}: ${inline(entry)}`;
});

// ---- recipes ----
const recipeDir = join(source, "recipes");
const recipeOutputs: { file: string; text: string }[] = [];
const images = new Set<string>();

for (const file of readdirSync(recipeDir)
	.filter((f) => f.endsWith(".json"))
	.sort()) {
	const old = readJson<OldRecipe>(join(recipeDir, file));
	let meat = false;
	const lines = old.ingredients.map((line, i) => {
		const key = lookup(line.name);
		if (key === null) {
			problems.push(`${file}, ingredient ${i + 1}: "${line.name}" is not in the dictionary`);
			return "";
		}
		if (["Meat", "Fish"].includes(oldDictionary[key]?.category ?? "")) meat = true;
		const out: Record<string, unknown> = { ingredient: key };
		if (line.amount !== undefined) out.amount = line.amount;
		if (line.unit !== undefined) out.unit = line.unit;
		if (line.note !== undefined) out.note = line.note;
		if (line.optional) out.optional = true;
		return `    ${inline(out)}`;
	});

	const tagged = (old.tags ?? []).includes("vegetarian");
	if (tagged === meat) {
		problems.push(
			`${file}: the vegetarian tag (${tagged ? "set" : "not set"}) disagrees with the ingredients (${meat ? "has" : "no"} meat or fish)`,
		);
	}
	const tags = (old.tags ?? []).filter((t) => t !== "vegetarian");

	let image: string | undefined;
	if (old.image) {
		image = old.image.replace(/^images\//, "");
		images.add(image);
	}

	const fields: [string, unknown][] = [
		["id", old.id],
		["title", old.title],
		["author", old.author],
		["servings", old.servings],
		["description", old.description],
		["cuisine", old.cuisine],
		["tags", tags.length > 0 ? tags : undefined],
		["prepTime", old.prep_time],
		["cookTime", old.cook_time],
		["image", image],
	];
	const text = [
		"{",
		...fields
			.filter(([, v]) => v !== undefined)
			.map(([k, v]) => `  ${JSON.stringify(k)}: ${inline(v)},`),
		'  "ingredients": [',
		lines.join(",\n"),
		"  ],",
		'  "steps": [',
		old.steps.map((s) => `    ${JSON.stringify(s)}`).join(",\n"),
		"  ]",
		"}",
		"",
	].join("\n");
	recipeOutputs.push({ file, text });
}

if (problems.length > 0) {
	console.error(`Not migrated: ${problems.length} problem(s)\n  - ${problems.join("\n  - ")}`);
	process.exit(1);
}

mkdirSync("data/recipes", { recursive: true });
mkdirSync("public/images", { recursive: true });
writeFileSync("data/ingredients.json", `{\n${dictionaryLines.join(",\n")}\n}\n`);
for (const { file, text } of recipeOutputs) writeFileSync(join("data/recipes", file), text);
for (const image of images)
	copyFileSync(join(source, "images", image), join("public/images", image));

console.log(
	`Migrated ${dictionaryLines.length} dictionary entries, ${recipeOutputs.length} recipes and ${images.size} images.`,
);
console.log("The vegetarian tag agreed with the ingredients on every recipe; it is now computed.");
