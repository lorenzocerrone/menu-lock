import { PageTitle } from "./PageTitle";

/** A page with nothing on it yet: its title, and one dry mono line on a paper card. */
export function EmptyState({ title, line }: { title: string; line: string }) {
	return (
		<section>
			<PageTitle>{title}</PageTitle>
			<p className="rounded-card border border-rule-soft bg-inset p-4 font-mono text-muted text-sm shadow-card">
				{line}
			</p>
		</section>
	);
}
