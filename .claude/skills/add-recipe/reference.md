# add-recipe reference

Facts from the code (`src/lib/schema.ts`, `src/lib/data.ts`, `src/lib/units.ts`). If
something here disagrees with the code, the code wins.

## Recipe file (`data/recipes/<id>.json`)

```json
{
	"id": "lentil_dal",
	"title": "Lentil Dal",
	"author": "Lorenzo",
	"servings": 4,
	"description": "Red lentils simmered with onion, garlic and coconut milk.",
	"cuisine": "Indian",
	"tags": ["dinner", "comfort"],
	"prepTime": 10,
	"cookTime": 30,
	"ingredients": [
		{ "ingredient": "lentils", "amount": 300, "unit": "g", "note": "red" },
		{ "ingredient": "onion", "amount": 1, "note": "finely chopped" },
		{ "ingredient": "garlic", "amount": 3, "unit": "cloves" },
		{ "ingredient": "coconut_milk", "amount": 0.5, "unit": "can" },
		{ "ingredient": "olive_oil", "amount": 1, "unit": "tbsp" },
		{ "ingredient": "chives", "amount": 5, "unit": "g", "optional": true },
		{ "ingredient": "salt" }
	],
	"steps": [
		"Soften the onion and garlic in the oil.",
		"Add the lentils and coconut milk and simmer for 25 minutes."
	]
}
```

House style: 2-space indent, the field order above, one ingredient object per line, one
step per line. `npm run format` keeps it that way.

- `id`: the title as `snake_case` (`a-z`, `0-9`, single underscores). Equals the file
  name. Never changes once published: it is in share links.
- Required: `id`, `title`, `author`, `servings` (whole number ≥ 1), `ingredients` (≥ 1),
  `steps` (≥ 1). Optional: `description`, `cuisine`, `tags`, `prepTime`, `cookTime`
  (minutes), `image`.
- Unknown fields are errors (so `prep_time` or `name` is caught).
- An ingredient line:
  - `ingredient`: a key of `data/ingredients.json`. Not the display name.
  - `amount`: a number > 0. Leave it out for "to taste".
  - `unit`: `g kg ml l tsp tbsp cup pcs`, the entry's piece label, singular or plural
    (`clove`, `cloves`, `can`), or any word (`ball`, `bunch`). **No `unit` means a count
    of pieces** ("onion, 1"). No `unit` without an `amount`.
  - `note`: shown after the name ("finely chopped", "red"). The place for a variety or a
    preparation.
  - `optional: true`: listed but flagged, in the recipe and on the grocery list.
- The recipe page shows the dictionary's `name`, the amount in the unit as written, and
  the note. Steps keep the user's own words ("stock") even when the dictionary name
  differs ("Vegetable broth").

## Amounts and units

- **An amount may be in any unit**: `g kg ml l tsp tbsp cup pcs`, the entry's piece
  label, or a word of the recipe's own (`ball`, `bunch`, `zest`). The ingredient must
  still be a dictionary key.
- **What converts into the entry's shopping unit is added up** on the grocery list:
  - mass (`g`, `kg`) into a `g` entry; volume (`ml`, `l`, `tsp` = 5 ml, `tbsp` = 15 ml,
    `cup` = 240 ml) into an `ml` entry; a count into a `pcs` entry;
  - a count (no unit, `pcs`, or the piece label) into a `g` or `ml` entry that has
    `count.perPiece`: pieces × `perPiece`;
  - grams into a `pcs` entry that has `count.perPiece`: grams ÷ `perPiece` ("400 g
    chopped tomatoes" is 1 can).
- **What doesn't convert is listed beside the total**, in its own unit, still scaled
  with the servings: "Mozzarella 250 g + 1 ball", "Butter 100 g + 2 tbsp". There are no
  densities, so `1 tbsp butter` or `1 cup flour` is such an amount.
- **Keep the recipe's own units where they matter**: grams in pastry (even for eggs or
  butter), a count or a word in everyday cooking ("1 ball of mozzarella", "a bunch of
  basil"). Don't convert a pastry recipe's grams into pieces, or round a precise amount.
- Otherwise prefer a unit that converts, so the list adds up into one number: write
  `1 tbsp butter` as 14 g when the recipe doesn't care. Rough values, listed in the
  preview's Guesses whenever used:
  - ground spice 1 tsp ≈ 2 g, 1 tbsp ≈ 6 g; dried herbs 1 tsp ≈ 1 g
  - salt 1 tsp ≈ 6 g; sugar 1 tbsp ≈ 12 g, 1 cup ≈ 200 g; flour 1 cup ≈ 125 g
  - butter 1 tbsp ≈ 14 g, a knob ≈ 15 g; honey 1 tbsp ≈ 21 g; peanut butter 1 tbsp ≈ 16 g
  - rice 1 cup ≈ 190 g; oats 1 cup ≈ 90 g; grated cheese 1 cup ≈ 100 g
  - lentils / dried beans 1 cup ≈ 200 g; frozen peas 1 cup ≈ 140 g
  - US/imperial: 1 oz = 28 g, 1 lb = 450 g, 1 fl oz = 30 ml, 1 pint = 470 ml (US)
- Rewrite every line into amount, unit, ingredient, note: "juice of half a lemon" →
  `{ "ingredient": "lemon", "amount": 0.5, "note": "juiced" }`.
- Vague amounts with a usual size get one, listed under Guesses: a knob ≈ 15 g, a handful
  of leaves ≈ 30 g. Those without ("a pinch", "a splash", "to taste", "for frying") → no
  amount.
- Keep the recipe's own servings; don't rescale on add.

## Mapping to the dictionary

- An entry answers to its key, its display name and its `aliases`, ignoring case,
  singular or plural. "spring onions" is `scallion`; "tinned tomatoes" is
  `chopped_tomatoes`.
- Use an existing entry whenever the shopping is the same: "extra-virgin olive oil" →
  `olive_oil`; "red lentils" → `lentils` with `"note": "red"`; "vegetable stock" →
  `vegetable_broth`. The grocery list then adds it up with the other recipes.
- A different thing to buy gets a new entry ("curry leaves", "star anise", "red onion"
  beside "onion").

## Dictionary (`data/ingredients.json`)

One entry per line, grouped by aisle with a blank line between groups; add a new entry
at the end of its aisle's group.

```json
"coconut_milk": { "name": "Coconut milk", "unit": "ml", "aisle": "Pantry", "count": { "label": "can", "perPiece": 400 } },
"scallion": { "name": "Scallion", "unit": "g", "aisle": "Produce", "count": { "perPiece": 15 }, "aliases": ["spring onion", "green onion"] },
"egg": { "name": "Egg", "unit": "pcs", "aisle": "Dairy & Eggs", "count": { "perPiece": 55 } },
```

- key: `snake_case`, singular unless the thing is plural (`chickpeas`, `peas`). Stable
  forever: it is the grocery tick identity and appears in share links.
- `name`: shown on the recipe and the grocery list, capitalised ("Curry leaves").
- `unit`: the shopping unit, how it is bought and summed: `g`, `ml` or `pcs`. Spices,
  honey and butter in `g`; liquids in `ml`; things bought by the piece (eggs, lemons,
  tortillas, cans) in `pcs`.
- `aisle`: exactly one of, in shop order: `Produce`, `Meat`, `Fish`, `Dairy & Eggs`,
  `Pasta & Grains`, `Bakery`, `Legumes`, `Pantry`, `Frozen`, `Spices & Oils`. Meat and
  Fish make a recipe non-vegetarian.
- `vegetarian: false` (optional) for an animal product in another aisle (gelatin, lard,
  anchovy paste in Pantry): it makes a recipe non-vegetarian too.
- `count` (optional), needed whenever recipes count it in pieces:
  - `perPiece`: one piece in the shopping unit (onion 150 g, garlic clove 4 g, can
    400 ml). For a `pcs` entry: the grams in one piece, so recipes can still write grams.
  - `label`: what one piece is called (`clove`, `can`, `fillet`, `sprig`, `thumb`);
    recipes may use it as the unit. `plural` only if it is not label + "s" (`loaf` /
    `loaves`).
- `aliases` (optional): other names for the same thing to buy. Add one when the input
  used a common name the dictionary doesn't answer to yet.
- No two entries may share a name or alias, in any case, singular or plural.

## Tags and cuisines in use

Tags: one course tag per recipe, `pasta`, `risotto`, `main`, `side`, `salad`, `dessert`
or `party` (dips and finger food), plus any of `quick` (about 30 min or less in total),
`comfort`, `no-cook`, `make-ahead`, `classic`. Reuse these; add a new one only if it
would be useful as a filter. Not `vegetarian`: computed.
Cuisines: Asian, Greek, Italian, Mexican, Middle Eastern. Reuse the same spelling; leave
it out when the dish has no clear one.

## What `npm run check` checks in the data

Every file parses and has no unknown fields; ids are `snake_case`, equal their file
names and are unique; title, author, servings ≥ 1, at least one ingredient and one
non-empty step; every `ingredient` is a dictionary key; every amount is > 0; no
`unit` without `amount`; no `vegetarian` tag; a named
`image` exists in `public/images/`; dictionary units are `g`/`ml`/`pcs`, aisles are from
the list, `perPiece` > 0, and no name or alias points at two entries.

A failure reads like:

```
data/recipes/pancakes.json, ingredient 1 (flour): "flor" is not a key in data/ingredients.json; use "flour"
```
