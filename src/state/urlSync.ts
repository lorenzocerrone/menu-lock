/**
 * The URL is the plan (REWRITE_PLAN §5.4): after every change the plan is
 * written into `?plan=` with `replace` (no history entry), and a plan that
 * arrives in the address from outside (a link pasted into an open tab) is loaded.
 *
 * The store is the source of truth. Going back or forward lands on history
 * entries the app made earlier, which still hold the plan as it was then:
 * loading it would undo every change made since. So the address is rewritten
 * to the current plan instead, and only an entry the app did not make (a new
 * address typed or pasted into the tab) can bring a plan in.
 *
 * A link whose days have all passed brings nothing in; a toast says so.
 */
import { DATA } from "../dataset";
import { encodePlan, readPlanParam } from "../lib/planCodec";
import type { router as appRouter } from "../router";
import { toast } from "../ui/toast";
import type { AppStore } from "./store";

/** The toast for a link whose days have all passed. */
export const PASSED_LINK = "That plan's days have passed";

export function startUrlSync(router: typeof appRouter, store: AppStore): void {
	const wanted = () => encodePlan(store.getState().plan) ?? undefined;
	const inAddress = () => router.state.location.search.plan;

	/**
	 * Every `plan` this app has had in the address: Back and Forward land on
	 * these. Any other is a link brought in from outside, however the browser
	 * got there (a pasted address can carry the router's history state).
	 */
	const ours = new Set<string>();
	const initial = inAddress();
	if (initial !== undefined) ours.add(initial); // already read at startup

	/**
	 * Also from outside: an entry the router did not make. It tags every entry
	 * it makes with its own `history.state`; a typed address may have none.
	 * This catches a link opened again in the tab it was first opened in.
	 */
	let fromOutside = false;
	window.addEventListener("popstate", () => {
		fromOutside = window.history.state === null;
	});

	const write = () => {
		const plan = wanted();
		if (plan !== undefined) ours.add(plan);
		if (inAddress() === plan) return;
		void router.navigate({ to: ".", search: (prev) => ({ ...prev, plan }), replace: true });
	};

	store.subscribe((state, previous) => {
		if (state.plan !== previous.plan) write();
	});

	router.subscribe("onResolved", () => {
		const outside = fromOutside;
		fromOutside = false;
		const found = inAddress();
		if (found === wanted()) return;
		if (found !== undefined && (outside || !ours.has(found))) {
			ours.add(found);
			const { plan, passed } = readPlanParam(found, store.getState().today, DATA.dictionary);
			if (passed) toast(PASSED_LINK);
			if (plan) {
				store.getState().loadPlan(plan);
				return; // the store change writes the address
			}
		}
		write();
	});

	write();
}
