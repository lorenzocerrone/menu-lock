import { AnimatePresence, motion } from "motion/react";
import { stampSpring } from "./motion";

/** The grocery tick: an empty box that gets a sienna check stamped into it. */
export function Stamp({ on }: { on: boolean }) {
	return (
		<span className="flex size-6 shrink-0 items-center justify-center border border-rule font-bold font-mono text-sienna text-sm">
			<AnimatePresence initial={false}>
				{on ? (
					<motion.span
						key="check"
						initial={{ scale: 2.4, opacity: 0, rotate: -25 }}
						animate={{ scale: 1, opacity: 1, rotate: -8 }}
						exit={{ scale: 0.6, opacity: 0 }}
						transition={stampSpring}
					>
						✓
					</motion.span>
				) : null}
			</AnimatePresence>
		</span>
	);
}
