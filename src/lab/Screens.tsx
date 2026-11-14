/**
 * The chosen design (direction B, "Receipt", with the notebook plan) as three
 * reference screens on the real recipes and a fixture plan. Phase 3 ports each
 * one into its route, wired to the store, and then deletes this folder.
 */
import { AnimatePresence, motion } from "motion/react";
import { WEEKDAY_SHORT, weekday, ymd } from "../lib/dates";
import {
	formatDate,
	formatDay,
	formatLineQuantity,
	formatServes,
	formatSources,
} from "../lib/format";
import { spring } from "../ui/motion";
import { PageTitle } from "../ui/PageTitle";
import { Stamp } from "../ui/Stamp";
import { Underline } from "../ui/Underline";
import { imageUrl, type LabModel } from "./model";
import { metaParts } from "./parts";

export function Recipes({ model }: { model: LabModel }) {
	return (
		<>
			<PageTitle caption={`${model.recipes.length} of ${model.total}`}>Recipes</PageTitle>
			<div className="">
				<input
					type="search"
					value={model.search}
					onChange={(e) => model.setSearch(e.target.value)}
					placeholder="Search recipes"
					aria-label="Search recipes"
					className="h-11 w-full rounded-card border border-rule-soft bg-inset px-3 text-base placeholder:text-faint focus:outline-none focus-visible:border-sienna"
				/>
				<div className="mt-3 flex flex-wrap gap-2">
					{model.chips.map((chip) => (
						<button
							key={chip.label}
							type="button"
							aria-pressed={chip.on}
							onClick={chip.toggle}
							className={`h-9 rounded-card border border-dashed px-3 font-mono text-xs ${
								chip.on
									? "border-sienna border-solid bg-sienna text-on-sienna"
									: "border-rule text-muted"
							} ${chip.count === 0 ? "opacity-40" : ""}`}
						>
							{chip.label} {chip.count}
						</button>
					))}
				</div>
			</div>
			<ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-7 wide:grid-cols-3">
				<AnimatePresence mode="popLayout" initial={false}>
					{model.recipes.map((recipe, i) => (
						<motion.li
							key={recipe.id}
							layout
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0, rotate: i % 2 === 0 ? -0.8 : 0.7 }}
							exit={{ opacity: 0, scale: 0.9 }}
							transition={spring}
							className="relative border border-rule-soft bg-inset p-2 pb-3 shadow-lift"
						>
							<span className="tape -top-2 left-1/2 -translate-x-1/2 -rotate-2" />
							<img
								src={imageUrl(recipe)}
								alt=""
								loading="lazy"
								className="aspect-[8/3] w-full object-cover object-top"
							/>
							<h3 className="mt-2 font-bold text-sm leading-tight">{recipe.title}</h3>
							<p className="mt-1 flex flex-wrap gap-x-2 font-mono text-[0.68rem] text-muted">
								{metaParts(recipe).map((part) => (
									<span key={part} className="whitespace-nowrap">
										{part}
									</span>
								))}
							</p>
						</motion.li>
					))}
				</AnimatePresence>
			</ul>
		</>
	);
}

export function Planner({ model }: { model: LabModel }) {
	return (
		<>
			<PageTitle caption={`${model.meals} meals · ${model.days.length} days`}>Plan</PageTitle>
			<ol className="space-y-2.5">
				{model.days.map((d) => {
					const isToday = d.date === model.today;
					const card = isToday || d.meals.length > 0;
					const label = formatDay(d.date, model.today);
					return (
						<li key={d.date}>
							{d.startsWeek ? (
								<p className="mt-6 mb-3 w-fit font-mono text-[0.65rem] text-sienna uppercase tracking-[0.2em]">
									next week
									<Underline className="block h-1.5 w-full" />
								</p>
							) : null}
							{card ? (
								// A page torn from the notebook: the date in the margin, meals on the ruled lines.
								<div className="flex overflow-hidden rounded-card border border-rule-soft bg-inset shadow-card">
									<div
										className={`plan-margin flex w-16 shrink-0 flex-col items-center justify-center py-3 ${isToday ? "bg-sienna text-on-sienna" : ""}`}
									>
										<span className="font-mono text-[0.65rem] uppercase tracking-widest">
											{WEEKDAY_SHORT[weekday(d.date)]}
										</span>
										<span className="font-bold font-mono text-2xl leading-none">
											{ymd(d.date)[2]}
										</span>
									</div>
									<div className="plan-lines min-w-0 flex-1 px-3">
										{label !== formatDate(d.date) ? (
											<p className="flex h-line items-center">
												<span className="font-bold">
													{label}
													<Underline className="-mt-1 block h-1.5 w-full text-sienna" />
												</span>
											</p>
										) : null}
										{d.meals.length === 0 ? (
											<p className="flex h-line items-center text-faint">Nothing pinned yet</p>
										) : (
											d.meals.map(({ entry, recipe }, i) => (
												<p key={i} className="flex h-line items-center gap-2.5">
													<span className="size-1.5 shrink-0 rounded-full bg-sienna" />
													<span className="min-w-0 flex-1 truncate font-medium">
														{recipe?.title ?? entry.recipe}
													</span>
													{entry.servings ? (
														<span className="shrink-0 font-mono text-muted text-xs">
															{formatServes(entry.servings)}
														</span>
													) : null}
												</p>
											))
										)}
										<p className="flex h-line items-center font-mono text-sienna text-xs">
											+ add a meal
										</p>
									</div>
								</div>
							) : (
								<div className="flex min-h-11 items-center border-rule-soft border-b font-mono text-muted text-xs">
									<span className="w-16 shrink-0 text-center">
										{WEEKDAY_SHORT[weekday(d.date)]} {ymd(d.date)[2]}
									</span>
									<span className="flex-1 pl-3 text-faint">—</span>
									<span className="px-3 text-base text-sienna">+</span>
								</div>
							)}
						</li>
					);
				})}
			</ol>
		</>
	);
}

export function Grocery({ model }: { model: LabModel }) {
	return (
		<>
			<PageTitle caption={model.range}>Grocery</PageTitle>
			<div className="">
				<div className="receipt px-4 font-mono text-sm">
					<p className="text-center font-bold tracking-[0.3em]">MENU.LOCK</p>
					<p className="mt-1 text-center text-muted text-xs">resolved from {model.meals} meals</p>
					{model.aisles.map((aisle) => (
						<section key={aisle.name}>
							<h3 className="mt-4 border-rule border-t border-dashed pt-3 text-muted text-xs uppercase tracking-[0.2em]">
								{aisle.name}
							</h3>
							<ul>
								{aisle.lines.map((line) => {
									const on = model.isTicked(line.key);
									return (
										<motion.li key={line.key} layout transition={spring}>
											<button
												type="button"
												aria-pressed={on}
												onClick={() => model.tick(line)}
												className={`flex min-h-11 w-full items-center gap-2.5 py-1 text-left ${on ? "text-faint" : ""}`}
											>
												<Stamp on={on} />
												<span className="min-w-0 flex-1">
													<span className="flex items-baseline">
														<span
															className={`shrink-0 font-sans text-base ${on ? "line-through" : ""}`}
														>
															{line.name}
														</span>
														<span className="mx-1.5 min-w-3 flex-1 -translate-y-1 border-rule border-b-2 border-dotted" />
														<span className="shrink-0">{formatLineQuantity(line)}</span>
													</span>
													<span className="block truncate text-[0.65rem] text-faint">
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
						<span>
							{model.left} / {model.lines}
						</span>
					</p>
					<div className="receipt-barcode mt-4" />
					<p className="mt-2 text-center text-[0.65rem] text-muted">
						thank you for cooking at home
					</p>
				</div>
			</div>
		</>
	);
}
