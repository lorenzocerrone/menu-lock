import { describe, expect, it } from "vitest";
import type { CountSpec } from "./schema";
import {
	convertibleUnits,
	labelFor,
	matchesLabel,
	parseUnit,
	resolveUnit,
	toBase,
	toShopping,
	UNITS,
} from "./units";

const clove: CountSpec = { label: "clove", perPiece: 4 };

describe("units", () => {
	it("parses spellings and rejects typos", () => {
		const cases = [
			["g", "g"],
			["Grams", "g"],
			["kg", "kg"],
			["ml", "ml"],
			["litre", "l"],
			["tsp", "tsp"],
			["Tablespoons", "tbsp"],
			["cups", "cup"],
			[" pcs ", "pcs"],
			["piece", "pcs"],
			["pc", "pcs"],
		] as const;
		for (const [s, unit] of cases) expect(parseUnit(s), s).toBe(unit);
		for (const unit of UNITS) expect(parseUnit(unit)).toBe(unit);
		for (const bad of ["unit", "clove", "", "oz"]) expect(parseUnit(bad), bad).toBeNull();
	});

	it("has the base conversion factors", () => {
		expect(2 * toBase("tbsp")).toBe(30);
		expect(1.5 * toBase("kg")).toBe(1500);
		expect(0.5 * toBase("l")).toBe(500);
		expect(toBase("cup")).toBe(240);
		expect(toBase("tsp")).toBe(5);
		for (const unit of ["g", "ml", "pcs"] as const) expect(toBase(unit)).toBe(1);
	});

	it("resolves no unit as pieces, standard units, and piece labels", () => {
		expect(resolveUnit(undefined, undefined)).toBe("pcs");
		expect(resolveUnit(undefined, clove)).toBe("pcs");
		expect(resolveUnit("kg", undefined)).toBe("kg");
		expect(resolveUnit("cloves", clove)).toBe("pcs");
		expect(resolveUnit("Clove", clove)).toBe("pcs");
		expect(resolveUnit("clove", undefined)).toBeNull();
		expect(resolveUnit("bunch", clove)).toBeNull();
	});

	it("converts into the shopping unit or says it can't", () => {
		// Same dimension → base.
		expect(toShopping(2, "tbsp", "ml", undefined)).toBe(30);
		expect(toShopping(1.5, "kg", "g", undefined)).toBe(1500);
		expect(toShopping(4, "pcs", "pcs", undefined)).toBe(4);
		// Pieces with perPiece → shopping unit.
		expect(toShopping(3, "pcs", "g", clove)).toBe(12);
		expect(toShopping(0.5, "pcs", "ml", { label: "can", perPiece: 400 })).toBe(200);
		// Mass into a pcs-shopped ingredient.
		expect(toShopping(100, "g", "pcs", { perPiece: 50 })).toBe(2);
		expect(toShopping(400, "g", "pcs", { label: "can", perPiece: 400 })).toBe(1);
		// No conversion.
		expect(toShopping(2, "pcs", "g", undefined)).toBeNull();
		expect(toShopping(1, "cup", "g", undefined)).toBeNull();
		expect(toShopping(1, "tbsp", "g", clove)).toBeNull();
		expect(toShopping(100, "g", "pcs", undefined)).toBeNull();
		expect(toShopping(100, "ml", "pcs", { perPiece: 50 })).toBeNull();
		expect(toShopping(100, "g", "ml", { perPiece: 50 })).toBeNull();
	});

	it("lists the units that convert, for error messages", () => {
		expect(convertibleUnits("g", undefined)).toEqual(["g", "kg"]);
		expect(convertibleUnits("g", clove)).toEqual(["g", "kg", "pcs", "clove"]);
		expect(convertibleUnits("ml", undefined)).toEqual(["ml", "l", "tsp", "tbsp", "cup"]);
		expect(convertibleUnits("pcs", { perPiece: 55 })).toEqual(["g", "kg", "pcs"]);
	});

	it("pluralises piece labels", () => {
		expect(labelFor(clove, 1)).toBe("clove");
		expect(labelFor(clove, 3)).toBe("cloves");
		const leaf: CountSpec = { label: "leaf", plural: "leaves" };
		expect(matchesLabel(leaf, "LEAVES")).toBe(true);
		expect(matchesLabel(leaf, "leafs")).toBe(false);
		expect(labelFor(leaf, 2)).toBe("leaves");
		expect(labelFor({}, 2)).toBeNull();
		expect(labelFor(undefined, 2)).toBeNull();
	});
});
