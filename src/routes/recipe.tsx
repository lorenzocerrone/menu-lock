import { getRouteApi, Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { DATA } from "../dataset";
import type { Recipe } from "../lib/data";
import { formatAddedTo, formatLineAmount, formatStepNumber, formatTiming } from "../lib/format";
import { useApp } from "../state/app";
import { DayPicker } from "../ui/DayPicker";
import { imageCrop, imageUrl } from "../ui/recipeImage";
import { Sheet } from "../ui/Sheet";
import { Stepper } from "../ui/Stepper";
import { buttonPaper, buttonPrimary } from "../ui/styles";
import { toast } from "../ui/toast";

const route = getRouteApi("/shell/recipe/$id");

function BackButton() {
	const router = useRouter();
	const canGoBack = useCanGoBack();
	// Going back keeps the list's search and filters; a recipe opened from a link has no "back".
	return canGoBack ? (
		<button type="button" onClick={() => router.history.back()} className={buttonPaper}>
			‹ Back
		</button>
	) : (
		<Link to="/" className={buttonPaper}>
			‹ Recipes
		</Link>
	);
}

function Steps({ steps }: { steps: readonly string[] }) {
	// Which steps are done: for this visit only.
	const [done, setDone] = useState<ReadonlySet<number>>(new Set());
	const flip = (i: number) =>
		setDone((current) => {
			const next = new Set(current);
			if (!next.delete(i)) next.add(i);
			return next;
		});
	return (
		<ol className="mt-2 space-y-2">
			{steps.map((step, i) => (
				<li key={i}>
					<button
						type="button"
						aria-pressed={done.has(i)}
						onClick={() => flip(i)}
						className={`flex w-full gap-3 rounded-card border border-rule-soft bg-inset p-3 text-left shadow-card ${done.has(i) ? "text-faint line-through" : ""}`}
					>
						<span className="font-bold font-mono text-sienna">{formatStepNumber(i)}</span>
						<span>{step}</span>
					</button>
				</li>
			))}
		</ol>
	);
}

function RecipeView({ recipe }: { recipe: Recipe }) {
	const plan = useApp((s) => s.plan);
	const today = useApp((s) => s.today);
	const addMeal = useApp((s) => s.addMeal);
	const [servings, setServings] = useState(recipe.servings);
	const [picking, setPicking] = useState(false);
	const facts = [recipe.cuisine, formatTiming(recipe)].filter(Boolean);

	return (
		<article className="pt-3 pb-24">
			<BackButton />
			<div className="mt-4 border border-rule-soft bg-inset p-2 pb-4 shadow-lift">
				<img src={imageUrl(recipe)} alt="" className={imageCrop} />
				<div className="px-2">
					<h2 className="mt-3 font-bold text-2xl leading-tight">{recipe.title}</h2>
					{recipe.description ? <p className="mt-2 text-muted">{recipe.description}</p> : null}
					{facts.length > 0 ? (
						<p className="mt-2 font-mono text-muted text-xs">{facts.join(" · ")}</p>
					) : null}
					{recipe.tags.length > 0 ? (
						<p className="mt-1 font-mono text-muted text-xs">{recipe.tags.join(" · ")}</p>
					) : null}
				</div>
			</div>

			<section className="mt-6">
				<div className="flex items-center justify-between gap-3">
					<h3 className="font-bold text-xl">Ingredients</h3>
					<Stepper value={servings} onChange={setServings} label="Servings" />
				</div>
				<ul
					aria-label="Ingredients"
					className="mt-3 rounded-card border border-rule-soft bg-inset px-3 shadow-card"
				>
					{recipe.lines.map((line, i) => (
						<li
							key={i}
							className="flex min-h-line items-baseline border-rule-soft border-b py-2 last:border-b-0"
						>
							<span className="min-w-0">
								{line.name}
								{line.note ? <span className="text-muted">, {line.note}</span> : null}
								{line.optional ? (
									<span className="font-mono text-muted text-xs"> (optional)</span>
								) : null}
							</span>
							<span className="mx-1.5 min-w-3 flex-1 -translate-y-1 border-rule border-b-2 border-dotted" />
							<span className="shrink-0 font-mono text-sm">
								{formatLineAmount(line, servings, recipe.servings)}
							</span>
						</li>
					))}
				</ul>
			</section>

			<section className="mt-6">
				<h3 className="font-bold text-xl">Steps</h3>
				<Steps steps={recipe.steps} />
			</section>

			<div
				data-fixed
				className="fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
			>
				<button
					type="button"
					onClick={() => setPicking(true)}
					className={`${buttonPrimary} mx-auto flex w-full max-w-md shadow-lift`}
				>
					Add to week
				</button>
			</div>

			<Sheet open={picking} onClose={() => setPicking(false)} title="Add to week">
				<DayPicker
					plan={plan}
					today={today}
					onPick={(date) => {
						addMeal(date, recipe.id);
						setPicking(false);
						toast(formatAddedTo(date, today));
					}}
				/>
			</Sheet>
		</article>
	);
}

/** A recipe to cook from: scale it, tick off the steps, add it to the week. */
export function RecipePage() {
	const { id } = route.useParams();
	const recipe = DATA.recipeById.get(id);
	if (!recipe) {
		return (
			<div className="pt-3">
				<h2 className="font-bold text-2xl">No such recipe</h2>
				<p className="mt-2 mb-4 font-mono text-muted text-sm">
					recipe "{id}": not found in menu.lock
				</p>
				<Link to="/" className={buttonPaper}>
					‹ All recipes
				</Link>
			</div>
		);
	}
	// Keyed, so servings and done steps reset when another recipe is opened.
	return <RecipeView key={recipe.id} recipe={recipe} />;
}
