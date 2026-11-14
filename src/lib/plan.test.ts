import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
	addExtra,
	addMeal,
	addNote,
	clearMeals,
	day,
	dropBefore,
	EMPTY_PLAN,
	entries,
	entriesIn,
	isEmpty,
	isNote,
	lastDate,
	type MealEntry,
	mealCount,
	moveMeal,
	type Plan,
	removeExtra,
	removeMeal,
	reorderMeal,
	setChanges,
	setNoteBuy,
	setServings,
} from "./plan";

/** A Sunday. */
const TODAY = "2026-10-25";
const d = (n: number) => addDays(TODAY, n);
const ids = (meals: readonly MealEntry[]) => meals.map((m) => (isNote(m) ? m.note : m.recipe));

describe("plan", () => {
	it("adds, removes, sets servings, and reads ranges", () => {
		let plan: Plan = EMPTY_PLAN;
		expect(isEmpty(plan)).toBe(true);
		expect(lastDate(plan)).toBeNull();

		plan = addMeal(plan, d(2), "dal");
		plan = addMeal(plan, d(0), "soup");
		plan = addMeal(plan, d(9), "tacos");
		expect(isEmpty(plan)).toBe(false);
		expect(ids(entries(plan))).toEqual(["soup", "dal", "tacos"]); // date order
		expect(mealCount(plan)).toBe(3);
		expect(lastDate(plan)).toBe(d(9));

		expect(ids(entriesIn(plan, d(0), d(2)))).toEqual(["soup", "dal"]);
		expect(entriesIn(plan, d(3), d(8))).toEqual([]);
		expect(entriesIn(plan, d(2), d(0))).toEqual([]); // reversed

		plan = setServings(plan, d(2), 0, 6);
		expect(setServings(plan, d(2), 5, 6)).toBe(plan); // no such meal
		expect(setServings(plan, d(4), 0, 6)).toBe(plan); // no such day
		expect(day(plan, d(2))[0]).toEqual({ recipe: "dal", servings: 6 });
		expect(d(4) in plan.dates).toBe(false);

		expect(removeMeal(plan, d(2), 3)).toBe(plan);
		plan = removeMeal(plan, d(2), 0);
		expect(d(2) in plan.dates).toBe(false); // empty day dropped

		plan = dropBefore(plan, d(1));
		expect(mealCount(plan)).toBe(1);
		expect(lastDate(plan)).toBe(d(9));
		expect(dropBefore(plan, d(1))).toBe(plan);

		expect(isEmpty(addExtra(EMPTY_PLAN, { kind: "custom", name: "bread", quantity: null }))).toBe(
			false,
		);
	});

	it("stores servings equal to the recipe's own as absent", () => {
		let plan = addMeal(EMPTY_PLAN, d(0), "dal");
		plan = setServings(plan, d(0), 0, 6, 4);
		expect(day(plan, d(0))[0]).toEqual({ recipe: "dal", servings: 6 });
		plan = setServings(plan, d(0), 0, 4, 4);
		expect(day(plan, d(0))[0]).toEqual({ recipe: "dal" });
		plan = setServings(plan, d(0), 0, 3);
		plan = setServings(plan, d(0), 0, undefined);
		expect(day(plan, d(0))[0]).toEqual({ recipe: "dal" });
		expect(setServings(plan, d(0), 0, undefined)).toBe(plan);
	});

	it("moves a meal to the end of another day, keeping servings and dropping an emptied day", () => {
		let plan = addMeal(EMPTY_PLAN, d(0), "dal");
		plan = setServings(plan, d(0), 0, 6);
		plan = addMeal(plan, d(3), "soup");
		const moved = moveMeal(plan, d(0), 0, d(3));
		expect(moved?.index).toBe(1);
		expect(d(0) in (moved?.plan.dates ?? {})).toBe(false);
		expect(moved && day(moved.plan, d(3))[1]).toEqual({ recipe: "dal", servings: 6 });
	});

	it("moves a meal to a position in another day (drag and drop)", () => {
		let plan = addMeal(EMPTY_PLAN, d(0), "dal");
		plan = addMeal(plan, d(1), "soup");
		plan = addMeal(plan, d(1), "tacos");
		const first = moveMeal(plan, d(0), 0, d(1), 0);
		expect(first?.index).toBe(0);
		expect(first && ids(day(first.plan, d(1)))).toEqual(["dal", "soup", "tacos"]);
		const middle = moveMeal(plan, d(0), 0, d(1), 1);
		expect(middle && ids(day(middle.plan, d(1)))).toEqual(["soup", "dal", "tacos"]);
		const clamped = moveMeal(plan, d(0), 0, d(1), 99);
		expect(clamped?.index).toBe(2);
		const empty = moveMeal(plan, d(1), 1, d(5), 0);
		expect(empty && ids(day(empty.plan, d(5)))).toEqual(["tacos"]);
	});

	it("ignores moves within the same day and of missing meals", () => {
		const plan = addMeal(EMPTY_PLAN, d(0), "dal");
		expect(moveMeal(plan, d(0), 0, d(0))).toBeNull();
		expect(moveMeal(plan, d(0), 1, d(1))).toBeNull();
		expect(moveMeal(plan, d(2), 0, d(0))).toBeNull();
	});

	it("reorders within a day, within bounds only", () => {
		let plan = addMeal(EMPTY_PLAN, d(0), "dal");
		plan = addMeal(plan, d(0), "soup");
		plan = addMeal(plan, d(0), "tacos");
		expect(ids(day(reorderMeal(plan, d(0), 0, 1), d(0)))).toEqual(["soup", "dal", "tacos"]);
		expect(ids(day(reorderMeal(plan, d(0), 2, 0), d(0)))).toEqual(["tacos", "dal", "soup"]);
		expect(ids(day(reorderMeal(plan, d(0), 0, 2), d(0)))).toEqual(["soup", "tacos", "dal"]);
		expect(reorderMeal(plan, d(0), 1, 3)).toBe(plan);
		expect(reorderMeal(plan, d(0), 0, -1)).toBe(plan);
		expect(reorderMeal(plan, d(0), 1, 1)).toBe(plan);
		expect(reorderMeal(plan, d(1), 0, 1)).toBe(plan);
	});

	it("clears meals but keeps extras", () => {
		let plan = addMeal(EMPTY_PLAN, d(0), "dal");
		plan = addExtra(plan, { kind: "custom", name: "Bread", quantity: null });
		plan = clearMeals(plan);
		expect(mealCount(plan)).toBe(0);
		expect(plan.extras).toHaveLength(1);
		expect(isEmpty(plan)).toBe(false);
		expect(removeExtra(plan, 3)).toBe(plan);
		expect(isEmpty(removeExtra(plan, 0))).toBe(true);
	});

	it("never mutates its input", () => {
		const plan = addMeal(EMPTY_PLAN, d(0), "dal");
		const frozen = JSON.stringify(plan);
		addMeal(plan, d(0), "soup");
		removeMeal(plan, d(0), 0);
		setServings(plan, d(0), 0, 3);
		moveMeal(plan, d(0), 0, d(1));
		addExtra(plan, { kind: "catalog", key: "milk" });
		expect(JSON.stringify(plan)).toBe(frozen);
		expect(JSON.stringify(EMPTY_PLAN)).toBe('{"dates":{},"extras":[]}');
	});

	it("holds things that are not recipes, to buy or not", () => {
		let plan = addNote(EMPTY_PLAN, d(0), "  Frozen pizza ", true);
		plan = addNote(plan, d(0), "Leftovers", false);
		expect(addNote(plan, d(0), "   ", true)).toBe(plan);
		expect(day(plan, d(0))).toEqual([{ note: "Frozen pizza", buy: true }, { note: "Leftovers" }]);
		expect(mealCount(plan)).toBe(2);

		plan = setNoteBuy(plan, d(0), 1, true);
		plan = setNoteBuy(plan, d(0), 0, false);
		expect(day(plan, d(0))).toEqual([{ note: "Frozen pizza" }, { note: "Leftovers", buy: true }]);
		expect(setNoteBuy(plan, d(0), 0, false)).toBe(plan);

		// They move and reorder like any meal; servings and changes don't apply to them.
		expect(setServings(plan, d(0), 0, 4)).toBe(plan);
		expect(setChanges(plan, d(0), 0, [{ kind: "skip", key: "salt" }])).toBe(plan);
		const moved = moveMeal(plan, d(0), 0, d(2));
		expect(moved && day(moved.plan, d(2))).toEqual([{ note: "Frozen pizza" }]);
		plan = addMeal(plan, d(0), "dal");
		expect(setNoteBuy(plan, d(0), 2, true)).toBe(plan); // a recipe is not a note
		expect(ids(day(reorderMeal(plan, d(0), 2, 0), d(0)))).toEqual([
			"dal",
			"Frozen pizza",
			"Leftovers",
		]);
	});

	it("keeps a meal's ingredient changes, through servings changes too", () => {
		let plan = addMeal(EMPTY_PLAN, d(0), "dal");
		plan = setChanges(plan, d(0), 0, [{ kind: "swap", key: "scallion", for: "onion" }]);
		expect(day(plan, d(0))[0]).toEqual({
			recipe: "dal",
			changes: [{ kind: "swap", key: "scallion", for: "onion" }],
		});
		plan = setServings(plan, d(0), 0, 6, 4);
		expect(day(plan, d(0))[0]).toEqual({
			recipe: "dal",
			servings: 6,
			changes: [{ kind: "swap", key: "scallion", for: "onion" }],
		});
		plan = setServings(plan, d(0), 0, 4, 4);
		expect(day(plan, d(0))[0]).toEqual({
			recipe: "dal",
			changes: [{ kind: "swap", key: "scallion", for: "onion" }],
		});
		plan = setChanges(plan, d(0), 0, []);
		expect(day(plan, d(0))[0]).toEqual({ recipe: "dal" });
		expect(setChanges(plan, d(0), 4, [])).toBe(plan);
	});
});
