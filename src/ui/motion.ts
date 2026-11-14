/** The one spring for things that move to a new place (cards, rows, the tab pill). */
export const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

/** The stamp of a grocery tick: lands hard, settles fast. */
export const stampSpring = { type: "spring", stiffness: 600, damping: 22 } as const;
