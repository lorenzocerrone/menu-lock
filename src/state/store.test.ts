import { describe, expect, it } from "vitest";
import { addDays } from "../lib/dates";
import { fixtureData, recipeFile } from "../lib/fixtures";
import { allLines, DEFAULT_GROCERY, isChecked } from "../lib/grocery";
import { addMeal, EMPTY_PLAN } from "../lib/plan";
import { createAppStore, groceryList } from "./store";

const TODAY = "2026-10-25";
const d = (n: number) => addDays(TODAY, n);
const data = fixtureData([
	recipeFile("dal", 4, [{ ingredient: "onion", amount: 1 }, { ingredient: "salt" }]),
	recipeFile("tacos", 2, [{ ingredient: "onion", amount: 100, unit: "g" }]),
]);

const make = (plan = EMPTY_PLAN) => createAppStore(data, TODAY, { plan, grocery: DEFAULT_GROCERY });
const line = (store: ReturnType<typeof make>, key: string) => {
	const found = allLines(groceryList(store.getState(), data)).find((l) => l.key === key);
	if (!found) throw new Error(`no line ${key}`);
	return found;
};

describe("store", () => {
	it("drops past days when it starts and when the date changes", () => {
		const store = make(addMeal(addMeal(EMPTY_PLAN, d(-1), "dal"), d(1), "tacos"));
		expect(Object.keys(store.getState().plan.dates)).toEqual([d(1)]);
		store.getState().setToday(d(2));
		expect(store.getState().today).toBe(d(2));
		expect(store.getState().plan.dates).toEqual({});
	});

	it("edits the plan", () => {
		const store = make();
		const s = () => store.getState();
		s().addMeal(d(0), "dal");
		s().addMeal(d(0), "tacos");
		s().reorderMeal(d(0), 1, 0);
		expect(s().plan.dates[d(0)]).toEqual([{ recipe: "tacos" }, { recipe: "dal" }]);
		expect(s().moveMeal(d(0), 0, d(2))).toBe(0);
		expect(s().moveMeal(d(0), 5, d(2))).toBeNull();
		s().setServings(d(0), 0, 6);
		expect(s().plan.dates[d(0)]).toEqual([{ recipe: "dal", servings: 6 }]);
		s().setServings(d(0), 0, 4); // the recipe's own: stored as absent
		expect(s().plan.dates[d(0)]).toEqual([{ recipe: "dal" }]);
		s().setServings(d(0), 0, 0); // never below 1
		expect(s().plan.dates[d(0)]).toEqual([{ recipe: "dal", servings: 1 }]);
		s().removeMeal(d(2), 0);
		expect(Object.keys(s().plan.dates)).toEqual([d(0)]);
		s().addExtra({ kind: "custom", name: "Soap", quantity: null });
		s().removeExtra(0);
		expect(s().plan.extras).toEqual([]);
		s().loadPlan(addMeal(EMPTY_PLAN, d(-3), "dal"));
		expect(s().plan.dates).toEqual({});
	});

	it("drops a tick when the plan needs more, keeps it when it needs less", () => {
		const store = make(addMeal(EMPTY_PLAN, d(0), "dal"));
		const s = () => store.getState();
		s().toggleTick(line(store, "onion"));
		s().toggleTick(line(store, "salt"));
		expect(isChecked(s().grocery, "onion")).toBe(true);

		s().addMeal(d(1), "tacos"); // more onion
		expect(isChecked(s().grocery, "onion")).toBe(false);
		expect(isChecked(s().grocery, "salt")).toBe(true);

		s().toggleTick(line(store, "onion"));
		s().removeMeal(d(1), 0); // less onion: still bought
		expect(isChecked(s().grocery, "onion")).toBe(true);
		s().toggleTick(line(store, "onion"));
		expect(isChecked(s().grocery, "onion")).toBe(false);
	});

	it("drops ticks for lines that leave the range", () => {
		const store = make(addMeal(addMeal(EMPTY_PLAN, d(0), "dal"), d(5), "tacos"));
		const s = () => store.getState();
		s().toggleTick(line(store, "onion")); // 250 g over all planned days
		s().setRange({ days: 1 }); // today only: 150 g, less
		expect(isChecked(s().grocery, "onion")).toBe(true);
		s().setRange("all"); // 250 g again, as when it was ticked
		expect(isChecked(s().grocery, "onion")).toBe(true);
		s().setRange({ days: 1 });
		s().toggleTick(line(store, "onion"));
		s().toggleTick(line(store, "onion")); // ticked at 150 g
		s().setRange("all"); // now 250 g: more
		expect(isChecked(s().grocery, "onion")).toBe(false);
	});

	it("clears meals or everything, and the ticks either way", () => {
		const store = make(addMeal(EMPTY_PLAN, d(0), "dal"));
		const s = () => store.getState();
		s().addExtra({ kind: "custom", name: "Soap", quantity: null });
		s().toggleTick(line(store, "custom:soap"));
		s().clearPlan("meals");
		expect(s().plan).toEqual({
			dates: {},
			extras: [{ kind: "custom", name: "Soap", quantity: null }],
		});
		expect(s().grocery.checked).toEqual([]);
		s().clearPlan("everything");
		expect(s().plan).toEqual(EMPTY_PLAN);
	});

	it("plans things that are not recipes, and changes a meal's ingredients", () => {
		const store = make();
		const s = () => store.getState();
		s().addNote(d(0), "Frozen pizza", true);
		expect(allLines(groceryList(s(), data)).map((l) => l.key)).toEqual(["custom:frozen pizza"]);
		s().setNoteBuy(d(0), 0, false);
		expect(allLines(groceryList(s(), data))).toEqual([]);
		s().setServings(d(0), 0, 3); // not a recipe: nothing happens
		expect(s().plan.dates[d(0)]).toEqual([{ note: "Frozen pizza" }]);

		s().addMeal(d(0), "dal");
		s().toggleTick(line(store, "onion"));
		s().changeMeal(d(0), 1, { kind: "set", key: "onion", amount: 3 });
		expect(line(store, "onion").amount).toBe(450);
		expect(isChecked(s().grocery, "onion")).toBe(false); // it needs more now
		s().changeMeal(d(0), 1, { kind: "skip", key: "onion" }); // replaces the change to onion
		expect(s().plan.dates[d(0)]?.[1]).toEqual({
			recipe: "dal",
			changes: [{ kind: "skip", key: "onion" }],
		});
		expect(allLines(groceryList(s(), data)).map((l) => l.key)).toEqual(["salt"]);
		s().resetChange(d(0), 1, "onion");
		expect(s().plan.dates[d(0)]?.[1]).toEqual({ recipe: "dal" });
		s().changeMeal(d(0), 0, { kind: "skip", key: "onion" }); // a note has no ingredients
		expect(s().plan.dates[d(0)]?.[0]).toEqual({ note: "Frozen pizza" });
	});
});
