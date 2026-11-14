/**
 * A hand-drawn underline in the current colour. The notebook touch of the
 * plan: under "Today", "Tomorrow" and "next week", and nowhere else.
 */
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
