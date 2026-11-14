/**
 * The URL is the plan (REWRITE_PLAN §5.4): after every change the plan is
 * written into `?plan=` with `replace` (no history entry), and a plan that
 * arrives in the address (a link pasted into an open tab) is loaded.
 */
import { DATA } from "../dataset";
import { decodePlan, encodePlan } from "../lib/planCodec";
import type { router as appRouter } from "../router";
import type { AppStore } from "./store";

export function startUrlSync(router: typeof appRouter, store: AppStore): void {
	/** What this module put in the address and has not yet seen settle. */
	const written = new Set<string | undefined>();
	const wanted = () => encodePlan(store.getState().plan) ?? undefined;
	const inAddress = () => router.state.location.search.plan;

	const write = () => {
		const plan = wanted();
		if (inAddress() === plan) return;
		written.add(plan);
		void router.navigate({ to: ".", search: (prev) => ({ ...prev, plan }), replace: true });
	};

	store.subscribe((state, previous) => {
		if (state.plan !== previous.plan) write();
	});

	router.subscribe("onResolved", () => {
		const found = inAddress();
		if (found === wanted()) {
			written.clear();
			return;
		}
		// Not ours: someone put a plan in the address. Load it if it is one.
		if (found !== undefined && !written.has(found)) {
			const { today, loadPlan } = store.getState();
			const plan = decodePlan(found, today, DATA.dictionary);
			if (plan && encodePlan(plan) !== encodePlan(store.getState().plan)) {
				loadPlan(plan);
				return; // the store change writes the address
			}
		}
		write();
	});

	write();
}
