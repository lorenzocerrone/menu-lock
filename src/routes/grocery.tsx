import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { memo } from "react";
import { DATA } from "../dataset";
import {
	formatDay,
	formatExtra,
	formatLeft,
	formatLineQuantity,
	formatRange,
	formatResolvedFrom,
	formatSources,
	formatSummary,
	formatText,
} from "../lib/format";
import {
	arrange,
	type GroceryLine,
	isChecked,
	progress,
	RANGE_PRESETS,
	rangeEnd,
	sameRange,
} from "../lib/grocery";
import { day, entriesIn, isItem, plannedDates } from "../lib/plan";
import { store, useApp, useGrocery } from "../state/app";
import { groceryList } from "../state/store";
import { Chip } from "../ui/Chip";
import { ExtraInput } from "../ui/ExtraInput";
import { spring, stampSpring } from "../ui/motion";
import { PageTitle } from "../ui/PageTitle";
import { Roll } from "../ui/Roll";
import { Stamp } from "../ui/Stamp";
import { buttonPaper } from "../ui/styles";
import { copyText } from "../ui/toast";

/**
 * Things to buy that are in no recipe: one line to type them, and the list of
 * them, which also shows the extras that sit on a day of the plan.
 */
function Extras() {
	const plan = useApp((s) => s.plan);
	const today = useApp((s) => s.today);
	const addExtra = useApp((s) => s.addExtra);
	const removeExtra = useApp((s) => s.removeExtra);
	const removeMeal = useApp((s) => s.removeMeal);
	// The extras on a day that are to be bought, with where they are.
	const planned = plannedDates(plan).flatMap((date) =>
		day(plan, date).flatMap((meal, index) =>
			isItem(meal) && meal.buy ? [{ date, index, item: meal.item }] : [],
		),
	);
	const rows = [
		...plan.extras.map((item, index) => ({ item, when: null, remove: () => removeExtra(index) })),
		...planned.map(({ item, date, index }) => ({
			item,
			when: formatDay(date, today),
			remove: () => removeMeal(date, index),
		})),
	];

	return (
		<section className="mt-8">
			<h3 className="font-bold text-xl">Extras</h3>
			<p className="mt-1 mb-3 text-muted text-sm">
				Anything else to buy. They travel with the link.
			</p>
			<ExtraInput onAdd={addExtra} />
			{rows.length > 0 ? (
				<ul aria-label="Extras" className="mt-3">
					{rows.map(({ item, when, remove }, i) => {
						const { name, quantity } = formatExtra(item, DATA.dictionary);
						return (
							<li key={i} className="flex min-h-11 items-center gap-3 border-rule-soft border-b">
								<span className="min-w-0 flex-1 truncate">
									{name}
									{when ? <span className="font-mono text-muted text-xs"> · {when}</span> : null}
								</span>
								<span className="shrink-0 font-mono text-muted text-sm">{quantity}</span>
								<button
									type="button"
									aria-label={`Remove ${name}`}
									onClick={remove}
									className="-mr-2 flex size-11 shrink-0 items-center justify-center font-mono text-danger text-xl"
								>
									×
								</button>
							</li>
						);
					})}
				</ul>
			) : null}
		</section>
	);
}

/** One line of the receipt: tap anywhere on it to stamp it. Re-renders only when its own tick changes. */
const Row = memo(function Row({ line, on }: { line: GroceryLine; on: boolean }) {
	return (
		<motion.li layout transition={spring}>
			<button
				type="button"
				aria-pressed={on}
				onClick={() => {
					store.getState().toggleTick(line);
					// A tap you can feel; a longer one when it was the last line to buy.
					const { grocery } = store.getState();
					const done = !on && progress(groceryList(store.getState(), DATA), grocery).left === 0;
					navigator.vibrate?.(done ? [10, 50, 25] : 8);
				}}
				className={`flex min-h-11 w-full items-center gap-2.5 py-1 text-left ${on ? "text-faint" : ""}`}
			>
				<Stamp on={on} />
				<span className="min-w-0 flex-1">
					<span className="flex items-baseline">
						<span className="strike min-w-0 truncate font-sans text-base" data-on={on}>
							{line.name}
						</span>
						<span className="mx-1.5 min-w-3 flex-1 -translate-y-1 border-rule border-b-2 border-dotted" />
						<span className="shrink-0">{formatLineQuantity(line)}</span>
					</span>
					<span className="block truncate text-[0.65rem] text-muted">{formatSources(line)}</span>
				</span>
			</button>
		</motion.li>
	);
});

/** Everything the plan needs, as a till receipt to tick off in the shop. */
export function GroceryPage() {
	const plan = useApp((s) => s.plan);
	const grocery = useApp((s) => s.grocery);
	const today = useApp((s) => s.today);
	const setRange = useApp((s) => s.setRange);
	const { aisles, left, total } = useGrocery();

	const end = rangeEnd(grocery.range, plan, today);
	const range = formatRange(today, end, today);
	const meals = entriesIn(plan, today, end).length;

	return (
		<>
			<PageTitle caption={range}>Grocery</PageTitle>
			<div className="flex flex-wrap gap-2">
				{RANGE_PRESETS.map((preset) => (
					<Chip
						key={preset.label}
						label={preset.label}
						on={sameRange(grocery.range, preset.range)}
						onClick={() => setRange(preset.range)}
					/>
				))}
			</div>
			<p className="mt-3 mb-4 font-mono text-muted text-xs">
				{formatSummary(left, total, range, meals)}
			</p>

			{total === 0 ? (
				<div className="rounded-card border border-rule-soft bg-inset p-4 shadow-card">
					<p className="font-mono text-muted text-sm">0 to buy. Suspicious.</p>
					<Link to="/planner" className={`${buttonPaper} mt-3`}>
						Pin some meals
					</Link>
				</div>
			) : (
				<div className="receipt px-4 font-mono text-sm">
					<p className="text-center font-bold tracking-[0.3em]">MENU.LOCK</p>
					<p className="mt-1 text-center text-muted text-xs">{formatResolvedFrom(meals)}</p>
					{arrange(aisles, grocery).map((aisle) => (
						<section key={aisle.name} aria-label={aisle.name}>
							<h3 className="mt-4 border-rule border-t border-dashed pt-3 text-muted text-xs uppercase tracking-[0.2em]">
								{aisle.name}
							</h3>
							<ul>
								{aisle.lines.map((line) => (
									<Row key={line.key} line={line} on={isChecked(grocery, line.key)} />
								))}
							</ul>
						</section>
					))}
					<p className="mt-4 flex justify-between border-rule border-t border-dashed pt-3 font-bold">
						<span>LEFT TO BUY</span>
						<Roll>{formatLeft(left, total)}</Roll>
					</p>
					<div className="relative">
						<div className="receipt-barcode mt-4" />
						<AnimatePresence>
							{left === 0 ? (
								<motion.p
									initial={{ scale: 2.2, opacity: 0, rotate: -20 }}
									animate={{ scale: 1, opacity: 1, rotate: -7 }}
									exit={{ scale: 0.8, opacity: 0 }}
									transition={stampSpring}
									className="absolute inset-0 m-auto h-fit w-fit border-2 border-sienna bg-inset px-3 py-1 font-bold text-base text-sienna tracking-[0.25em]"
								>
									ALL BOUGHT
								</motion.p>
							) : null}
						</AnimatePresence>
					</div>
					<p className="mt-2 text-center text-[0.65rem] text-muted">
						thank you for cooking at home
					</p>
				</div>
			)}

			<Extras />

			<button
				type="button"
				onClick={() => copyText(formatText(aisles), "List copied")}
				className={`${buttonPaper} mt-8 w-full`}
			>
				Copy list
			</button>
		</>
	);
}
