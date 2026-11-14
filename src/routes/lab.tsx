import { getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PREVIEW } from "../state/storage";
import { EmptyState } from "../ui/EmptyState";

/** The lab ships to development and pull-request previews, never to the live site. */
const ENABLED = import.meta.env.DEV || PREVIEW !== undefined || import.meta.env.VITE_LAB === "1";

const LabPage = lazy(() => import("../lab/LabPage"));
const route = getRouteApi("/shell/lab");

export function LabRoute() {
	const { s } = route.useSearch();
	const navigate = route.useNavigate();
	if (!ENABLED) return <EmptyState title="Lab" line="lab: not found in this build" />;
	return (
		<Suspense fallback={null}>
			<LabPage
				screen={s}
				setScreen={(next) => navigate({ search: (prev) => ({ ...prev, s: next }), replace: true })}
			/>
		</Suspense>
	);
}
