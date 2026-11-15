import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { fixtureData, recipeFile } from "./fixtures";
import { DEFAULT_GROCERY, type GroceryState } from "./grocery";
import { addExtra, addMeal, EMPTY_PLAN } from "./plan";
import {
	decodeStored,
	encodeStored,
	importCookingRsPlan,
	resolveInitial,
	type StoredState,
} from "./stored";

/** A Sunday. */
const TODAY = "2026-10-25";
const d = (n: number) => addDays(TODAY, n);
const { dictionary } = fixtureData([recipeFile("r", 1, [{ ingredient: "salt" }])]);
const decode = (raw: string, today = TODAY) => decodeStored(raw, today, dictionary);

function sample(): StoredState {
	let plan = addMeal(EMPTY_PLAN, d(1), "dal");
	plan = addExtra(plan, { kind: "catalog", key: "milk", amount: 1, unit: "l" });
	const grocery: GroceryState = {
		checked: [
			{ key: "onion", amount: 250, aside: [], custom: [] },
			{ key: "custom:bread", amount: null, aside: [], custom: ["1 loaf"] },
		],
		range: { days: 3 },
	};
	return { plan, grocery };
}

describe("stored state", () => {
	it("round-trips through JSON", () => {
		const state = sample();
		const raw = encodeStored(state);
		expect(raw.startsWith('{"version":1,"plan":{"dates":{"2026-10-26":["dal"]}')).toBe(true);
		expect(raw).toContain('"range":{"days":3}');
		expect(raw).toContain('{"key":"onion","amount":250,"aside":[],"custom":[]}');
		expect(decode(raw)).toEqual(state);
		expect(decode(encodeStored({ plan: EMPTY_PLAN, grocery: DEFAULT_GROCERY }))).toEqual({
			plan: EMPTY_PLAN,
			grocery: DEFAULT_GROCERY,
		});
		expect(encodeStored({ plan: EMPTY_PLAN, grocery: DEFAULT_GROCERY })).toBe(
			'{"version":1,"plan":{},"grocery":{"checked":[],"range":"all"}}',
		);
	});

	it("refuses newer versions and garbage, and defaults what is missing", () => {
		expect(decode('{"version":99}')).toBeNull();
		expect(decode("not json")).toBeNull();
		expect(decode("null")).toBeNull();
		expect(decode("[]")).toBeNull();
		expect(decode("{}")).toEqual({ plan: EMPTY_PLAN, grocery: DEFAULT_GROCERY });
		const partial = decode('{"plan":{"dates":{"2026-10-26":["soup"]}}}');
		expect(partial?.plan.dates[d(1)]).toEqual([{ recipe: "soup" }]);
		expect(partial?.grocery).toEqual(DEFAULT_GROCERY);
		// An unreadable part falls back on its own; the rest is kept.
		const odd = decode(
			'{"version":1,"plan":{"days":[["oats"]]},"grocery":{"checked":[{"key":"onion","amount":"lots"}],"range":{"days":0}}}',
		);
		expect(odd).toEqual({
			plan: EMPTY_PLAN,
			grocery: { checked: [{ key: "onion", amount: null, aside: [], custom: [] }], range: "all" },
		});
	});

	it("drops the days that passed since it was stored", () => {
		const raw = encodeStored(sample());
		expect(decode(raw, d(2))?.plan.dates).toEqual({});
		expect(decode(raw, d(2))?.plan.extras).toHaveLength(1);
	});

	it("starts from the URL plan, else the stored one, always with this device's grocery state", () => {
		const storedState = sample();
		const shared = addMeal(EMPTY_PLAN, d(6), "pancakes");
		expect(resolveInitial(shared, storedState)).toEqual({
			plan: shared,
			grocery: storedState.grocery,
		});
		expect(resolveInitial(shared, null)).toEqual({ plan: shared, grocery: DEFAULT_GROCERY });
		expect(resolveInitial(null, storedState)).toEqual(storedState);
		expect(resolveInitial(null, null)).toEqual({ plan: EMPTY_PLAN, grocery: DEFAULT_GROCERY });
	});

	it("imports only the plan from cooking-rs's stored state", () => {
		// As cooking-rs writes it (version 3, its own grocery state).
		const raw =
			'{"version":3,"plan":{"dates":{"2026-10-24":["old"],"2026-10-26":["dal",{"recipe":"soup","servings":6}]},' +
			'"extras":[{"name":"milk","amount":1.0,"unit":"l"},{"name":"Bread","quantity":"1 loaf"}]},' +
			'"grocery":{"checked":[{"key":"onion","subtotals":[["Mass",250.0]]}],"omitted":["salt"],"hide_to_taste":true,"range":{"days":3}}}';
		expect(importCookingRsPlan(raw, TODAY, dictionary)).toEqual({
			dates: { "2026-10-26": [{ recipe: "dal" }, { recipe: "soup", servings: 6 }] },
			extras: [
				{ kind: "catalog", key: "milk", amount: 1, unit: "l" },
				{ kind: "custom", name: "Bread", quantity: "1 loaf" },
			],
		});
		// Its older weekday plans are not read.
		expect(
			importCookingRsPlan('{"version":2,"plan":{"days":[["oats"]]}}', TODAY, dictionary),
		).toBeNull();
		expect(importCookingRsPlan("{}", TODAY, dictionary)).toBeNull();
		expect(importCookingRsPlan("nope", TODAY, dictionary)).toBeNull();
	});
});
