type Props = {
	label: string;
	on: boolean;
	onClick: () => void;
	/** Dimmed: choosing it would give nothing. */
	dim?: boolean;
	/** Says what a tap does, when it isn't a plain toggle ("Remove filter vegetarian"). */
	ariaLabel?: string;
};

/** A dashed paper chip; solid sienna when on. */
export function Chip({ label, on, onClick, dim = false, ariaLabel }: Props) {
	return (
		<button
			type="button"
			aria-pressed={on}
			aria-label={ariaLabel}
			onClick={onClick}
			className={`min-h-9 rounded-card border px-3 font-mono text-xs ${
				on ? "border-sienna bg-sienna text-on-sienna" : "border-rule border-dashed text-muted"
			} ${dim ? "opacity-40" : ""}`}
		>
			{label}
		</button>
	);
}
