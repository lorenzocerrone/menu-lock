/**
 * The localStorage boundary (REWRITE_PLAN §5.7). Phase 0 only names the key;
 * reading and writing the stored state arrives with the store in Phase 2/3.
 */

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
