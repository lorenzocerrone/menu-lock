/**
 * Direction B — Receipt. Things are paper objects: recipes are taped index
 * cards, planned days are ticket stubs, and the grocery list is a till receipt
 * with torn ends, dotted leaders and a stamp for each tick.
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
import { imageUrl, type LabModel, SCREENS } from "./model";
import { type DirectionProps, metaParts, spring, Underline } from "./parts";

function Title({ children, caption }: { children: string; caption: string }) {
	return (
		<header className="flex items-end justify-between gap-3 px-4 pt-7 pb-4">
			<h2 className="font-bold text-3xl">{children}</h2>
			<p className="pb-1 text-right font-mono text-muted text-xs">{caption}</p>
		</header>
	);
}

function Recipes({ model }: { model: LabModel }) {
	return (
		<>
			<Title caption={`${model.recipes.length} of ${model.total}`}>Recipes</Title>
			<div className="px-4">
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
			<ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-7 px-4 wide:grid-cols-3">
				<AnimatePresence mode="popLayout" initial={false}>
					{model.recipes.map((recipe, i) => (
						<motion.li
							key={recipe.id}
							layout
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0, rotate: i % 2 === 0 ? -0.8 : 0.7 }}
							exit={{ opacity: 0, scale: 0.9 }}
							transition={spring}
							className="relative border border-rule-soft bg-inset p-2 pb-3 shadow-[0_2px_0_var(--rule-soft),0_8px_14px_-8px_var(--rule)]"
						>
							<span className="lab-tape -top-2 left-1/2 -translate-x-1/2 -rotate-2" />
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

function Planner({ model }: { model: LabModel }) {
	return (
		<>
			<Title caption={`${model.meals} meals · ${model.days.length} days`}>Plan</Title>
			<ol className="space-y-2.5 px-4">
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
								<div className="flex overflow-hidden rounded-card border border-rule-soft bg-inset shadow-[0_2px_0_var(--rule-soft)]">
									<div
										className={`lab-plan-margin flex w-16 shrink-0 flex-col items-center justify-center py-3 ${isToday ? "bg-sienna text-on-sienna" : ""}`}
									>
										<span className="font-mono text-[0.65rem] uppercase tracking-widest">
											{WEEKDAY_SHORT[weekday(d.date)]}
										</span>
										<span className="font-bold font-mono text-2xl leading-none">
											{ymd(d.date)[2]}
										</span>
									</div>
									<div className="lab-plan-lines min-w-0 flex-1 px-3">
										{label !== formatDate(d.date) ? (
											<p className="flex h-[var(--line)] items-center">
												<span className="font-bold">
													{label}
													<Underline className="-mt-1 block h-1.5 w-full text-sienna" />
												</span>
											</p>
										) : null}
										{d.meals.length === 0 ? (
											<p className="flex h-[var(--line)] items-center text-faint">
												Nothing pinned yet
											</p>
										) : (
											d.meals.map(({ entry, recipe }, i) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: a day may hold the same recipe twice
												<p key={i} className="flex h-[var(--line)] items-center gap-2.5">
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
										<p className="flex h-[var(--line)] items-center font-mono text-sienna text-xs">
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

function Stamp({ on }: { on: boolean }) {
	return (
		<span className="flex size-6 shrink-0 items-center justify-center border border-rule font-bold font-mono text-sienna text-sm">
			<AnimatePresence initial={false}>
				{on ? (
					<motion.span
						key="x"
						initial={{ scale: 2.4, opacity: 0, rotate: -25 }}
						animate={{ scale: 1, opacity: 1, rotate: -8 }}
						exit={{ scale: 0.6, opacity: 0 }}
						transition={{ type: "spring", stiffness: 600, damping: 22 }}
					>
						✓
					</motion.span>
				) : null}
			</AnimatePresence>
		</span>
	);
}

function Grocery({ model }: { model: LabModel }) {
	return (
		<>
			<Title caption={model.range}>Grocery</Title>
			<div className="px-4">
				<div className="lab-receipt px-4 font-mono text-sm">
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
					<div className="lab-barcode mt-4" />
					<p className="mt-2 text-center text-[0.65rem] text-muted">
						thank you for cooking at home
					</p>
				</div>
			</div>
		</>
	);
}

export function Receipt({ model, screen, setScreen }: DirectionProps) {
	return (
		<div className="lab-grain min-h-dvh bg-paper pb-28 text-ink">
			<div className="mx-auto max-w-3xl">
				{screen === "recipes" ? <Recipes model={model} /> : null}
				{screen === "planner" ? <Planner model={model} /> : null}
				{screen === "grocery" ? <Grocery model={model} /> : null}
			</div>
			<nav
				aria-label="Sections"
				className="fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
			>
				<div className="mx-auto flex max-w-md rounded-card border border-rule-soft bg-inset p-1 shadow-[0_2px_0_var(--rule-soft),0_10px_20px_-10px_var(--rule)]">
					{SCREENS.map((s) => (
						<button
							key={s.id}
							type="button"
							aria-current={screen === s.id ? "page" : undefined}
							onClick={() => setScreen(s.id)}
							className={`relative flex min-h-11 flex-1 items-center justify-center font-mono text-sm ${screen === s.id ? "text-on-sienna" : "text-muted"}`}
						>
							{screen === s.id ? (
								<motion.span
									layoutId="receipt-tab"
									transition={spring}
									className="absolute inset-0 rounded-[4px] bg-sienna"
								/>
							) : null}
							<span className="relative">
								{s.label}
								{s.id === "grocery" ? (
									<span className="ml-1.5 text-xs opacity-80">{model.left}</span>
								) : null}
							</span>
						</button>
					))}
				</div>
			</nav>
		</div>
	);
}
