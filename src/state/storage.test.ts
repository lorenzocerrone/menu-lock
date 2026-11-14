import { describe, expect, it } from "vitest";
import { storageKey } from "./storage";

describe("storageKey", () => {
	it("is menu-lock.state for the live app", () => {
		expect(storageKey(undefined)).toBe("menu-lock.state");
		expect(storageKey("")).toBe("menu-lock.state");
	});

	it("is separate for a pull-request preview", () => {
		expect(storageKey("pr-12")).toBe("menu-lock.pr-12.state");
	});
});
