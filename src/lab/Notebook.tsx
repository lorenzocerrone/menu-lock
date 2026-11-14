/**
 * Direction A — Notebook. Ruled paper with a sienna margin line; dates sit in
 * the margin; headings and ticks are drawn by hand. The lockfile shows only as
 * a small mono caption.
 */
import { AnimatePresence, motion } from "motion/react";
import { WEEKDAY_SHORT, weekday, ymd } from "../lib/dates";
import { formatDay, formatLineQuantity, formatServes, formatSources } from "../lib/format";
import { imageUrl, type LabModel, SCREENS } from "./model";
import { type DirectionProps, HandTick, metaParts, Strike, spring, Underline } from "./parts";

function Title({ children, caption }: { children: string; caption: string }) {
	return (
		<header className="px-5 pt-7 pb-4">
			<p className="font-mono text-muted text-xs">{caption}</p>
			<h2 className="mt-1 inline-block font-bold text-3xl">
				{children}
				<Underline className="-mt-0.5 block h-2 w-full text-sienna" />
			</h2>
		</header>
	);
}

function Recipes({ model }: { model: LabModel }) {
	return (
		<>
			<Title caption={`menu.lock · ${model.recipes.length} of ${model.total} recipes`}>
				Recipes
			</Title>
			<div className="px-5">
				<input
					type="search"
					value={model.search}
					onChange={(e) => model.setSearch(e.target.value)}
					placeholder="Search recipes"
					aria-label="Search recipes"
					className="h-11 w-full border-rule border-b bg-transparent text-base placeholder:text-faint focus:outline-none focus-visible:border-sienna"
				/>
				<div className="mt-3 flex flex-wrap gap-2">
					{model.chips.map((chip) => (
						<button
							key={chip.label}
							type="button"
							aria-pressed={chip.on}
							onClick={chip.toggle}
							className={`h-9 rounded-full border px-3 font-mono text-xs ${
								chip.on ? "border-sienna bg-sienna text-on-sienna" : "border-rule text-muted"
							} ${chip.count === 0 ? "opacity-40" : ""}`}
						>
							{chip.label} · {chip.count}
						</button>
					))}
				</div>
			</div>
			<ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 px-5 wide:grid-cols-3">
				<AnimatePresence mode="popLayout" initial={false}>
					{model.recipes.map((recipe) => (
						<motion.li
							key={recipe.id}
							layout
							initial={{ opacity: 0, scale: 0.94 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.94 }}
							transition={spring}
						>
							<img
								src={imageUrl(recipe)}
								alt=""
								loading="lazy"
								className="aspect-[8/3] w-full rounded-card border border-rule-soft object-cover object-top"
							/>
							<h3 className="mt-2 font-medium leading-tight">{recipe.title}</h3>
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
			<Title caption={`menu.lock · ${model.days.length} days · ${model.meals} meals pinned`}>
				Plan
			</Title>
			<ol className="lab-ruled lab-margin pb-2 leading-[var(--line)]">
				{model.days.map((d) => {
					const isToday = d.date === model.today;
					return (
						<li key={d.date}>
							{d.startsWeek ? (
								<p className="pl-[5rem] font-mono text-[0.65rem] text-sienna uppercase tracking-[0.2em]">
									next week
								</p>
							) : null}
							<div className="grid grid-cols-[4.25rem_1fr]">
								<p
									className={`pr-2.5 text-right font-mono text-xs leading-[var(--line)] ${isToday ? "font-bold text-sienna" : "text-muted"}`}
								>
									{WEEKDAY_SHORT[weekday(d.date)]} {ymd(d.date)[2]}
								</p>
								<div className="pr-5 pl-3">
									{d.meals.length === 0 ? (
										<p className="text-faint">{isToday ? "Nothing yet today" : "—"}</p>
									) : (
										<>
											{isToday || d.date === model.days[1]?.date ? (
												<p className="font-bold">{formatDay(d.date, model.today)}</p>
											) : null}
											{d.meals.map(({ entry, recipe }, i) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: a day may hold the same recipe twice
												<p key={i} className="flex items-baseline gap-2">
													<span className="size-1.5 shrink-0 -translate-y-0.5 rounded-full bg-sienna" />
													<span className="truncate">{recipe?.title ?? entry.recipe}</span>
													{entry.servings ? (
														<span className="shrink-0 font-mono text-muted text-xs">
															{formatServes(entry.servings)}
														</span>
													) : null}
												</p>
											))}
										</>
									)}
								</div>
							</div>
						</li>
					);
				})}
			</ol>
		</>
	);
}

function Grocery({ model }: { model: LabModel }) {
	return (
		<>
			<Title caption={model.summary}>Grocery</Title>
			<div className="px-5">
				{model.aisles.map((aisle) => (
					<section key={aisle.name} className="mb-6">
						<h3 className="inline-block font-bold text-lg">
							{aisle.name}
							<Underline className="-mt-1 block h-1.5 w-full text-faint" />
						</h3>
						<ul className="mt-1">
							{aisle.lines.map((line) => {
								const on = model.isTicked(line.key);
								return (
									<motion.li key={line.key} layout transition={spring}>
										<button
											type="button"
											aria-pressed={on}
											onClick={() => model.tick(line)}
											className="flex min-h-12 w-full items-center gap-3 border-rule-soft border-b py-1.5 text-left"
										>
											<HandTick on={on} />
											<span className={`min-w-0 flex-1 ${on ? "text-faint" : ""}`}>
												<span className="relative inline-block">
													{line.name}
													<Strike on={on} />
												</span>
												<span className="block truncate text-faint text-xs">
													{formatSources(line)}
												</span>
											</span>
											<span className={`shrink-0 font-mono text-sm ${on ? "text-faint" : ""}`}>
												{formatLineQuantity(line)}
											</span>
										</button>
									</motion.li>
								);
							})}
						</ul>
					</section>
				))}
			</div>
		</>
	);
}

export function Notebook({ model, screen, setScreen }: DirectionProps) {
	return (
		<div className="lab-grain min-h-dvh bg-paper pb-24 text-ink">
			<div className="mx-auto max-w-3xl">
				{screen === "recipes" ? <Recipes model={model} /> : null}
				{screen === "planner" ? <Planner model={model} /> : null}
				{screen === "grocery" ? <Grocery model={model} /> : null}
			</div>
			<nav
				aria-label="Sections"
				className="fixed inset-x-0 bottom-0 z-10 border-rule-soft border-t bg-panel pb-[env(safe-area-inset-bottom)]"
			>
				<div className="mx-auto flex max-w-3xl">
					{SCREENS.map((s) => (
						<button
							key={s.id}
							type="button"
							aria-current={screen === s.id ? "page" : undefined}
							onClick={() => setScreen(s.id)}
							className={`flex min-h-14 flex-1 flex-col items-center justify-center ${screen === s.id ? "font-bold text-ink" : "text-muted"}`}
						>
							<span className="relative">
								{s.label}
								{s.id === "grocery" ? (
									<span className="ml-1.5 font-mono text-sienna text-xs">{model.left}</span>
								) : null}
								{screen === s.id ? (
									<motion.span
										layoutId="notebook-tab"
										className="absolute inset-x-0 -bottom-1.5 block"
									>
										<Underline className="block h-1.5 w-full text-sienna" />
									</motion.span>
								) : null}
							</span>
						</button>
					))}
				</div>
			</nav>
		</div>
	);
}
