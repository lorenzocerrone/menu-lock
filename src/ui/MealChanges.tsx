/**
 * Change a planned meal's ingredients, for that meal only: swap one, leave one
 * out, use more or less, add one. Shown inside the meal's sheet. Amounts are
 * shown for the meal's servings and stored for the recipe's own.
 */
import { useState } from "react";
import { DATA } from "../dataset";
import { applyChanges, type PlannedLine } from "../lib/changes";
import type { Recipe } from "../lib/data";
import { parseNumber, suggest } from "../lib/extras";
import { formatAmountInput, formatLineAmount, formatLineChange } from "../lib/format";
import type { MealChange, RecipeMeal } from "../lib/plan";
import { convertibleUnits } from "../lib/units";
import { buttonDanger, buttonPaper, buttonPrimary, input, rowButton } from "./styles";

type Props = {
	recipe: Recipe;
	meal: RecipeMeal;
	/** Put a change on the meal (it replaces any earlier change to that ingredient). */
	onChange: (change: MealChange) => void;
	/** Put an ingredient back to the recipe's own. */
	onReset: (key: string) => void;
	/** Leave the ingredient list (back to the meal). */
	onBack: () => void;
};

/** The recipe ingredient a line stands for: itself, or the one it was swapped in for. */
const originalKey = (line: PlannedLine) => line.instead?.key ?? line.key;

/** The unit a line is written in, as the unit field shows it. */
function unitOf(line: PlannedLine): string {
	if (line.unit === null) return DATA.dictionary.entries.get(line.key)?.unit ?? "pcs";
	return line.unit === "pcs" && line.count?.label ? line.count.label : line.unit;
}

/** Pick a dictionary ingredient by typing its name. */
function IngredientSearch({
	exclude,
	onPick,
}: {
	exclude: ReadonlySet<string>;
	onPick: (key: string) => void;
}) {
	const [text, setText] = useState("");
	const found = suggest(DATA.dictionary, text, 8).filter((s) => !exclude.has(s.key));
	return (
		<div>
			<input
				value={text}
				onChange={(event) => setText(event.target.value)}
				placeholder="Search ingredients"
				aria-label="Search ingredients"
				autoComplete="off"
				className={input}
			/>
			{text.trim() !== "" && found.length === 0 ? (
				<p className="mt-3 font-mono text-muted text-sm">
					Not in the ingredient list. New ingredients are added with a recipe.
				</p>
			) : null}
			<ul className="mt-2">
				{found.map((s) => (
					<li key={s.key}>
						<button type="button" onClick={() => onPick(s.key)} className={rowButton}>
							<span>{s.name}</span>
							<span className="font-mono text-muted text-xs">{s.aisle}</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

type LineEditorProps = Props & {
	line: PlannedLine;
	servings: number;
	onDone: () => void;
	onSwap: () => void;
};

/** One ingredient of the meal: its amount and unit, and what else can be done with it. */
function LineEditor({
	recipe,
	line,
	servings,
	onChange,
	onReset,
	onDone,
	onSwap,
}: LineEditorProps) {
	const entry = DATA.dictionary.entries.get(line.key);
	const shown = formatAmountInput(
		line.amount === null ? null : (line.amount * servings) / recipe.servings,
	);
	const [amount, setAmount] = useState(shown);
	const [unit, setUnit] = useState(unitOf(line));
	const units = entry ? convertibleUnits(entry.unit, entry.count) : [];
	const number = amount.trim() === "" ? undefined : (parseNumber(amount.trim()) ?? null);
	const added = line.change === "add";

	const save = () => {
		if (number === null) return;
		// Untouched: leave it exactly as it was (re-reading a rounded number would change it).
		if (amount === shown && unit === unitOf(line)) return onDone();
		const quantity: { amount?: number; unit?: string } = {};
		if (number !== undefined) {
			// Stored for the recipe's own servings; "pcs" is written as no unit.
			quantity.amount = (number * recipe.servings) / servings;
			if (unit !== "pcs") quantity.unit = unit;
		}
		if (added) onChange({ kind: "add", key: line.key, ...quantity });
		else if (line.instead)
			onChange({ kind: "swap", key: line.instead.key, for: line.key, ...quantity });
		else onChange({ kind: "set", key: line.key, ...quantity });
		onDone();
	};

	return (
		<div>
			<h3 className="font-bold text-lg">{line.name}</h3>
			{formatLineChange(line) ? (
				<p className="font-mono text-sienna text-xs">{formatLineChange(line)}</p>
			) : null}
			<div className="mt-3 flex gap-2">
				<input
					value={amount}
					onChange={(event) => setAmount(event.target.value)}
					inputMode="decimal"
					placeholder="to taste"
					aria-label="Amount"
					aria-invalid={number === null}
					className={`${input} min-w-0 flex-1 ${number === null ? "border-danger" : ""}`}
				/>
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
			</div>
			<p className="mt-1 font-mono text-muted text-xs">
				{number === null
					? "A number, or nothing for “to taste”."
					: "For this meal. Empty means “to taste”."}
			</p>
			<button
				type="button"
				onClick={save}
				disabled={number === null}
				className={`${buttonPrimary} mt-4 w-full`}
			>
				Save
			</button>
			<div className="mt-4">
				{added ? null : (
					<button type="button" onClick={onSwap} className={rowButton}>
						Swap for another ingredient <span className="font-mono text-muted">›</span>
					</button>
				)}
				{!added && line.change ? (
					<button
						type="button"
						onClick={() => {
							onReset(originalKey(line));
							onDone();
						}}
						className={rowButton}
					>
						Back to the recipe’s <span className="font-mono text-muted">↺</span>
					</button>
				) : null}
			</div>
			<button
				type="button"
				onClick={() => {
					if (added) onReset(line.key);
					else onChange({ kind: "skip", key: originalKey(line) });
					onDone();
				}}
				className={`${buttonDanger} mt-4 w-full`}
			>
				{added ? "Remove" : "Leave out"}
			</button>
		</div>
	);
}

type View =
	| { at: "list" }
	| { at: "edit"; key: string }
	| { at: "swap"; key: string }
	| { at: "add" };

export function MealChanges(props: Props) {
	const { recipe, meal, onChange, onReset, onBack } = props;
	const [view, setView] = useState<View>({ at: "list" });
	const { lines, skipped } = applyChanges(recipe, meal.changes, DATA.dictionary);
	const servings = meal.servings ?? recipe.servings;
	const inMeal = new Set([...lines.map((l) => l.key), ...recipe.lines.map((l) => l.key)]);
	const back = (
		<button type="button" onClick={() => setView({ at: "list" })} className={`${buttonPaper} mb-4`}>
			‹ Ingredients
		</button>
	);

	if (view.at === "edit") {
		const line = lines.find((l) => l.key === view.key);
		if (line) {
			return (
				<>
					{back}
					<LineEditor
						{...props}
						// A new line (after a swap) gets a fresh form.
						key={`${line.key}:${line.amount}:${line.unit}`}
						line={line}
						servings={servings}
						onDone={() => setView({ at: "list" })}
						onSwap={() => setView({ at: "swap", key: originalKey(line) })}
					/>
				</>
			);
		}
	}
	if (view.at === "swap" || view.at === "add") {
		return (
			<>
				{back}
				<p className="mb-2 text-muted">
					{view.at === "add"
						? "Add an ingredient to this meal."
						: "Use another ingredient instead, for this meal."}
				</p>
				<IngredientSearch
					exclude={inMeal}
					onPick={(key) => {
						onChange(
							view.at === "add" ? { kind: "add", key } : { kind: "swap", key: view.key, for: key },
						);
						setView({ at: "edit", key }); // straight to its amount
					}}
				/>
			</>
		);
	}

	return (
		<>
			<button type="button" onClick={onBack} className={`${buttonPaper} mb-4`}>
				‹ {recipe.title}
			</button>
			<p className="mb-2 text-muted">
				For this meal only. The recipe stays as it is; the grocery list follows.
			</p>
			<ul aria-label="Ingredients of this meal">
				{lines.map((line, i) => (
					<li key={i}>
						<button
							type="button"
							onClick={() => setView({ at: "edit", key: line.key })}
							className={rowButton}
						>
							<span className="min-w-0">
								<span className="block truncate">{line.name}</span>
								{formatLineChange(line) ? (
									<span className="block font-mono text-sienna text-xs">
										{formatLineChange(line)}
									</span>
								) : null}
							</span>
							<span className="shrink-0 font-mono text-sm">
								{formatLineAmount(line, servings, recipe.servings)}
							</span>
						</button>
					</li>
				))}
				{skipped.map((line, i) => (
					<li key={`skipped-${i}`}>
						<button type="button" onClick={() => onReset(line.key)} className={rowButton}>
							<span className="min-w-0">
								<span className="block truncate text-faint line-through">{line.name}</span>
								<span className="block font-mono text-sienna text-xs">left out</span>
							</span>
							<span className="shrink-0 font-mono text-muted text-xs">put back ↺</span>
						</button>
					</li>
				))}
			</ul>
			<button
				type="button"
				onClick={() => setView({ at: "add" })}
				className={`${buttonPaper} mt-4 w-full`}
			>
				+ Add an ingredient
			</button>
		</>
	);
}
