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
 */
import { DATA } from "../dataset";
import { decodePlan, encodePlan } from "../lib/planCodec";
import type { router as appRouter } from "../router";
import type { AppStore } from "./store";

export function startUrlSync(router: typeof appRouter, store: AppStore): void {
	const wanted = () => encodePlan(store.getState().plan) ?? undefined;
	const inAddress = () => router.state.location.search.plan;

	/**
	 * Whether the address was last changed from outside the app. The router
	 * tags every entry it makes with its own `history.state`; an address typed
	 * or pasted into the tab gives a new entry without any.
	 */
	let fromOutside = false;
	window.addEventListener("popstate", () => {
		fromOutside = window.history.state === null;
	});

	const write = () => {
		const plan = wanted();
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
		if (outside && found !== undefined) {
			const plan = decodePlan(found, store.getState().today, DATA.dictionary);
			if (plan) {
				store.getState().loadPlan(plan);
				return; // the store change writes the address
			}
		}
		write();
	});

	write();
}
