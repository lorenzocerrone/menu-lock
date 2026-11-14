import { defineConfig, devices } from "@playwright/test";

// Flows run against the production build, served by `vite preview`.
export default defineConfig({
	testDir: "tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL: "http://localhost:4173",
		trace: "off",
	},
	projects: [
		{ name: "phone", use: { ...devices["Pixel 7"] } },
		{
			name: "desktop",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
		},
	],
	webServer: {
		command: "VITE_LAB=1 npm run build && npm run preview",
		url: "http://localhost:4173",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
