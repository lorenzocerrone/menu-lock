/**
 * The design lab (REWRITE_PLAN §8, phase 1): three directions for the evolved
 * paper look, as real screens on the real recipes, to pick and mix from.
 * Reached at #/lab in development and in pull-request previews only.
 *
 * Phase 1 scaffolding: delete src/lab/ and the /lab route once a direction is chosen.
 */
import "./lab.css";
import { MotionConfig } from "motion/react";
import { Lockfile } from "./Lockfile";
import { type Screen, useLabModel } from "./model";
import { Notebook } from "./Notebook";
import type { DirectionProps } from "./parts";
import { Receipt } from "./Receipt";

export const DIRECTIONS = [
	{ id: "notebook", letter: "A", name: "Notebook", view: Notebook },
	{ id: "receipt", letter: "B", name: "Receipt", view: Receipt },
	{ id: "lockfile", letter: "C", name: "Lockfile", view: Lockfile },
] as const satisfies readonly {
	id: string;
	letter: string;
	name: string;
	view: (p: DirectionProps) => unknown;
}[];

export type DirectionId = (typeof DIRECTIONS)[number]["id"];

type Props = {
	direction: DirectionId;
	screen: Screen;
	setDirection: (d: DirectionId) => void;
	setScreen: (s: Screen) => void;
};

export default function LabPage({ direction, screen, setDirection, setScreen }: Props) {
	const model = useLabModel();
	const current = DIRECTIONS.find((d) => d.id === direction) ?? DIRECTIONS[0];
	const View = current.view;
	return (
		<MotionConfig reducedMotion="user">
			<div className="lab">
				{/* Lab chrome: not part of any design. */}
				<div className="sticky top-0 z-20 flex items-center gap-1 bg-ink px-2 py-1.5 font-mono text-paper text-xs">
					<span className="px-1 opacity-70">lab</span>
					{DIRECTIONS.map((d) => (
						<button
							key={d.id}
							type="button"
							aria-pressed={d.id === current.id}
							onClick={() => setDirection(d.id)}
							className={`h-8 flex-1 rounded-[4px] ${d.id === current.id ? "bg-paper font-bold text-ink" : ""}`}
						>
							{d.letter} · {d.name}
						</button>
					))}
				</div>
				<View model={model} screen={screen} setScreen={setScreen} />
			</div>
		</MotionConfig>
	);
}
