/**
 * An extra on a day, in its sheet: how much of it (an amount and a unit for an
 * ingredient from the list, free text for anything typed), and whether it is on
 * the grocery list.
 */
import { useState } from "react";
import { DATA } from "../dataset";
import { parseNumber } from "../lib/extras";
import { formatAmountInput } from "../lib/format";
import type { Extra, ItemMeal } from "../lib/plan";
import { convertibleUnits, matchesLabel, parseUnit } from "../lib/units";
import { Stamp } from "./Stamp";
import { buttonPaper, input, rowButton } from "./styles";

type Props = { meal: ItemMeal; onChange: (change: { item?: Extra; buy?: boolean }) => void };

export function ItemEditor({ meal, onChange }: Props) {
	const { item } = meal;
	const entry = item.kind === "catalog" ? DATA.dictionary.entries.get(item.key) : undefined;
	const units = entry ? convertibleUnits(entry.unit, entry.count) : [];
	// The unit as the field lists it: a piece word in any spelling ("fillets") is the
	// ingredient's piece label; no unit means pieces.
	const pieces = entry?.count?.label ?? "pcs";
	const startUnit =
		item.kind !== "catalog"
			? ""
			: item.unit === undefined || matchesLabel(entry?.count, item.unit)
				? pieces
				: (parseUnit(item.unit) ?? pieces);
	const startText =
		item.kind === "catalog" ? formatAmountInput(item.amount ?? null) : (item.quantity ?? "");
	const [text, setText] = useState(startText);
	const [unit, setUnit] = useState(units.includes(startUnit) ? startUnit : (units[0] ?? "pcs"));
	const number = text.trim() === "" ? undefined : (parseNumber(text.trim()) ?? null);
	const invalid = item.kind === "catalog" && number === null;
	const changed = text !== startText || (item.kind === "catalog" && unit !== startUnit);

	const save = () => {
		if (item.kind === "custom")
			return onChange({ item: { ...item, quantity: text.trim() || null } });
		if (number === null) return;
		const next: Extra = { kind: "catalog", key: item.key };
		if (number !== undefined) {
			next.amount = number;
			if (unit !== "pcs") next.unit = unit;
		}
		onChange({ item: next });
	};

	return (
		<div className="mt-3">
			<div className="flex gap-2">
				<input
					value={text}
					onChange={(event) => setText(event.target.value)}
					inputMode={item.kind === "catalog" ? "decimal" : "text"}
					placeholder={item.kind === "catalog" ? "how much" : "how much (2, 1 box…)"}
					aria-label={item.kind === "catalog" ? "Amount" : "Quantity"}
					aria-invalid={invalid}
					autoComplete="off"
					className={`${input} min-w-0 flex-1 ${invalid ? "border-danger" : ""}`}
				/>
				{item.kind === "catalog" && units.length > 0 ? (
					<select
						value={unit}
						onChange={(event) => setUnit(event.target.value)}
						aria-label="Unit"
						className="h-11 w-28 shrink-0 rounded-card border border-rule-soft bg-inset px-2 font-mono text-sm focus:outline-none focus-visible:border-sienna"
					>
						{units.map((u) => (
							<option key={u} value={u}>
								{u}
							</option>
						))}
					</select>
				) : null}
				<button
					type="button"
					onClick={save}
					disabled={!changed || invalid}
					className={`${buttonPaper} shrink-0`}
				>
					Save
				</button>
			</div>
			{invalid ? <p className="mt-1 font-mono text-danger text-xs">A number, or nothing.</p> : null}
			<button
				type="button"
				aria-pressed={meal.buy ?? false}
				onClick={() => onChange({ buy: !meal.buy })}
				className={`${rowButton} mt-3`}
			>
				On the grocery list
				<Stamp on={meal.buy ?? false} />
			</button>
		</div>
	);
}
