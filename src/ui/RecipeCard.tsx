import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import type { Recipe } from "../lib/data";
import { formatRecipeMeta } from "../lib/format";
import { spring } from "./motion";
import { imageCrop, imageUrl } from "./recipeImage";

/** A recipe as a taped index card, tilted a little; the whole card opens the recipe. */
export function RecipeCard({ recipe, index }: { recipe: Recipe; index: number }) {
	return (
		<motion.li
			layout
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.8 : 0.7 }}
			exit={{ opacity: 0, scale: 0.9 }}
			transition={spring}
			className="relative border border-rule-soft bg-inset shadow-lift"
		>
			<span className="tape -top-2 left-1/2 -translate-x-1/2 -rotate-2" />
			<Link
				to="/recipe/$id"
				params={{ id: recipe.id }}
				// The list's filters stay in the address behind it; the recipe page needs none of them.
				search={(prev) => (prev.plan ? { plan: prev.plan } : {})}
				className="block p-2 pb-3"
			>
				<img src={imageUrl(recipe)} alt="" loading="lazy" className={imageCrop} />
				<h3 className="mt-2 font-bold text-sm leading-tight">{recipe.title}</h3>
				<p className="mt-1 flex flex-wrap gap-x-2 font-mono text-[0.68rem] text-muted">
					{formatRecipeMeta(recipe).map((part) => (
						<span key={part} className="whitespace-nowrap">
							{part}
						</span>
					))}
				</p>
				{recipe.tags.length > 0 ? (
					<p className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[0.68rem] text-muted">
						{recipe.tags.map((tag) => (
							<span key={tag} className="whitespace-nowrap">
								{tag}
							</span>
						))}
					</p>
				) : null}
			</Link>
		</motion.li>
	);
}
