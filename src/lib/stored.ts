/**
 * What is kept in localStorage (REWRITE_PLAN §5.7), as pure encode/decode:
 * the last plan opened on this device (so the home-screen icon comes back to
 * it) and this device's grocery state, which is never shared.
 *
 *   { "version": 1, "plan": <wire plan>,
 *     "grocery": { "checked": [{ "key", "amount", "custom" }], "range": "all" | { "days": n } } }
 */
import { z } from "zod";
import type { Dictionary } from "./data";
import type { IsoDate } from "./dates";
import { DEFAULT_GROCERY, type GroceryState } from "./grocery";
import { EMPTY_PLAN, type Plan } from "./plan";
import { fromWire, toWire } from "./planCodec";

/** Bump when the stored shape changes incompatibly; a build refuses payloads newer than it knows. */
export const STORED_VERSION = 1;

export type StoredState = { plan: Plan; grocery: GroceryState };

const storedGrocery = z.object({
	checked: z
		.array(
			z.object({
				key: z.string(),
				amount: z.number().nullable().catch(null),
				custom: z.array(z.string()).catch([]),
			}),
		)
		.catch([]),
	range: z.union([z.literal("all"), z.object({ days: z.number().int().min(1) })]).catch("all"),
});

const stored = z.object({
	version: z.number().int().min(0).catch(0),
	plan: z.unknown().optional(),
	grocery: storedGrocery.catch(DEFAULT_GROCERY),
});

export function encodeStored(state: StoredState): string {
	return JSON.stringify({
		version: STORED_VERSION,
		plan: toWire(state.plan),
		grocery: state.grocery,
	});
}

function parseJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

/**
 * Read a stored payload as of `today` (past days drop off the plan). `null`
 * for garbage, or for a payload newer than this build understands. A plan that
 * can't be read comes back empty; the grocery state is kept.
 */
export function decodeStored(
	raw: string,
	today: IsoDate,
	dictionary: Dictionary,
): StoredState | null {
	const parsed = stored.safeParse(parseJson(raw));
	if (!parsed.success || parsed.data.version > STORED_VERSION) return null;
	return {
		plan: fromWire(parsed.data.plan ?? {}, today, dictionary) ?? EMPTY_PLAN,
		grocery: parsed.data.grocery,
	};
}

/**
 * The plan from cooking-rs's stored state (`cooking-rs.state`, same origin),
 * for the one-time import. Only the plan: its grocery state had other rules.
 * `null` when there is nothing usable, including its old weekday plans.
 */
export function importCookingRsPlan(
	raw: string,
	today: IsoDate,
	dictionary: Dictionary,
): Plan | null {
	const json = parseJson(raw);
	if (typeof json !== "object" || json === null || !("plan" in json)) return null;
	return fromWire(json.plan, today, dictionary);
}

/**
 * Startup precedence: a plan in the URL wins (a link someone sent, or the
 * address bar on reload); otherwise the last plan stored on this device;
 * otherwise an empty plan. The grocery state is always this device's.
 */
export function resolveInitial(urlPlan: Plan | null, storedState: StoredState | null): StoredState {
	return {
		plan: urlPlan ?? storedState?.plan ?? EMPTY_PLAN,
		grocery: storedState?.grocery ?? DEFAULT_GROCERY,
	};
}
