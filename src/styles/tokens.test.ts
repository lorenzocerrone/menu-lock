/**
 * The colours people read must pass WCAG AA (4.5:1) on every paper surface, in
 * both themes (REWRITE_PLAN §6.5). `--faint` is exempt: it is for decoration
 * and for things that are done (a ticked line, a finished step).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");
const dark = css.slice(css.indexOf("prefers-color-scheme: dark"));
const light = css.slice(0, css.indexOf("prefers-color-scheme: dark"));

function token(source: string, name: string): string {
	const found = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`).exec(source);
	if (!found?.[1]) throw new Error(`--${name} is not a hex colour`);
	return found[1];
}

function luminance(hex: string): number {
	const channel = (i: number) => {
		const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}

describe.each([
	["light", light],
	["dark", dark],
])("%s theme", (_, source) => {
	it.each(["ink", "muted", "sienna", "danger"])("%s text passes AA on every surface", (text) => {
		for (const surface of ["paper", "panel", "inset"]) {
			const ratio = contrast(token(source, text), token(source, surface));
			expect(ratio, `${text} on ${surface}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
		}
	});

	it("text on sienna passes AA", () => {
		expect(contrast(token(source, "on-sienna"), token(source, "sienna"))).toBeGreaterThanOrEqual(
			4.5,
		);
	});
});
