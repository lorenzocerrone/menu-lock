import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/space-mono/latin-400.css";
import "@fontsource/space-mono/latin-700.css";
import "./styles/base.css";

import { registerSW } from "virtual:pwa-register";
import { RouterProvider } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./router";
import { store } from "./state/app";
import { startUrlSync } from "./state/urlSync";

startUrlSync(router, store);

// Offline after the first visit; a new version installs itself and reloads the page.
// (The plan is in the address and in storage, so a reload loses nothing.)
registerSW({ immediate: true });

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");

createRoot(root).render(
	<StrictMode>
		{/* Every animation honours the system's reduced-motion setting. */}
		<MotionConfig reducedMotion="user">
			<RouterProvider router={router} />
		</MotionConfig>
	</StrictMode>,
);
