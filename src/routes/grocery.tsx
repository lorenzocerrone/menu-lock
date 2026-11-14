import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { type FormEvent, useState } from "react";
import { DATA } from "../dataset";
import { parseExtra, suggest, toExtra } from "../lib/extras";
import {
	formatExtra,
	formatLeft,
	formatLineQuantity,
	formatRange,
	formatResolvedFrom,
	formatSources,
	formatSummary,
	formatText,
} from "../lib/format";
import { arrange, isChecked, RANGE_PRESETS, rangeEnd, sameRange } from "../lib/grocery";
import { entriesIn } from "../lib/plan";
import { useApp, useGrocery } from "../state/app";
import { Chip } from "../ui/Chip";
import { spring } from "../ui/motion";
import { PageTitle } from "../ui/PageTitle";
import { Stamp } from "../ui/Stamp";
import { buttonPaper, buttonPrimary, input } from "../ui/styles";
import { copyText } from "../ui/toast";

/** Things to buy that are in no recipe: one line to type them, and the list of them. */
function Extras() {
	const extras = useApp((s) => s.plan.extras);
	const addExtra = useApp((s) => s.addExtra);
	const removeExtra = useApp((s) => s.removeExtra);
	const [text, setText] = useState("");
	const parsed = parseExtra(text);
	const suggestions = suggest(DATA.dictionary, parsed.name, 5);

	const add = (key: string | null) => {
		if (parsed.name === "") return;
		addExtra(toExtra(parsed, key, DATA.dictionary));
		setText("");
	};
	const submit = (event: FormEvent) => {
		event.preventDefault();
		add(null);
	};

	return (
		<section className="mt-8">
			<h3 className="font-bold text-xl">Extras</h3>
			<p className="mt-1 text-muted text-sm">Anything else to buy. They travel with the link.</p>
			<form onSubmit={submit} className="mt-3 flex gap-2">
				<input
					value={text}
					onChange={(event) => setText(event.target.value)}
					placeholder="milk 1 l"
					aria-label="Add an extra"
					autoComplete="off"
					enterKeyHint="done"
					className={input}
				/>
				<button type="submit" disabled={parsed.name === ""} className={`${buttonPrimary} shrink-0`}>
					Add
				</button>
			</form>
			{suggestions.length > 0 ? (
				<ul
					aria-label="Suggestions"
					className="mt-2 rounded-card border border-rule-soft bg-inset px-3 shadow-card"
				>
					{suggestions.map((s) => (
						<li key={s.key}>
							<button
								type="button"
								onClick={() => add(s.key)}
								className="flex min-h-11 w-full items-center justify-between gap-3 border-rule-soft border-b text-left last:border-b-0"
							>
								<span>{s.name}</span>
								<span className="font-mono text-muted text-xs">{s.aisle}</span>
							</button>
						</li>
					))}
				</ul>
			) : null}
			{extras.length > 0 ? (
				<ul aria-label="Extras" className="mt-3">
					{extras.map((extra, i) => {
						const { name, quantity } = formatExtra(extra, DATA.dictionary);
						return (
							<li key={i} className="flex min-h-11 items-center gap-3 border-rule-soft border-b">
								<span className="min-w-0 flex-1 truncate">{name}</span>
								<span className="shrink-0 font-mono text-muted text-sm">{quantity}</span>
								<button
									type="button"
									aria-label={`Remove ${name}`}
									onClick={() => removeExtra(i)}
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

/** Everything the plan needs, as a till receipt to tick off in the shop. */
export function GroceryPage() {
	const plan = useApp((s) => s.plan);
	const grocery = useApp((s) => s.grocery);
	const today = useApp((s) => s.today);
	const toggleTick = useApp((s) => s.toggleTick);
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
								{aisle.lines.map((line) => {
									const on = isChecked(grocery, line.key);
									return (
										<motion.li key={line.key} layout transition={spring}>
											<button
												type="button"
												aria-pressed={on}
												onClick={() => {
													toggleTick(line);
													navigator.vibrate?.(8);
												}}
												className={`flex min-h-11 w-full items-center gap-2.5 py-1 text-left ${on ? "text-faint" : ""}`}
											>
												<Stamp on={on} />
												<span className="min-w-0 flex-1">
													<span className="flex items-baseline">
														<span
															className={`min-w-0 truncate font-sans text-base ${on ? "line-through" : ""}`}
														>
															{line.name}
														</span>
														<span className="mx-1.5 min-w-3 flex-1 -translate-y-1 border-rule border-b-2 border-dotted" />
														<span className="shrink-0">{formatLineQuantity(line)}</span>
													</span>
													<span className="block truncate text-[0.65rem] text-muted">
														{formatSources(line)}
													</span>
												</span>
											</button>
										</motion.li>
									);
								})}
							</ul>
						</section>
					))}
					<p className="mt-4 flex justify-between border-rule border-t border-dashed pt-3 font-bold">
						<span>LEFT TO BUY</span>
						<span>{formatLeft(left, total)}</span>
					</p>
					<div className="receipt-barcode mt-4" />
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
