import type { Page } from "@playwright/test";

/** The local date `days` from today, as YYYY-MM-DD (the browser runs in the same time zone). */
export function iso(days = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The `plan` parameter for a wire-format plan (REWRITE_PLAN §5.4), given as JSON text or a value. */
export function planParam(wire: unknown): string {
	const json = typeof wire === "string" ? wire : JSON.stringify(wire);
	return Buffer.from(json).toString("base64url");
}

/** Open a route with a plan in the address: `open(page, "/grocery", { dates: … })`. */
export async function open(page: Page, route: string, wire?: unknown): Promise<void> {
	await page.goto(`/#${route}${wire === undefined ? "" : `?plan=${planParam(wire)}`}`);
}

/** The grocery receipt row of an ingredient, by its exact name. */
export function row(page: Page, name: string) {
	return page.getByRole("button", { name: new RegExp(`(^|✓ )${name} `) });
}
