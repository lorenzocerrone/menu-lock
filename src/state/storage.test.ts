import { describe, expect, it } from "vitest";
import { fixtureData, recipeFile } from "../lib/fixtures";
import { DEFAULT_GROCERY } from "../lib/grocery";
import { addMeal, EMPTY_PLAN } from "../lib/plan";
import { COOKING_RS_KEY, loadStored, saveStored, storageKey } from "./storage";

const TODAY = "2026-10-25";
const { dictionary } = fixtureData([recipeFile("r", 1, [{ ingredient: "salt" }])]);

/** A stand-in for localStorage. */
function fakeStorage(initial: Record<string, string> = {}) {
	const items = new Map(Object.entries(initial));
	return {
		items,
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value),
	};
}

const refusing = {
	getItem: (): string | null => {
		throw new Error("refused");
	},
	setItem: (): void => {
		throw new Error("quota");
	},
};

describe("storageKey", () => {
	it("is menu-lock.state for the live app", () => {
		expect(storageKey(undefined)).toBe("menu-lock.state");
		expect(storageKey("")).toBe("menu-lock.state");
	});

	it("is separate for a pull-request preview", () => {
		expect(storageKey("pr-12")).toBe("menu-lock.pr-12.state");
	});
});

describe("stored state", () => {
	const state = {
		plan: addMeal(EMPTY_PLAN, "2026-10-26", "dal"),
		grocery: {
			checked: [{ key: "onion", amount: 250, aside: [], custom: [] }],
			range: { days: 3 },
		},
	};

	it("saves and loads under its key", () => {
		const storage = fakeStorage();
		saveStored(storage, state, "menu-lock.state");
		expect([...storage.items.keys()]).toEqual(["menu-lock.state"]);
		expect(loadStored(storage, TODAY, dictionary, "menu-lock.state")).toEqual(state);
		expect(loadStored(storage, TODAY, dictionary, "menu-lock.pr-12.state")).toBeNull();
	});

	it("survives storage that is missing or refuses", () => {
		expect(loadStored(null, TODAY, dictionary)).toBeNull();
		expect(loadStored(refusing, TODAY, dictionary)).toBeNull();
		expect(() => saveStored(refusing, state)).not.toThrow();
		expect(() => saveStored(null, state)).not.toThrow();
		expect(
			loadStored(
				fakeStorage({ "menu-lock.state": "garbage" }),
				TODAY,
				dictionary,
				"menu-lock.state",
			),
		).toBeNull();
	});

	it("imports the cooking-rs plan once, on the live app's first start only", () => {
		const old =
			'{"version":3,"plan":{"dates":{"2026-10-26":["dal"]}},"grocery":{"omitted":["salt"]}}';
		const storage = fakeStorage({ [COOKING_RS_KEY]: old });
		const imported = loadStored(storage, TODAY, dictionary, "menu-lock.state");
		expect(imported).toEqual({ plan: state.plan, grocery: DEFAULT_GROCERY });
		// A preview never reads the real app's data.
		expect(loadStored(storage, TODAY, dictionary, "menu-lock.pr-12.state")).toBeNull();
		// Once menu.lock has its own state, cooking-rs's is ignored.
		saveStored(storage, { plan: EMPTY_PLAN, grocery: DEFAULT_GROCERY }, "menu-lock.state");
		expect(loadStored(storage, TODAY, dictionary, "menu-lock.state")?.plan).toEqual(EMPTY_PLAN);
		// Nothing usable there: nothing imported.
		expect(
			loadStored(fakeStorage({ [COOKING_RS_KEY]: "{}" }), TODAY, dictionary, "menu-lock.state"),
		).toBeNull();
	});
});
