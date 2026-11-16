import {
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter,
	retainSearchParams,
} from "@tanstack/react-router";
import { z } from "zod";
import { type QuerySearch, queryFromSearch, queryToSearch } from "./lib/filters";
import { GroceryPage } from "./routes/grocery";
import { NotFoundPage } from "./routes/notFound";
import { PlannerPage } from "./routes/planner";
import { RecipePage } from "./routes/recipe";
import { RecipesPage } from "./routes/recipes";
import { Shell } from "./ui/Shell";

/**
 * `plan` is the lockfile: the whole meal plan, base64url, carried on every
 * route (REWRITE_PLAN §5.4). Anything that isn't a string reads as "no plan".
 */
const rootSearch = z.object({
	plan: z.string().optional().catch(undefined),
});

const rootRoute = createRootRoute({
	validateSearch: rootSearch,
	search: { middlewares: [retainSearchParams(["plan"])] },
	// An address that is no page: still the app, with its tabs and a way back.
	notFoundComponent: () => (
		<Shell>
			<NotFoundPage />
		</Shell>
	),
});

/** The app frame (wordmark and tabs) around the three pages. */
const shellRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "shell",
	component: Shell,
});

const recipesRoute = createRoute({
	getParentRoute: () => shellRoute,
	path: "/",
	component: RecipesPage,
	// The recipe search and filters (q, diet, by, cuisine, tag, time), cleaned of anything unreadable.
	validateSearch: (search: Record<string, unknown>): QuerySearch =>
		queryToSearch(queryFromSearch(search)),
});

const recipeRoute = createRoute({
	getParentRoute: () => shellRoute,
	path: "/recipe/$id",
	component: RecipePage,
	// `meal` ("2026-11-16.0": a day and a position) opens the recipe as that planned meal has it.
	validateSearch: z.object({
		meal: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}\.\d+$/)
			.optional()
			.catch(undefined),
	}),
});

const plannerRoute = createRoute({
	getParentRoute: () => shellRoute,
	path: "/planner",
	component: PlannerPage,
});

const groceryRoute = createRoute({
	getParentRoute: () => shellRoute,
	path: "/grocery",
	component: GroceryPage,
});

const routeTree = rootRoute.addChildren([
	shellRoute.addChildren([recipesRoute, recipeRoute, plannerRoute, groceryRoute]),
]);

export const router = createRouter({
	routeTree,
	// Hash routing: URLs look like /menu-lock/#/planner?plan=…, so GitHub Pages
	// needs no 404 fallback and links never depend on the base path.
	history: createHashHistory(),
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
