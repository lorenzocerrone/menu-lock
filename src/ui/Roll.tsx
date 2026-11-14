import { AnimatePresence, motion } from "motion/react";

/**
 * Text that rolls to its new value when it changes: an amount when the
 * servings change, a count when something is ticked.
 */
export function Roll({ children, className = "" }: { children: string; className?: string }) {
	return (
		<span className={`relative inline-flex overflow-hidden align-bottom ${className}`}>
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span
					key={children}
					initial={{ y: "60%", opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: "-60%", opacity: 0 }}
					transition={{ duration: 0.16, ease: "easeOut" }}
					className="whitespace-nowrap"
				>
					{children}
				</motion.span>
			</AnimatePresence>
		</span>
	);
}
