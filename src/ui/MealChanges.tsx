/**
 * A planned meal's ingredients, in its sheet: the list as this meal has it, and,
 * by tapping a line, the changes for that meal only (swap one, leave one out,
 * use more or less, add one). Amounts are shown for the meal's servings and
 * stored for the recipe's own.
 */
import { type FormEvent, type ReactNode, useState } from "react";
import { DATA } from "../dataset";
import { applyChanges, freeKey, type PlannedLine } from "../lib/changes";
import type { Recipe } from "../lib/data";
import { lookup } from "../lib/data";
import { parseNumber, suggest } from "../lib/extras";
import {
	formatAmountInput,
	formatCount,
	formatLineChange,
	formatPlannedAmount,
} from "../lib/format";
import { capitalize } from "../lib/grocery";
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
	/** Shown above the ingredient list (the meal's summary), but not while one ingredient is being edited. */
	header?: ReactNode;
	/** Shown under the ingredient list (the meal's other actions), likewise. */
	footer?: ReactNode;
};

/** The recipe ingredient a line stands for: itself, or the one it was swapped in for. */
const originalKey = (line: PlannedLine) => line.instead?.key ?? line.key;

/** The unit a line is written in, as the unit field shows it. */
function unitOf(line: PlannedLine): string {
	if (line.unit === null) return DATA.dictionary.entries.get(line.key)?.unit ?? "pcs";
	return line.unit === "pcs" && line.count?.label ? line.count.label : line.unit;
}

type SearchProps = {
	/** The field's label: "Use instead" when swapping, "Add an ingredient" when adding. */
	label: string;
	/** Keys already in the meal: shown, but not offered again. */
	exclude: ReadonlySet<string>;
	onPick: (key: string) => void;
	/** Use what was typed as it is: an ingredient that is not in the list. */
	onFree: (name: string) => void;
	autoFocus?: boolean;
};

/**
 * Pick an ingredient by typing: the matching ones from the list appear as you
 * type (typos forgiven), and what you typed can be used as it is. One the meal
 * already has is shown as such, so a search never comes up empty for no reason.
 */
function IngredientSearch({ label, exclude, onPick, onFree, autoFocus = false }: SearchProps) {
	const [text, setText] = useState("");
	const typed = capitalize(text.trim());
	const found = suggest(DATA.dictionary, text, 6);
	// Already in the list under that very name: no need to offer it as typed.
	const listed = typed !== "" && lookup(DATA.dictionary, typed) !== null;
	const free = typed !== "" && !listed;
	return (
		<div>
			<input
				value={text}
				onChange={(event) => setText(event.target.value)}
				placeholder="Type an ingredient"
				aria-label={label}
				autoComplete="off"
				autoCapitalize="none"
				enterKeyHint="done"
				// biome-ignore lint/a11y/noAutofocus: the screen was opened to type into this field
				autoFocus={autoFocus}
				onKeyDown={(event) => {
					if (event.key !== "Enter") return;
					const first = found.find((f) => !exclude.has(f.key));
					if (first) onPick(first.key);
					else if (free) onFree(typed);
				}}
				className={input}
			/>
			{found.length > 0 || free ? (
				<ul
					aria-label="Suggestions"
					className="mt-2 rounded-card border border-rule-soft bg-inset px-3 shadow-card"
				>
					{found.map((s) => (
						<li key={s.key}>
							<button
								type="button"
								disabled={exclude.has(s.key)}
								onClick={() => onPick(s.key)}
								className={`${rowButton} last:border-b-0`}
							>
								<span>{s.name}</span>
								<span className="font-mono text-muted text-xs">
									{exclude.has(s.key) ? "in this meal" : s.aisle}
								</span>
							</button>
						</li>
					))}
					{free ? (
						<li>
							<button
								type="button"
								onClick={() => onFree(typed)}
								className={`${rowButton} last:border-b-0`}
							>
								<span className="min-w-0 truncate">Use “{typed}”</span>
								<span className="shrink-0 font-mono text-muted text-xs">as typed</span>
							</button>
						</li>
					) : null}
				</ul>
			) : null}
			{free ? (
				<p className="mt-2 font-mono text-muted text-xs">
					Not in the ingredient list: it goes on the grocery list as typed, under Other, and is not
					added up.
				</p>
			) : null}
		</div>
	);
}

/** A small mono caption over a part of the editor. */
function Caption({ children }: { children: ReactNode }) {
	return (
		<p className="mt-5 mb-2 font-mono text-muted text-xs uppercase tracking-wider">{children}</p>
	);
}

type EditorProps = {
	line: PlannedLine;
	/** What can be swapped in, or `null` for an added ingredient (it is removed, not swapped). */
	swap: ReactNode;
	onChange: (change: MealChange) => void;
	onReset: (key: string) => void;
	onDone: () => void;
};

/** The way out of an ingredient's screen: leave it out (or remove an added one), or undo the change. */
function Actions({ line, onChange, onReset, onDone }: Omit<EditorProps, "swap">) {
	const added = line.change === "add";
	return (
		<div className="mt-6 flex gap-2">
			<button
				type="button"
				onClick={() => {
					if (added) onReset(line.key);
					else onChange({ kind: "skip", key: originalKey(line) });
					onDone();
				}}
				className={`${buttonDanger} flex-1`}
			>
				{added ? "Remove" : "Leave out"}
			</button>
			{!added && line.change ? (
				<button
					type="button"
					onClick={() => {
						onReset(originalKey(line));
						onDone();
					}}
					className={`${buttonPaper} flex-1`}
				>
					Undo change ↺
				</button>
			) : null}
		</div>
	);
}

function Heading({ line }: { line: PlannedLine }) {
	return (
		<>
			<h3 className="font-bold text-lg">{line.name}</h3>
			{formatLineChange(line) ? (
				<p className="font-mono text-sienna text-xs">{formatLineChange(line)}</p>
			) : null}
		</>
	);
}

/** An ingredient that was typed freely: its quantity is text, kept as written. */
function FreeEditor(props: EditorProps) {
	const { line, swap, onChange, onDone } = props;
	const [quantity, setQuantity] = useState(line.free?.quantity ?? "");
	const save = (event: FormEvent) => {
		event.preventDefault();
		const text = quantity.trim() || null;
		if (line.instead)
			onChange({ kind: "swapFree", key: line.instead.key, name: line.name, quantity: text });
		else onChange({ kind: "addFree", key: line.key, name: line.name, quantity: text });
		onDone();
	};
	return (
		<div>
			<Heading line={line} />
			<Caption>How much</Caption>
			<form onSubmit={save} className="flex gap-2">
				<input
					value={quantity}
					onChange={(event) => setQuantity(event.target.value)}
					placeholder="2, 1 bunch…"
					aria-label="Quantity"
					autoComplete="off"
					enterKeyHint="done"
					className={`${input} min-w-0 flex-1`}
				/>
				<button type="submit" className={`${buttonPrimary} shrink-0`}>
					Save
				</button>
			</form>
			<p className="mt-1 font-mono text-muted text-xs">
				Not in the ingredient list: kept as typed, and not scaled with the servings.
			</p>
			{swap ? (
				<>
					<Caption>Or use instead</Caption>
					{swap}
				</>
			) : null}
			<Actions {...props} />
		</div>
	);
}

/** One ingredient of the meal, on one screen: how much of it, what to use instead, or leave it out. */
function LineEditor(props: EditorProps & { recipe: Recipe; servings: number }) {
	const { recipe, line, servings, swap, onChange, onDone } = props;
	const entry = DATA.dictionary.entries.get(line.key);
	const shown = formatAmountInput(
		line.amount === null ? null : (line.amount * servings) / recipe.servings,
	);
	const [amount, setAmount] = useState(shown);
	const [unit, setUnit] = useState(unitOf(line));
	const units = entry ? convertibleUnits(entry.unit, entry.count) : [];
	const number = amount.trim() === "" ? undefined : (parseNumber(amount.trim()) ?? null);

	const save = (event: FormEvent) => {
		event.preventDefault();
		if (number === null) return;
		// Untouched: leave it exactly as it was (re-reading a rounded number would change it).
		if (amount === shown && unit === unitOf(line)) return onDone();
		const quantity: { amount?: number; unit?: string } = {};
		if (number !== undefined) {
			// Stored for the recipe's own servings; "pcs" is written as no unit.
			quantity.amount = (number * recipe.servings) / servings;
			if (unit !== "pcs") quantity.unit = unit;
		}
		if (line.change === "add") onChange({ kind: "add", key: line.key, ...quantity });
		else if (line.instead)
			onChange({ kind: "swap", key: line.instead.key, for: line.key, ...quantity });
		else onChange({ kind: "set", key: line.key, ...quantity });
		onDone();
	};

	return (
		<div>
			<Heading line={line} />
			<Caption>How much, for {formatCount(servings, "serving")}</Caption>
			<form onSubmit={save} className="flex gap-2">
				<input
					value={amount}
					onChange={(event) => setAmount(event.target.value)}
					inputMode="decimal"
					enterKeyHint="done"
					placeholder="to taste"
					aria-label="Amount"
					aria-invalid={number === null}
					className={`${input} min-w-0 flex-1 ${number === null ? "border-danger" : ""}`}
				/>
				<select
					value={unit}
					onChange={(event) => setUnit(event.target.value)}
					aria-label="Unit"
					className="h-11 w-24 shrink-0 rounded-card border border-rule-soft bg-inset px-2 font-mono text-sm focus:outline-none focus-visible:border-sienna"
				>
					{units.map((u) => (
						<option key={u} value={u}>
							{u}
						</option>
					))}
				</select>
				<button type="submit" disabled={number === null} className={`${buttonPrimary} shrink-0`}>
					Save
				</button>
			</form>
			<p className="mt-1 font-mono text-muted text-xs">
				{number === null ? "A number, or nothing for “to taste”." : "Empty means “to taste”."}
			</p>
			{swap ? (
				<>
					<Caption>Or use instead</Caption>
					{swap}
				</>
			) : null}
			<Actions {...props} />
		</div>
	);
}

type View = { at: "list" } | { at: "edit"; key: string } | { at: "add" };

export function MealChanges(props: Props) {
	const { recipe, meal, onChange, onReset, header, footer } = props;
	const [view, setView] = useState<View>({ at: "list" });
	const { lines, skipped } = applyChanges(recipe, meal.changes, DATA.dictionary);
	const servings = meal.servings ?? recipe.servings;
	const inMeal = new Set([...lines.map((l) => l.key), ...recipe.lines.map((l) => l.key)]);
	const back = (
		<button type="button" onClick={() => setView({ at: "list" })} className={`${buttonPaper} mb-4`}>
			‹ Ingredients
		</button>
	);

	const toList = () => setView({ at: "list" });

	if (view.at === "edit") {
		const line = lines.find((l) => l.key === view.key);
		if (line) {
			// Swapping in another ingredient takes it straight back to the list, with the
			// recipe's quantity carried over; one typed freely asks for its quantity.
			const swap =
				line.change === "add" ? null : (
					<IngredientSearch
						key={line.key}
						label="Use instead"
						exclude={inMeal}
						onPick={(key) => {
							onChange({ kind: "swap", key: originalKey(line), for: key });
							toList();
						}}
						onFree={(name) => {
							onChange({ kind: "swapFree", key: originalKey(line), name, quantity: null });
							setView({ at: "edit", key: freeKey(name) });
						}}
					/>
				);
			const editor = { line, swap, onChange, onReset, onDone: toList };
			return (
				<>
					{back}
					{line.free ? (
						<FreeEditor key={`${line.key}:${line.free.quantity}`} {...editor} />
					) : (
						<LineEditor
							// A new line (after a swap) gets a fresh form.
							key={`${line.key}:${line.amount}:${line.unit}`}
							{...editor}
							recipe={recipe}
							servings={servings}
						/>
					)}
				</>
			);
		}
	}
	if (view.at === "add") {
		return (
			<>
				{back}
				<p className="mb-2 text-muted">Add an ingredient to this meal.</p>
				<IngredientSearch
					label="Add an ingredient"
					exclude={inMeal}
					autoFocus
					onFree={(name) => {
						onChange({ kind: "addFree", key: freeKey(name), name, quantity: null });
						setView({ at: "edit", key: freeKey(name) }); // straight to its quantity
					}}
					onPick={(key) => {
						onChange({ kind: "add", key });
						setView({ at: "edit", key }); // straight to its amount
					}}
				/>
			</>
		);
	}

	return (
		<>
			{header}
			<div className="mt-5 flex items-baseline justify-between gap-3">
				<h3 className="font-bold text-lg">Ingredients</h3>
				{meal.changes?.length ? (
					<span className="font-mono text-sienna text-xs">
						{formatCount(meal.changes.length, "change")}
					</span>
				) : null}
			</div>
			<p className="mb-1 font-mono text-muted text-xs">Tap one to change it, for this meal only.</p>
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
								{formatPlannedAmount(line, servings, recipe.servings)}
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
			{footer}
		</>
	);
}
