/** The heading of a page: its name, and a mono caption on the right ("8 meals · 14 days"). */
export function PageTitle({ children, caption }: { children: string; caption?: string }) {
	return (
		<header className="flex items-end justify-between gap-3 pt-4 pb-4">
			<h2 className="font-bold text-3xl">{children}</h2>
			{caption ? <p className="pb-1 text-right font-mono text-muted text-xs">{caption}</p> : null}
		</header>
	);
}
