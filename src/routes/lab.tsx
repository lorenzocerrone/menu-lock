import { getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { DirectionId } from "../lab/LabPage";
import type { Screen } from "../lab/model";
import { PREVIEW } from "../state/storage";
import { EmptyState } from "../ui/EmptyState";

/** The lab ships to development and pull-request previews, never to the live site. */
const ENABLED = import.meta.env.DEV || PREVIEW !== undefined || import.meta.env.VITE_LAB === "1";

const LabPage = lazy(() => import("../lab/LabPage"));
const route = getRouteApi("/lab");

export function LabRoute() {
	const { d, s } = route.useSearch();
	const navigate = route.useNavigate();
	if (!ENABLED) {
		return (
			<div className="p-4">
				<EmptyState title="Lab" line="lab: not found in this build" />
			</div>
		);
	}
	return (
		<Suspense fallback={null}>
			<LabPage
				direction={d}
				screen={s}
				setDirection={(next: DirectionId) =>
					navigate({ search: (prev) => ({ ...prev, d: next }), replace: true })
				}
				setScreen={(next: Screen) =>
					navigate({ search: (prev) => ({ ...prev, s: next }), replace: true })
				}
			/>
		</Suspense>
	);
}
