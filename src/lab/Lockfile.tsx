/**
 * Direction C — Lockfile. The same paper, on a dotted grid, with the lockfile
 * motif turned up: the plan reads like a file with a line-number gutter, the
 * grocery list like resolved output with [x] boxes, and mono does most of the
 * talking. Here to calibrate how much "terminal" is too much.
 */
import { AnimatePresence, motion } from "motion/react";
import { formatDay, formatLineQuantity, formatServes, formatSources } from "../lib/format";
import { imageUrl, type LabModel, SCREENS } from "./model";
import { type DirectionProps, metaParts, Strike, spring } from "./parts";

function Title({ children, caption }: { children: string; caption: string }) {
	return (
		<header className="px-4 pt-7 pb-4">
			<h2 className="font-bold font-mono text-2xl">
				<span className="text-sienna"># </span>
				{children}
			</h2>
			<p className="mt-1 font-mono text-muted text-xs">{caption}</p>
		</header>
	);
}

function Recipes({ model }: { model: LabModel }) {
	return (
		<>
			<Title caption={`${model.recipes.length} of ${model.total} resolved`}>recipes</Title>
			<div className="px-4">
				<label className="flex h-11 items-center gap-2 rounded-card border border-rule bg-panel px-3 font-mono focus-within:border-sienna">
					<span className="text-sienna">&gt;</span>
					<input
						type="search"
						value={model.search}
						onChange={(e) => model.setSearch(e.target.value)}
						placeholder="search"
						aria-label="Search recipes"
						className="min-w-0 flex-1 bg-transparent text-base placeholder:text-faint focus:outline-none"
					/>
				</label>
				<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
					{model.chips.map((chip) => (
						<button
							key={chip.label}
							type="button"
							aria-pressed={chip.on}
							onClick={chip.toggle}
							className={`h-9 ${chip.on ? "font-bold text-sienna" : "text-muted"} ${chip.count === 0 ? "opacity-40" : ""}`}
						>
							[{chip.on ? "x" : " "}] {chip.label} ({chip.count})
						</button>
					))}
				</div>
			</div>
			<ul className="mx-4 mt-4 divide-y divide-rule-soft rounded-card border border-rule-soft bg-panel">
				<AnimatePresence initial={false}>
					{model.recipes.map((recipe) => (
						<motion.li
							key={recipe.id}
							layout
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							transition={{ duration: 0.18 }}
							className="overflow-hidden"
						>
							<div className="flex items-center gap-3 p-2.5">
								<img
									src={imageUrl(recipe)}
									alt=""
									loading="lazy"
									className="h-14 w-20 shrink-0 rounded-[3px] object-cover"
								/>
								<div className="min-w-0">
									<h3 className="truncate font-medium">{recipe.title}</h3>
									<p className="truncate font-mono text-[0.7rem] text-muted">
										{metaParts(recipe).join(" · ").toLowerCase()}
									</p>
									<p className="truncate font-mono text-[0.7rem] text-faint">
										{recipe.tags.map((t) => `#${t}`).join(" ")}
									</p>
								</div>
							</div>
						</motion.li>
					))}
				</AnimatePresence>
			</ul>
		</>
	);
}

function Planner({ model }: { model: LabModel }) {
	let n = 0;
	const gutter = () => (
		<span className="w-9 shrink-0 select-none pr-2 text-right text-faint">{++n}</span>
	);
	return (
		<>
			<Title caption="the plan is a lockfile: this address is the plan">plan</Title>
			<div className="mx-4 overflow-hidden rounded-card border border-rule bg-panel font-mono text-sm">
				<p className="flex justify-between border-rule border-b bg-inset px-3 py-2 text-xs">
					<span className="font-bold">menu.lock</span>
					<span className="text-muted">
						{model.days.length} days · {model.meals} pinned
					</span>
				</p>
				<ol className="py-2 leading-7">
					{model.days.map((d) => (
						<li key={d.date}>
							{d.startsWeek ? (
								<p className="flex text-faint">
									{gutter()}
									<span># next week</span>
								</p>
							) : null}
							<p className="flex">
								{gutter()}
								<span className={d.meals.length > 0 ? "font-bold" : "text-muted"}>{d.date}</span>
								{d.date === model.today || d.meals.length > 0 ? (
									<span className="ml-2 text-faint">
										# {formatDay(d.date, model.today).toLowerCase()}
									</span>
								) : null}
							</p>
							{d.meals.map(({ entry, recipe }, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: a day may hold the same recipe twice
								<p key={i} className="flex items-baseline pr-3">
									{gutter()}
									<span className="mr-2 text-sienna">└</span>
									<span className="truncate font-sans text-base">
										{recipe?.title ?? entry.recipe}
									</span>
									{entry.servings ? (
										<span className="ml-2 shrink-0 text-muted text-xs">
											{formatServes(entry.servings)}
										</span>
									) : null}
								</p>
							))}
						</li>
					))}
				</ol>
			</div>
		</>
	);
}

function Grocery({ model }: { model: LabModel }) {
	return (
		<>
			<Title caption={model.summary}>grocery</Title>
			<div className="mx-4 rounded-card border border-rule bg-panel px-3 py-3 font-mono text-sm">
				<p className="text-muted">
					<span className="text-sienna">$</span> menu.lock resolve
				</p>
				{model.aisles.map((aisle) => (
					<section key={aisle.name}>
						<h3 className="mt-3 text-faint"># {aisle.name}</h3>
						<ul>
							{aisle.lines.map((line) => {
								const on = model.isTicked(line.key);
								return (
									<motion.li key={line.key} layout transition={spring}>
										<button
											type="button"
											aria-pressed={on}
											onClick={() => model.tick(line)}
											className={`flex min-h-11 w-full items-center gap-2 text-left ${on ? "text-faint" : ""}`}
										>
											<span className={on ? "text-sienna" : "text-muted"}>[{on ? "x" : " "}]</span>
											<span className="min-w-0 flex-1">
												<span className="relative inline-block font-sans text-base">
													{line.name}
													<Strike on={on} />
												</span>
												<span className="block truncate text-[0.65rem] text-faint">
													{formatSources(line)}
												</span>
											</span>
											<span className="shrink-0">{formatLineQuantity(line)}</span>
										</button>
									</motion.li>
								);
							})}
						</ul>
					</section>
				))}
				<p className="mt-3 border-rule-soft border-t pt-3 text-muted">
					{model.left === 0
						? "0 to buy. Suspicious."
						: `${model.left} of ${model.lines} left to buy`}
				</p>
			</div>
		</>
	);
}

export function Lockfile({ model, screen, setScreen }: DirectionProps) {
	return (
		<div className="lab-grid min-h-dvh bg-paper pb-24 text-ink">
			<div className="mx-auto max-w-3xl">
				{screen === "recipes" ? <Recipes model={model} /> : null}
				{screen === "planner" ? <Planner model={model} /> : null}
				{screen === "grocery" ? <Grocery model={model} /> : null}
			</div>
			<nav
				aria-label="Sections"
				className="fixed inset-x-0 bottom-0 z-10 border-rule border-t bg-panel pb-[env(safe-area-inset-bottom)] font-mono text-sm"
			>
				<div className="mx-auto flex max-w-3xl divide-x divide-rule-soft">
					{SCREENS.map((s) => (
						<button
							key={s.id}
							type="button"
							aria-current={screen === s.id ? "page" : undefined}
							onClick={() => setScreen(s.id)}
							className={`flex min-h-14 flex-1 items-center justify-center lowercase ${screen === s.id ? "bg-ink text-paper" : "text-muted"}`}
						>
							{s.label}
							{s.id === "grocery" ? (
								<span className="ml-1.5 text-xs opacity-80">[{model.left}]</span>
							) : null}
						</button>
					))}
				</div>
			</nav>
		</div>
	);
}
