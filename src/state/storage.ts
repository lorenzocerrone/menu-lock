/**
 * The localStorage boundary (REWRITE_PLAN §5.7). The shape of what is stored
 * is in src/lib/stored.ts; this file only reads and writes it. The store that
 * calls it arrives in phase 3.
 */
import type { Dictionary } from "../lib/data";
import type { IsoDate } from "../lib/dates";
import { DEFAULT_GROCERY } from "../lib/grocery";
import { decodeStored, encodeStored, importCookingRsPlan, type StoredState } from "../lib/stored";

/**
 * The key this build stores its state under. A pull-request preview shares the
 * origin with the live app, so it gets its own key and never touches real data.
 */
export function storageKey(preview: string | undefined): string {
	return preview ? `menu-lock.${preview}.state` : "menu-lock.state";
}

/** "pr-12" in a pull-request preview build, undefined otherwise. */
export const PREVIEW: string | undefined = import.meta.env.VITE_PREVIEW || undefined;

export const STORAGE_KEY = storageKey(PREVIEW);

/** Where cooking-rs (same origin) kept its state; read once, for the import. */
export const COOKING_RS_KEY = "cooking-rs.state";

/** The browser's localStorage, or `null` where it is refused (private mode, blocked site data). */
export function browserStorage(): Storage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

function read(storage: Pick<Storage, "getItem">, key: string): string | null {
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

/**
 * The state stored on this device as of `today`, if any. On the first start
 * of the live app (nothing stored yet), the plan last opened in cooking-rs is
 * imported, so its home-screen icon keeps its plan after the redirect.
 */
export function loadStored(
	storage: Pick<Storage, "getItem"> | null,
	today: IsoDate,
	dictionary: Dictionary,
	key: string = STORAGE_KEY,
): StoredState | null {
	if (!storage) return null;
	const raw = read(storage, key);
	if (raw !== null) return decodeStored(raw, today, dictionary);
	if (key !== storageKey(undefined)) return null;
	const old = read(storage, COOKING_RS_KEY);
	const plan = old === null ? null : importCookingRsPlan(old, today, dictionary);
	return plan ? { plan, grocery: DEFAULT_GROCERY } : null;
}

/** Write the state. Failures (quota, private mode) are ignored on purpose. */
export function saveStored(
	storage: Pick<Storage, "setItem"> | null,
	state: StoredState,
	key: string = STORAGE_KEY,
): void {
	try {
		storage?.setItem(key, encodeStored(state));
	} catch {
		// Nothing to do: the plan is still in the URL.
	}
}
