import { Link } from "@tanstack/react-router";
import { buttonPaper } from "../ui/styles";

/** An address that is no page of the app (a mistyped or old link). */
export function NotFoundPage() {
	return (
		<div className="pt-3">
			<h2 className="font-bold text-2xl">No such page</h2>
			<p className="mt-2 mb-4 font-mono text-muted text-sm">
				this address is not a page of menu.lock
			</p>
			<Link to="/" className={buttonPaper}>
				‹ All recipes
			</Link>
		</div>
	);
}
