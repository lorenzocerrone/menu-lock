import { create } from "zustand";

type ToastState = { message: string | null; id: number };

/** The one toast on screen (a new one replaces it). */
export const useToast = create<ToastState>(() => ({ message: null, id: 0 }));

let timer: ReturnType<typeof setTimeout> | undefined;

/** Confirm something that just happened: "Link copied", "Added to tomorrow". */
export function toast(message: string): void {
	clearTimeout(timer);
	useToast.setState((s) => ({ message, id: s.id + 1 }));
	timer = setTimeout(() => useToast.setState({ message: null }), 2600);
}

/** Copy text to the clipboard, then confirm with `message`. */
export async function copyText(text: string, message: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		toast(message);
	} catch {
		toast("Couldn't copy");
	}
}
