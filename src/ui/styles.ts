/** Class names shared by the app's buttons and inputs (see the design rules). */

const base =
	"inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-4 font-mono text-sm disabled:opacity-40";

/** The main action of a screen or sheet. */
export const buttonPrimary = `${base} bg-sienna font-bold text-on-sienna`;
/** Any other action: a paper button. */
export const buttonPaper = `${base} border border-rule-soft bg-inset text-ink shadow-card`;
/** An action that removes something. */
export const buttonDanger = `${base} border border-rule-soft bg-inset text-danger shadow-card`;
/** A row in a sheet that does something when tapped. */
export const rowButton =
	"flex min-h-12 w-full items-center justify-between gap-3 border-rule-soft border-b text-left disabled:opacity-40";
/** A text field on paper. */
export const input =
	"h-11 w-full rounded-card border border-rule-soft bg-inset px-3 text-base placeholder:text-faint focus:outline-none focus-visible:border-sienna";
