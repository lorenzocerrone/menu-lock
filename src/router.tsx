import {
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter,
	retainSearchParams,
} from "@tanstack/react-router";
import { z } from "zod";
import { GroceryPage } from "./routes/grocery";
import { LabRoute } from "./routes/lab";
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
	validateSearch: rootSearch,
	search: { middlewares: [retainSearchParams(["plan"])] },
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

/** The reference screens of the chosen design; `s` is the screen. Remove with src/lab/. */
const labRoute = createRoute({
	getParentRoute: () => shellRoute,
	path: "/lab",
	component: LabRoute,
	validateSearch: z.object({
		s: z.enum(["recipes", "planner", "grocery"]).catch("recipes"),
	}),
});

const routeTree = rootRoute.addChildren([
	shellRoute.addChildren([recipesRoute, plannerRoute, groceryRoute, labRoute]),
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
