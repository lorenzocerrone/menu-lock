import {
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter,
	retainSearchParams,
} from "@tanstack/react-router";
import { z } from "zod";
import { GroceryPage } from "./routes/grocery";
import { PlannerPage } from "./routes/planner";
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
	component: Shell,
	validateSearch: rootSearch,
	search: { middlewares: [retainSearchParams(["plan"])] },
});

const recipesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: RecipesPage,
});

const plannerRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/planner",
	component: PlannerPage,
});

const groceryRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/grocery",
	component: GroceryPage,
});

const routeTree = rootRoute.addChildren([recipesRoute, plannerRoute, groceryRoute]);

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
