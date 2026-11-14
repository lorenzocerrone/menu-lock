/**
 * The one line for typing an extra ("milk 1 l"): on the grocery page, and for
 * an extra on a day of the plan. Ingredients from the list are suggested as you
 * type (typos forgiven); picking one adds it with the quantity if that converts
 * for it, and Enter adds what was typed as it is.
 */
import { type FormEvent, useState } from "react";
import { DATA } from "../dataset";
import { parseExtra, suggest, toExtra } from "../lib/extras";
import type { Extra } from "../lib/plan";
import { buttonPrimary, input } from "./styles";

export function ExtraInput({
	onAdd,
	autoFocus = false,
}: {
	onAdd: (extra: Extra) => void;
	autoFocus?: boolean;
}) {
	const [text, setText] = useState("");
	const parsed = parseExtra(text);
	const suggestions = suggest(DATA.dictionary, parsed.name, 5);

	const add = (key: string | null) => {
		if (parsed.name === "") return;
		onAdd(toExtra(parsed, key, DATA.dictionary));
		setText("");
	};
	const submit = (event: FormEvent) => {
		event.preventDefault();
		add(null);
	};

	return (
		<>
			<form onSubmit={submit} className="flex gap-2">
				<input
					value={text}
					onChange={(event) => setText(event.target.value)}
					placeholder="milk 1 l"
					aria-label="Add an extra"
					autoComplete="off"
					autoCapitalize="none"
					enterKeyHint="done"
					// biome-ignore lint/a11y/noAutofocus: the sheet was opened to type into this field
					autoFocus={autoFocus}
					className={input}
				/>
				<button type="submit" disabled={parsed.name === ""} className={`${buttonPrimary} shrink-0`}>
					Add
				</button>
			</form>
			{suggestions.length > 0 ? (
				<ul
					aria-label="Suggestions"
					className="mt-2 rounded-card border border-rule-soft bg-inset px-3 shadow-card"
				>
					{suggestions.map((s) => (
						<li key={s.key}>
							<button
								type="button"
								onClick={() => add(s.key)}
								className="flex min-h-11 w-full items-center justify-between gap-3 border-rule-soft border-b text-left last:border-b-0"
							>
								<span>{s.name}</span>
								<span className="font-mono text-muted text-xs">{s.aisle}</span>
							</button>
						</li>
					))}
				</ul>
			) : null}
		</>
	);
}
