import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { fixtureData, recipeFile } from "./fixtures";
import { addExtra, addItem, addMeal, EMPTY_PLAN, type Plan, setChanges, setServings } from "./plan";
import {
	decodePlan,
	encodePlan,
	fromWire,
	MAX_SERVINGS,
	PLAN_HORIZON_DAYS,
	readPlanParam,
	readWire,
	toWire,
} from "./planCodec";

/** A Sunday. */
const TODAY = "2026-10-25";
const d = (n: number) => addDays(TODAY, n);
const { dictionary } = fixtureData([recipeFile("r", 1, [{ ingredient: "salt" }])]);
const decode = (encoded: string, today = TODAY) => decodePlan(encoded, today, dictionary);
const read = (json: string, today = TODAY) => fromWire(JSON.parse(json), today, dictionary);

describe("plan wire format", () => {
	it("writes meals as bare ids or {recipe, servings}, by ISO date, in date order", () => {
		let plan = addMeal(EMPTY_PLAN, d(1), "oats");
		plan = addMeal(plan, d(1), "dal");
		plan = setServings(plan, d(1), 1, 6);
		plan = addMeal(plan, d(0), "soup");
		const json = JSON.stringify(toWire(plan));
		expect(json).toBe(
			'{"dates":{"2026-10-25":["soup"],"2026-10-26":["oats",{"recipe":"dal","servings":6}]}}',
		);
		expect(read(json)).toEqual(plan);
		expect(JSON.stringify(toWire(EMPTY_PLAN))).toBe("{}");
		expect(read("{}")).toEqual(EMPTY_PLAN);
	});

	it("omits extras when empty and round-trips both kinds", () => {
		let plan = addExtra(EMPTY_PLAN, { kind: "catalog", key: "milk", amount: 1, unit: "l" });
		plan = addExtra(plan, { kind: "catalog", key: "egg", amount: 6 });
		plan = addExtra(plan, { kind: "catalog", key: "salt" });
		plan = addExtra(plan, { kind: "custom", name: "Bread", quantity: "1 loaf" });
		plan = addExtra(plan, { kind: "custom", name: "Candles", quantity: null });
		const json = JSON.stringify(toWire(plan));
		expect(json).toBe(
			'{"extras":[{"name":"milk","amount":1,"unit":"l"},{"name":"egg","amount":6},{"name":"salt"},' +
				'{"name":"Bread","quantity":"1 loaf"},{"name":"Candles","quantity":null}]}',
		);
		expect(read(json)).toEqual(plan);
	});

	it("drops past dates and empty days on decode, and rejects bad dates", () => {
		const plan = read(
			'{"dates":{"2026-10-20":["old"],"2026-10-24":["yesterday"],"2026-10-25":["today"],"2026-10-28":[]}}',
		);
		expect(plan).toEqual({ dates: { "2026-10-25": [{ recipe: "today" }] }, extras: [] });
		expect(read('{"dates":{"tomorrow":[]}}')).toBeNull();
		expect(read('{"dates":{"2026-02-30":["x"]}}')).toBeNull();
	});

	it("keeps unknown recipe ids", () => {
		const plan = read('{"dates":{"2026-10-25":["from_a_newer_version"]}}');
		expect(plan?.dates["2026-10-25"]).toEqual([{ recipe: "from_a_newer_version" }]);
	});

	it("reads catalog extras by key, display name or alias; unknown names become custom", () => {
		const extras = (json: string) => read(`{"extras":${json}}`)?.extras;
		expect(extras('[{"name":"olive_oil","amount":0.5,"unit":"l"}]')).toEqual([
			{ kind: "catalog", key: "olive_oil", amount: 0.5, unit: "l" },
		]);
		expect(extras('[{"name":"Olive oil","amount":2,"unit":"tbsp"}]')).toEqual([
			{ kind: "catalog", key: "olive_oil", amount: 2, unit: "tbsp" },
		]);
		expect(extras('[{"name":"Spring onions","amount":3}]')).toEqual([
			{ kind: "catalog", key: "scallion", amount: 3 },
		]);
		expect(extras('[{"name":"Tinned tomatoes","amount":2,"unit":"cans"}]')).toEqual([
			{ kind: "catalog", key: "chopped_tomatoes", amount: 2, unit: "cans" },
		]);
		expect(extras('[{"name":"eggs"}]')).toEqual([{ kind: "catalog", key: "egg" }]);
		// Not in the dictionary: custom, with the amount and unit as its quantity text.
		expect(extras('[{"name":"Star anise","amount":2}]')).toEqual([
			{ kind: "custom", name: "Star anise", quantity: "2" },
		]);
		expect(extras('[{"name":"oat milk","amount":1.5,"unit":"l","aisle":"Dairy & Eggs"}]')).toEqual([
			{ kind: "custom", name: "oat milk", quantity: "1.5 l" },
		]);
		expect(extras('[{"name":"Candles"}]')).toEqual([
			{ kind: "custom", name: "Candles", quantity: null },
		]);
		// Known, but an amount the list can't add up: kept as text under the dictionary's name.
		expect(extras('[{"name":"salt","amount":1,"unit":"tbsp"}]')).toEqual([
			{ kind: "custom", name: "Salt", quantity: "1 tbsp" },
		]);
		expect(extras('[{"name":"milk","amount":1000.0}]')).toEqual([
			{ kind: "custom", name: "Milk", quantity: "1000" },
		]);
		// A custom extra is recognised by its quantity field, even for a dictionary name.
		expect(extras('[{"name":"Milk","quantity":null},{"name":"  ","quantity":"1"}]')).toEqual([
			{ kind: "custom", name: "Milk", quantity: null },
		]);
	});

	it("reads garbage and legacy shapes as no plan", () => {
		for (const json of [
			"[]",
			'"plan"',
			"null",
			"3",
			'{"dates":[]}',
			'{"dates":{"2026-10-25":"dal"}}',
		])
			expect(read(json), json).toBeNull();
		expect(read('{"dates":{"2026-10-25":[{"servings":2}]}}')).toBeNull();
		expect(read('{"extras":[{"ingredient":"milk"}]}')).toBeNull();
		// Weekday plans and meal slots from before plans were dated.
		expect(read('{"days":[["oats"],[],[],[],[],["pizza"],["roast"]]}')).toBeNull();
		expect(
			read('{"days":[{"breakfast":"omelette","dinner":{"recipe":"dal","servings":4}}]}'),
		).toBeNull();
		// Unknown extra fields are ignored rather than fatal.
		expect(read('{"dates":{"2026-10-25":["dal"]},"version":2}')?.dates[TODAY]).toHaveLength(1);
	});
});

describe("what menu.lock added to the wire", () => {
	it("writes an ingredient on a day as {item, buy}, the item like an extra", () => {
		let plan = addItem(
			EMPTY_PLAN,
			d(0),
			{ kind: "custom", name: "Leftover pizza", quantity: null },
			false,
		);
		plan = addItem(
			plan,
			d(0),
			{ kind: "catalog", key: "salmon", amount: 2, unit: "fillets" },
			true,
		);
		plan = addItem(plan, d(0), { kind: "custom", name: "Frozen pizza", quantity: "2 boxes" }, true);
		plan = addMeal(plan, d(0), "dal");
		const json = JSON.stringify(toWire(plan));
		expect(json).toBe(
			'{"dates":{"2026-10-25":[{"item":{"name":"Leftover pizza","quantity":null}},' +
				'{"item":{"name":"salmon","amount":2,"unit":"fillets"},"buy":true},' +
				'{"item":{"name":"Frozen pizza","quantity":"2 boxes"},"buy":true},"dal"]}}',
		);
		expect(read(json)).toEqual(plan);
		// One that can't be read is dropped, and a day left empty with it.
		expect(
			read(
				'{"dates":{"2026-10-25":[{"item":{"name":"  ","quantity":null}},{"item":7}],"2026-10-26":[{"item":{"name":"eggs","amount":6},"buy":false}]}}',
			),
		).toEqual({
			dates: { "2026-10-26": [{ item: { kind: "catalog", key: "egg", amount: 6 } }] },
			extras: [],
		});
	});

	it("writes a meal's ingredient changes, and nothing new when there are none", () => {
		let plan = addMeal(EMPTY_PLAN, d(0), "dal");
		plan = setChanges(plan, d(0), 0, [
			{ kind: "swap", key: "scallion", for: "onion" },
			{ kind: "swap", key: "garlic", for: "lemon", amount: 1 },
			{ kind: "skip", key: "salt" },
			{ kind: "set", key: "olive_oil", amount: 1, unit: "tbsp" },
			{ kind: "set", key: "egg" },
			{ kind: "add", key: "milk", amount: 0.5, unit: "l" },
		]);
		plan = setServings(plan, d(0), 0, 6);
		const json = JSON.stringify(toWire(plan));
		expect(json).toBe(
			'{"dates":{"2026-10-25":[{"recipe":"dal","servings":6,"changes":[' +
				'{"swap":"scallion","for":"onion"},{"swap":"garlic","for":"lemon","amount":1},{"skip":"salt"},' +
				'{"set":"olive_oil","amount":1,"unit":"tbsp"},{"set":"egg"},{"add":"milk","amount":0.5,"unit":"l"}]}]}}',
		);
		expect(read(json)).toEqual(plan);
		// Without servings.
		const bare = setServings(plan, d(0), 0, undefined);
		expect(JSON.stringify(toWire(bare))).toContain('[{"recipe":"dal","changes":[');
		expect(read(JSON.stringify(toWire(bare)))).toEqual(bare);
		// No changes: the cooking-rs shapes, byte for byte.
		expect(JSON.stringify(toWire(setChanges(bare, d(0), 0, [])))).toBe(
			'{"dates":{"2026-10-25":["dal"]}}',
		);
	});

	it("writes ingredients typed freely with their name and quantity as written", () => {
		let plan = addMeal(EMPTY_PLAN, d(0), "dal");
		plan = setChanges(plan, d(0), 0, [
			{ kind: "swapFree", key: "scallion", name: "Shallots", quantity: "2" },
			{ kind: "addFree", key: "custom:bay leaves", name: "Bay leaves", quantity: null },
		]);
		const json = JSON.stringify(toWire(plan));
		expect(json).toBe(
			'{"dates":{"2026-10-25":[{"recipe":"dal","changes":[' +
				'{"swap":"scallion","name":"Shallots","quantity":"2"},{"addName":"Bay leaves","quantity":null}]}]}}',
		);
		expect(read(json)).toEqual(plan);
		// Nameless ones are dropped.
		expect(
			read(
				'{"dates":{"2026-10-25":[{"recipe":"dal","changes":[{"addName":"  "},{"swap":"salt","name":""}]}]}}',
			)?.dates[TODAY],
		).toEqual([{ recipe: "dal" }]);
	});

	it("drops a change it can't read and keeps the rest", () => {
		const meal = (changes: string) =>
			read(`{"dates":{"2026-10-25":[{"recipe":"dal","changes":${changes}}]}}`)?.dates[TODAY]?.[0];
		expect(
			meal(
				'[{"swap":"scallion","for":"no_such_key"},{"skip":"salt"},{"add":"no_such_key"},7,{"what":1}]',
			),
		).toEqual({
			recipe: "dal",
			changes: [{ kind: "skip", key: "salt" }],
		});
		// One change per ingredient: the later one wins.
		expect(meal('[{"skip":"salt"},{"set":"salt","amount":5,"unit":"g"}]')).toEqual({
			recipe: "dal",
			changes: [{ kind: "set", key: "salt", amount: 5, unit: "g" }],
		});
		// A bad amount is ignored, not fatal.
		expect(meal('[{"set":"salt","amount":-1,"unit":"g"}]')).toEqual({
			recipe: "dal",
			changes: [{ kind: "set", key: "salt", unit: "g" }],
		});
		expect(meal("[]")).toEqual({ recipe: "dal" });
		expect(meal('"nope"')).toBeUndefined(); // a wrong shape is still no plan at all
	});
});

describe("reading a plan that is partly wrong", () => {
	const dates = (json: string) => read(json)?.dates;

	it("drops a meal it can't read and keeps the rest of the day and the plan", () => {
		expect(dates(`{"dates":{"${d(1)}":[{"servings":2},null,7,"dal"],"${d(2)}":["soup"]}}`)).toEqual(
			{ [d(1)]: [{ recipe: "dal" }], [d(2)]: [{ recipe: "soup" }] },
		);
	});

	it("drops a day it can't read and keeps the others", () => {
		expect(dates(`{"dates":{"tomorrow":["x"],"${d(1)}":"dal","${d(2)}":["soup"]}}`)).toEqual({
			[d(2)]: [{ recipe: "soup" }],
		});
	});

	it("drops an extra it can't read and keeps the others", () => {
		expect(
			read('{"extras":[{"ingredient":"milk"},{"name":"Candles","quantity":null}]}')?.extras,
		).toEqual([{ kind: "custom", name: "Candles", quantity: null }]);
	});

	it("falls back to the recipe's servings when they make no sense, and caps them", () => {
		const meals = dates(
			`{"dates":{"${d(1)}":[{"recipe":"a","servings":0},{"recipe":"b","servings":2.6},` +
				`{"recipe":"c","servings":"3"},{"recipe":"d","servings":100000}]}}`,
		)?.[d(1)];
		expect(meals).toEqual([
			{ recipe: "a" },
			{ recipe: "b", servings: 3 },
			{ recipe: "c" },
			{ recipe: "d", servings: MAX_SERVINGS },
		]);
	});

	it("drops days beyond the horizon, so a hand-edited date can't hang the planner", () => {
		expect(
			dates(
				`{"dates":{"9999-12-31":["a"],"${d(PLAN_HORIZON_DAYS + 1)}":["b"],"${d(PLAN_HORIZON_DAYS)}":["c"]}}`,
			),
		).toEqual({ [d(PLAN_HORIZON_DAYS)]: [{ recipe: "c" }] });
		expect(read('{"dates":{"9999-12-31":["a"]}}')).toBeNull();
	});

	it("says what it dropped", () => {
		const { dropped } = readWire(
			JSON.parse(`{"dates":{"${d(-3)}":["a"],"${d(-1)}":[],"${d(1)}":["b",null]},"extras":[7]}`),
			TODAY,
			dictionary,
		);
		expect(dropped).toEqual({ past: 1, unreadable: 2 });
	});
});

describe("plan parameter", () => {
	it("round-trips through base64url without padding", () => {
		let plan = addMeal(EMPTY_PLAN, d(3), "carbonara");
		plan = setServings(plan, d(3), 0, 4);
		plan = addExtra(plan, { kind: "custom", name: "Crème fraîche ☕", quantity: "200 g" });
		const encoded = encodePlan(plan);
		expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(encoded && decode(encoded)).toEqual(plan);
	});

	it("is absent for an empty plan", () => {
		expect(encodePlan(EMPTY_PLAN)).toBeNull();
		expect(encodePlan({ dates: {}, extras: [] })).toBeNull();
	});

	it("drops the days that passed when a link is opened later", () => {
		let plan = addMeal(EMPTY_PLAN, d(0), "soup");
		plan = addMeal(plan, d(2), "dal");
		const later = decode(encodePlan(plan) ?? "", d(1));
		expect(later).toEqual({ dates: { [d(2)]: [{ recipe: "dal" }] }, extras: [] });
	});

	it("opens nothing for a link whose days have all passed, and says so", () => {
		const old = encodePlan({
			dates: { [d(0)]: [{ recipe: "soup" }] },
			extras: [{ kind: "custom", name: "Bin bags", quantity: null }],
		});
		expect(readPlanParam(old ?? "", d(1), dictionary)).toMatchObject({ plan: null, passed: true });
		expect(readPlanParam(old ?? "", d(0), dictionary)).toMatchObject({ passed: false });
		// A link with only extras was never about days.
		const extras = encodePlan(addExtra(EMPTY_PLAN, { kind: "catalog", key: "salt" })) ?? "";
		expect(readPlanParam(extras, d(5), dictionary)).toMatchObject({ passed: false });
		expect(readPlanParam(extras, d(5), dictionary).plan?.extras).toHaveLength(1);
	});

	it("rejects garbage", () => {
		expect(decode("not base64!")).toBeNull();
		expect(decode("e25vcGU")).toBeNull(); // {nope
		expect(decode("")).toBeNull();
		expect(decode("____")).toBeNull(); // invalid UTF-8
		expect(decode("eyJkYXlzIjpbeyJsdW5jaCI6ImRhbCJ9XX0")).toBeNull(); // {"days":[{"lunch":"dal"}]}
	});

	// The byte-for-byte payloads cooking-rs writes (serde_json + URL_SAFE_NO_PAD).
	it("decodes real cooking-rs links", () => {
		// {"dates":{"2026-11-16":["carbonara",{"recipe":"lentil_dal","servings":4}]},
		//  "extras":[{"name":"milk","amount":1,"unit":"l"},{"name":"Toilet paper","quantity":"1 pack"}]}
		const brief =
			"eyJkYXRlcyI6eyIyMDI2LTExLTE2IjpbImNhcmJvbmFyYSIseyJyZWNpcGUiOiJsZW50aWxfZGFsIiwic2VydmluZ3MiOjR9XX0sImV4dHJhcyI6W3sibmFtZSI6Im1pbGsiLCJhbW91bnQiOjEsInVuaXQiOiJsIn0seyJuYW1lIjoiVG9pbGV0IHBhcGVyIiwicXVhbnRpdHkiOiIxIHBhY2sifV19";
		const expected: Plan = {
			dates: { "2026-11-16": [{ recipe: "carbonara" }, { recipe: "lentil_dal", servings: 4 }] },
			extras: [
				{ kind: "catalog", key: "milk", amount: 1, unit: "l" },
				{ kind: "custom", name: "Toilet paper", quantity: "1 pack" },
			],
		};
		expect(decode(brief, "2026-11-14")).toEqual(expected);
		// menu.lock writes the same bytes back.
		expect(encodePlan(expected)).toBe(brief);

		// {"dates":{"2026-10-25":["soup"],"2026-10-26":["oats",{"recipe":"dal","servings":6}]}}
		expect(
			decode(
				"eyJkYXRlcyI6eyIyMDI2LTEwLTI1IjpbInNvdXAiXSwiMjAyNi0xMC0yNiI6WyJvYXRzIix7InJlY2lwZSI6ImRhbCIsInNlcnZpbmdzIjo2fV19fQ",
			),
		).toEqual({
			dates: {
				"2026-10-25": [{ recipe: "soup" }],
				"2026-10-26": [{ recipe: "oats" }, { recipe: "dal", servings: 6 }],
			},
			extras: [],
		});

		// serde_json writes floats as 1000.0:
		// {"dates":{"2026-10-26":["dal"]},"extras":[{"name":"milk","amount":1000.0},
		//  {"name":"Bread","quantity":"1 loaf"},{"name":"Candles","quantity":null}]}
		expect(
			decode(
				"eyJkYXRlcyI6eyIyMDI2LTEwLTI2IjpbImRhbCJdfSwiZXh0cmFzIjpbeyJuYW1lIjoibWlsayIsImFtb3VudCI6MTAwMC4wfSx7Im5hbWUiOiJCcmVhZCIsInF1YW50aXR5IjoiMSBsb2FmIn0seyJuYW1lIjoiQ2FuZGxlcyIsInF1YW50aXR5IjpudWxsfV19",
			)?.extras,
		).toEqual([
			{ kind: "custom", name: "Milk", quantity: "1000" },
			{ kind: "custom", name: "Bread", quantity: "1 loaf" },
			{ kind: "custom", name: "Candles", quantity: null },
		]);

		// {"extras":[{"name":"Crème fraîche","quantity":"200 g"}]}
		expect(
			decode("eyJleHRyYXMiOlt7Im5hbWUiOiJDcsOobWUgZnJhw65jaGUiLCJxdWFudGl0eSI6IjIwMCBnIn1dfQ")
				?.extras,
		).toEqual([{ kind: "custom", name: "Crème fraîche", quantity: "200 g" }]);
	});
});
