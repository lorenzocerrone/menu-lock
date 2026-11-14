/** Small pieces the three lab directions share. Phase 1 scaffolding. */
import { motion } from "motion/react";
import type { Recipe } from "../lib/data";
import { formatServes, formatTotalTime } from "../lib/format";
import type { LabModel, Screen } from "./model";

export type DirectionProps = { model: LabModel; screen: Screen; setScreen: (s: Screen) => void };

/** "25 min · Italian · serves 2", leaving out what a recipe doesn't have. */
export function metaParts(recipe: Recipe): string[] {
	return [formatTotalTime(recipe), recipe.cuisine, formatServes(recipe.servings)].filter(
		(part): part is string => !!part,
	);
}

/** A hand-drawn underline in the current colour. */
export function Underline({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 120 8" preserveAspectRatio="none" aria-hidden="true" className={className}>
			<path
				d="M2 5.2 C 18 2.2, 30 6.6, 47 4.1 S 80 2.4, 96 4.8 S 112 5.6, 118 3.4"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** A hand-drawn circle with a tick that draws itself. */
export function HandTick({ on }: { on: boolean }) {
	return (
		<svg viewBox="0 0 28 28" aria-hidden="true" className="size-7 shrink-0">
			<path
				d="M14 3.4 C 20.4 3, 24.9 8, 24.5 14.2 S 19.6 25, 13.6 24.6 S 3.2 19.8, 3.5 13.6 S 8.2 3.6, 14.8 3.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				className={on ? "text-sienna" : "text-faint"}
			/>
			<motion.path
				d="M8.2 14.6 L12.4 18.8 L20.6 9.2"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.6"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="text-sienna"
				initial={false}
				animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
				transition={{ duration: 0.25, ease: "easeOut" }}
			/>
		</svg>
	);
}

/** A line that draws itself across its (relative) parent when `on`. */
export function Strike({ on }: { on: boolean }) {
	return (
		<motion.span
			aria-hidden="true"
			className="pointer-events-none absolute top-1/2 right-0 left-0 h-[1.5px] origin-left bg-current"
			initial={false}
			animate={{ scaleX: on ? 1 : 0 }}
			transition={{ duration: 0.25, ease: "easeOut" }}
		/>
	);
}

export const spring = { type: "spring", stiffness: 420, damping: 34 } as const;
