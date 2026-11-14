/** A dry, terminal-flavoured placeholder: a heading that says what the page is, and one mono line. */
export function EmptyState({ title, line }: { title: string; line: string }) {
	return (
		<section className="rounded-card border border-rule-soft bg-panel p-5">
			<h2 className="font-bold text-xl">{title}</h2>
			<p className="mt-2 font-mono text-muted text-sm">{line}</p>
		</section>
	);
}
