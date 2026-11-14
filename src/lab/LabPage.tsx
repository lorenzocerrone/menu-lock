/**
 * The reference screens of the chosen design, at #/lab in development and in
 * pull-request previews only. Phase 3 ports them into the real routes and
 * deletes src/lab/, src/routes/lab.tsx, the /lab route, tests/e2e/lab.spec.ts,
 * the lab entries in scripts/shots.ts and VITE_LAB.
 */
import { SCREENS, type Screen, useLabModel } from "./model";
import { Grocery, Planner, Recipes } from "./Screens";

export default function LabPage({
	screen,
	setScreen,
}: {
	screen: Screen;
	setScreen: (s: Screen) => void;
}) {
	const model = useLabModel();
	return (
		<>
			{/* Lab chrome: not part of the design. */}
			<div className="mt-3 flex items-center gap-1 rounded-card bg-ink p-1 font-mono text-paper text-xs">
				<span className="px-2 opacity-70">reference</span>
				{SCREENS.map((s) => (
					<button
						key={s.id}
						type="button"
						aria-pressed={s.id === screen}
						onClick={() => setScreen(s.id)}
						className={`h-8 flex-1 rounded-[4px] ${s.id === screen ? "bg-paper font-bold text-ink" : ""}`}
					>
						{s.label}
					</button>
				))}
			</div>
			{screen === "recipes" ? <Recipes model={model} /> : null}
			{screen === "planner" ? <Planner model={model} /> : null}
			{screen === "grocery" ? <Grocery model={model} /> : null}
		</>
	);
}
