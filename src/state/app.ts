/**
 * The running app's state: the store, created once from the URL and this
 * device's storage, kept in storage as it changes, and kept on today's date.
 * Components read it with `useApp` and `useGrocery`.
 */
import { useMemo } from "react";
import { useStore } from "zustand";
import { DATA } from "../dataset";
import { localIsoDate } from "../lib/dates";
import { type GroceryAisle, progress } from "../lib/grocery";
import { readPlanParam } from "../lib/planCodec";
import { resolveInitial } from "../lib/stored";
import { toast } from "../ui/toast";
import { browserStorage, loadStored, saveStored } from "./storage";
import { type AppState, createAppStore, groceryList } from "./store";
import { PASSED_LINK } from "./urlSync";

/** The `plan` parameter of the address the app was opened with, if any. */
function planInAddress(): string | null {
	const [, search = ""] = window.location.hash.split("?");
	return new URLSearchParams(search).get("plan");
}

const today = localIsoDate(new Date());
const storage = browserStorage();
const inAddress = planInAddress();
const opened = inAddress === null ? null : readPlanParam(inAddress, today, DATA.dictionary);

/**
 * A plan in the URL wins; else the last plan stored on this device; else empty.
 * A link whose days have all passed opens nothing: the stored plan stays.
 */
export const store = createAppStore(
	DATA,
	today,
	resolveInitial(opened?.plan ?? null, loadStored(storage, today, DATA.dictionary)),
);
if (opened?.passed) toast(PASSED_LINK);

const save = ({ plan, grocery }: AppState) => saveStored(storage, { plan, grocery });
save(store.getState());
store.subscribe(save);

// The page was left open overnight: when it is looked at again, past days drop off.
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState !== "visible") return;
	const now = localIsoDate(new Date());
	if (now !== store.getState().today) store.getState().setToday(now);
});

export function useApp<T>(selector: (state: AppState) => T): T {
	return useStore(store, selector);
}

/** The grocery list for the current plan and range, and how much of it is left to buy. */
export function useGrocery(): { aisles: GroceryAisle[]; left: number; total: number } {
	const plan = useApp((s) => s.plan);
	const grocery = useApp((s) => s.grocery);
	const today = useApp((s) => s.today);
	// A tick changes `grocery` but not the list: the lines stay the same objects,
	// so only the ticked row re-renders.
	const range = grocery.range;
	const aisles = useMemo(
		() => groceryList({ plan, grocery: { checked: [], range }, today }, DATA),
		[plan, range, today],
	);
	return useMemo(() => ({ aisles, ...progress(aisles, grocery) }), [aisles, grocery]);
}
