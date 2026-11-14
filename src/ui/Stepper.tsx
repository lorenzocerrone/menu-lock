type Props = { value: number; onChange: (value: number) => void; label: string; min?: number };

/** − n +, for servings. Never goes below `min`. */
export function Stepper({ value, onChange, label, min = 1 }: Props) {
	const button =
		"flex size-11 items-center justify-center font-mono text-xl text-sienna disabled:text-faint";
	return (
		// biome-ignore lint/a11y/useSemanticElements: a fieldset would add a legend the design has no room for
		<div
			role="group"
			aria-label={label}
			className="inline-flex items-center rounded-card border border-rule-soft bg-inset shadow-card"
		>
			<button
				type="button"
				aria-label={`Fewer ${label.toLowerCase()}`}
				disabled={value <= min}
				onClick={() => onChange(Math.max(min, value - 1))}
				className={button}
			>
				−
			</button>
			<output className="min-w-8 text-center font-bold font-mono">{value}</output>
			<button
				type="button"
				aria-label={`More ${label.toLowerCase()}`}
				onClick={() => onChange(value + 1)}
				className={button}
			>
				+
			</button>
		</div>
	);
}
