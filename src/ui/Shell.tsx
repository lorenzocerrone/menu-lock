import { Link, Outlet } from "@tanstack/react-router";
import { PREVIEW } from "../state/storage";

const TABS = [
	{ to: "/", label: "Recipes" },
	{ to: "/planner", label: "Plan" },
	{ to: "/grocery", label: "Grocery" },
] as const;

/** The app frame: wordmark, the three tabs (bottom bar on phones, top bar from 720px), the page. */
export function Shell() {
	return (
		<div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
			<header className="flex items-baseline gap-3 px-4 pt-5 pb-3">
				<h1 className="font-bold font-mono text-lg tracking-tight">
					menu<span className="text-sienna">.lock</span>
				</h1>
				{PREVIEW ? <span className="font-mono text-muted text-xs">preview · {PREVIEW}</span> : null}
			</header>

			<nav
				aria-label="Sections"
				className="fixed inset-x-0 bottom-0 z-10 flex border-rule-soft border-t bg-panel pb-[env(safe-area-inset-bottom)] wide:static wide:mx-4 wide:rounded-card wide:border wide:pb-0"
			>
				{TABS.map((tab) => (
					<Link
						key={tab.to}
						to={tab.to}
						activeOptions={{ exact: true }}
						className="flex min-h-14 flex-1 items-center justify-center font-mono text-muted text-sm wide:min-h-11"
						activeProps={{ className: "text-sienna font-bold", "aria-current": "page" }}
					>
						{tab.label}
					</Link>
				))}
			</nav>

			<main className="flex-1 px-4 pt-4 pb-24 wide:pb-8">
				<Outlet />
			</main>
		</div>
	);
}
