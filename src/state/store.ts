/**
 * The one store: the plan, this device's grocery state, and "today". Every
 * action goes through src/lib and then settles the state: past days drop off
 * the plan and ticks that no longer hold are dropped (REWRITE_PLAN §5.5, §5.6).
 */
import { createStore } from "zustand/vanilla";
import { withChange, withoutChange } from "../lib/changes";
import type { Data } from "../lib/data";
import type { IsoDate } from "../lib/dates";
import {
	aggregate,
	clearChecked,
	type GroceryAisle,
	type GroceryLine,
	type GroceryRange,
	type GroceryState,
	pruneChecked,
	rangeEnd,
	toggleChecked,
} from "../lib/grocery";
import {
	addExtra,
	addMeal,
	addNote,
	clearMeals,
	day,
	dropBefore,
	EMPTY_PLAN,
	type Extra,
	isNote,
	type MealChange,
	moveMeal,
	type Plan,
	removeExtra,
	removeMeal,
	reorderMeal,
	setChanges,
	setNoteBuy,
	setServings,
} from "../lib/plan";
import type { StoredState } from "../lib/stored";

export type AppState = {
	today: IsoDate;
	plan: Plan;
	grocery: GroceryState;

	/** Replace the whole plan (a link was opened). */
	loadPlan: (plan: Plan) => void;
	/** The date changed while the app was open. */
	setToday: (today: IsoDate) => void;
	addMeal: (date: IsoDate, recipe: string) => void;
	/** Something that is not a recipe ("Frozen pizza"); `buy` puts it on the grocery list too. */
	addNote: (date: IsoDate, note: string, buy: boolean) => void;
	setNoteBuy: (date: IsoDate, index: number, buy: boolean) => void;
	/** Change one ingredient of a planned recipe, for that meal only (replaces any earlier change to it). */
	changeMeal: (date: IsoDate, index: number, change: MealChange) => void;
	/** Put one ingredient of a planned recipe back to the recipe's own. */
	resetChange: (date: IsoDate, index: number, key: string) => void;
	removeMeal: (date: IsoDate, index: number) => void;
	/** Returns the meal's new index, or `null` when nothing moved. */
	moveMeal: (from: IsoDate, index: number, to: IsoDate, toIndex?: number) => number | null;
	reorderMeal: (date: IsoDate, from: number, to: number) => void;
	setServings: (date: IsoDate, index: number, servings: number) => void;
	/** "meals" keeps the extras; "everything" clears them too. Both clear the ticks. */
	clearPlan: (what: "meals" | "everything") => void;
	addExtra: (extra: Extra) => void;
	removeExtra: (index: number) => void;
	toggleTick: (line: GroceryLine) => void;
	setRange: (range: GroceryRange) => void;
};

/** The grocery list for a state: its plan, from today to the end of its range. */
export function groceryList(
	state: Pick<AppState, "plan" | "grocery" | "today">,
	data: Data,
): GroceryAisle[] {
	const { plan, grocery, today } = state;
	return aggregate(plan, today, rangeEnd(grocery.range, plan, today), data);
}

export function createAppStore(data: Data, today: IsoDate, initial: StoredState) {
	type Core = Pick<AppState, "today" | "plan" | "grocery">;

	/** Drop past days, then the ticks that no longer hold. */
	const settle = (core: Core): Core => {
		const plan = dropBefore(core.plan, core.today);
		const grocery = pruneChecked(core.grocery, groceryList({ ...core, plan }, data));
		return { today: core.today, plan, grocery };
	};

	return createStore<AppState>()((set, get) => {
		const core = (): Core => {
			const { today, plan, grocery } = get();
			return { today, plan, grocery };
		};
		const update = (change: (core: Core) => Partial<Core>) =>
			set((state) => settle({ ...core(), ...change(state) }));
		const updatePlan = (change: (plan: Plan) => Plan) =>
			update((state) => ({ plan: change(state.plan) }));

		return {
			...settle({ today, plan: initial.plan, grocery: initial.grocery }),

			loadPlan: (plan) => updatePlan(() => plan),
			setToday: (next) => update(() => ({ today: next })),
			addMeal: (date, recipe) => updatePlan((plan) => addMeal(plan, date, recipe)),
			addNote: (date, note, buy) => updatePlan((plan) => addNote(plan, date, note, buy)),
			setNoteBuy: (date, index, buy) => updatePlan((plan) => setNoteBuy(plan, date, index, buy)),
			changeMeal: (date, index, change) =>
				updatePlan((plan) => {
					const meal = day(plan, date)[index];
					if (!meal || isNote(meal)) return plan;
					return setChanges(plan, date, index, withChange(meal.changes, change));
				}),
			resetChange: (date, index, key) =>
				updatePlan((plan) => {
					const meal = day(plan, date)[index];
					if (!meal || isNote(meal)) return plan;
					return setChanges(plan, date, index, withoutChange(meal.changes, key));
				}),
			removeMeal: (date, index) => updatePlan((plan) => removeMeal(plan, date, index)),
			moveMeal: (from, index, to, toIndex) => {
				const moved = moveMeal(get().plan, from, index, to, toIndex);
				if (!moved) return null;
				updatePlan(() => moved.plan);
				return moved.index;
			},
			reorderMeal: (date, from, to) => updatePlan((plan) => reorderMeal(plan, date, from, to)),
			setServings: (date, index, servings) =>
				updatePlan((plan) => {
					const meal = day(plan, date)[index];
					const own =
						!meal || isNote(meal) ? undefined : data.recipeById.get(meal.recipe)?.servings;
					return setServings(plan, date, index, Math.max(1, Math.round(servings)), own);
				}),
			clearPlan: (what) =>
				update((state) => ({
					plan: what === "everything" ? EMPTY_PLAN : clearMeals(state.plan),
					grocery: clearChecked(state.grocery),
				})),
			addExtra: (extra) => updatePlan((plan) => addExtra(plan, extra)),
			removeExtra: (index) => updatePlan((plan) => removeExtra(plan, index)),
			toggleTick: (line) => update((state) => ({ grocery: toggleChecked(state.grocery, line) })),
			setRange: (range) => update((state) => ({ grocery: { ...state.grocery, range } })),
		};
	});
}

export type AppStore = ReturnType<typeof createAppStore>;
