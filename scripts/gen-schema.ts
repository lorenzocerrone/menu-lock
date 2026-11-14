/**
 * Write the JSON Schemas for the data files into schema/, from the Zod schemas
 * in src/lib/schema.ts. Editors use them for autocomplete and inline errors
 * (.vscode/settings.json). Run after changing schema.ts: `npm run schema`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { jsonSchemas } from "../src/lib/schema";

mkdirSync("schema", { recursive: true });
for (const [file, schema] of Object.entries(jsonSchemas())) {
	writeFileSync(`schema/${file}`, `${JSON.stringify(schema, null, 2)}\n`);
	console.log(`schema/${file}`);
}
