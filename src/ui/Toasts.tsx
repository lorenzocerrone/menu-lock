import { AnimatePresence, motion } from "motion/react";
import { spring } from "./motion";
import { useToast } from "./toast";

/** Where toasts appear: a small ink label above the tab strip. */
export function Toasts() {
	const { message, id } = useToast();
	return (
		<div
			role="status"
			aria-live="polite"
			className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 wide:bottom-8"
		>
			<AnimatePresence>
				{message ? (
					<motion.p
						key={id}
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={spring}
						className="rounded-card bg-ink px-4 py-2.5 font-mono text-paper text-sm shadow-lift"
					>
						{message}
					</motion.p>
				) : null}
			</AnimatePresence>
		</div>
	);
}
