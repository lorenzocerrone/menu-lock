import { describe, expect, it } from "vitest";
import { addDays, daysUntil, isIsoDate, localIsoDate, planDays, weekday, ymd } from "./dates";

describe("dates", () => {
	it("round-trips through day arithmetic", () => {
		expect(addDays("1970-01-01", 0)).toBe("1970-01-01");
		expect(addDays("1970-01-01", -1)).toBe("1969-12-31");
		for (let n = -700_000; n < 800_000; n += 997) {
			const date = addDays("1970-01-01", n);
			expect(isIsoDate(date), date).toBe(true);
			expect(daysUntil("1970-01-01", date)).toBe(n);
		}
		expect(ymd("2026-03-07")).toEqual([2026, 3, 7]);
	});

	it("rejects impossible and badly written dates", () => {
		expect(isIsoDate("2026-02-29")).toBe(false);
		expect(isIsoDate("2028-02-29")).toBe(true);
		expect(isIsoDate("1900-02-29")).toBe(false);
		expect(isIsoDate("2000-02-29")).toBe(true);
		expect(isIsoDate("2026-04-31")).toBe(false);
		expect(isIsoDate("2026-13-01")).toBe(false);
		expect(isIsoDate("2026-01-00")).toBe(false);
		for (const bad of [
			"2026-3-7",
			"2026-02-30",
			"26-03-07",
			"2026-03-07-1",
			"nope",
			"",
			"tomorrow",
		])
			expect(isIsoDate(bad), bad).toBe(false);
	});

	it("crosses month and year ends", () => {
		expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
		expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
		expect(daysUntil("2026-10-25", "2026-11-08")).toBe(14);
		expect(daysUntil("2026-11-08", "2026-10-25")).toBe(-14);
	});

	it("knows the weekday, Monday first", () => {
		expect(weekday("2026-10-25")).toBe(6); // a Sunday
		expect(weekday("2026-10-26")).toBe(0);
		expect(weekday("1970-01-01")).toBe(3); // Thursday
		expect(weekday("1969-12-29")).toBe(0);
	});

	it("sorts as plain strings", () => {
		expect("2026-10-25" < "2026-10-26").toBe(true);
		expect("2026-12-31" < "2027-01-01").toBe(true);
	});

	it("reads the local calendar date of a clock value", () => {
		expect(localIsoDate(new Date(2026, 9, 25, 23, 59))).toBe("2026-10-25");
		expect(localIsoDate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
	});

	it("shows 14 days, or through the last planned day", () => {
		const days = planDays("2026-10-25", null);
		expect(days).toHaveLength(14);
		expect(days[0]).toBe("2026-10-25");
		expect(days[13]).toBe("2026-11-07");
		expect(planDays("2026-10-25", "2026-10-27")).toHaveLength(14);
		const long = planDays("2026-10-25", "2026-11-15");
		expect(long).toHaveLength(22);
		expect(long.at(-1)).toBe("2026-11-15");
		expect(planDays("2026-10-25", "2026-10-01")).toHaveLength(14);
	});
});
