import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { motion } from "motion/react";
import { PREVIEW } from "../state/storage";
import { spring } from "./motion";

const TABS = [
	{ to: "/", label: "Recipes" },
	{ to: "/planner", label: "Plan" },
	{ to: "/grocery", label: "Grocery" },
] as const;

/**
 * The app frame: grainy paper, the wordmark, and the three tabs as a paper
 * strip with a sienna pill on the current one. The strip floats at the bottom
 * on phones and sits at the top from 720px.
 */
export function Shell() {
	const { pathname } = useLocation();
	return (
		<div className="paper-grain min-h-dvh bg-paper text-ink">
			<div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4">
				<header className="flex items-baseline gap-3 pt-4">
					<h1 className="font-bold font-mono text-sm tracking-tight">
						menu<span className="text-sienna">.lock</span>
					</h1>
					{PREVIEW ? (
						<span className="font-mono text-muted text-xs">preview · {PREVIEW}</span>
					) : null}
				</header>

				<nav
					aria-label="Sections"
					className="fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] wide:static wide:mt-3 wide:px-0 wide:pb-0"
				>
					<div className="mx-auto flex max-w-md rounded-card border border-rule-soft bg-inset p-1 shadow-lift wide:mx-0 wide:shadow-card">
						{TABS.map((tab) => {
							const current = pathname === tab.to;
							return (
								<Link
									key={tab.to}
									to={tab.to}
									aria-current={current ? "page" : undefined}
									className={`relative flex min-h-11 flex-1 items-center justify-center font-mono text-sm ${current ? "text-on-sienna" : "text-muted"}`}
								>
									{current ? (
										<motion.span
											layoutId="tab-pill"
											transition={spring}
											className="absolute inset-0 rounded-[4px] bg-sienna"
										/>
									) : null}
									<span className="relative">{tab.label}</span>
								</Link>
							);
						})}
					</div>
				</nav>

				<main className="flex-1 pt-2 pb-28 wide:pb-10">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
