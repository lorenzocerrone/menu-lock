import type { ReactNode } from "react";
import { Drawer } from "vaul";

type Props = {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	/** Pinned under the scrolling content: the sheet's main actions. */
	footer?: ReactNode;
};

/**
 * A sheet of paper over the page: a bottom sheet on phones (drag down to
 * dismiss), a centred dialog from 720px. Closes on the backdrop, Esc and its
 * close button.
 */
export function Sheet({ open, onClose, title, children, footer }: Props) {
	return (
		<Drawer.Root open={open} onOpenChange={(next) => !next && onClose()}>
			<Drawer.Portal>
				<Drawer.Overlay className="fixed inset-0 z-40 bg-scrim" />
				<Drawer.Content
					aria-describedby={undefined}
					// From 720px the content covers the screen to centre the panel; a click beside the panel closes.
					onClick={(event) => event.target === event.currentTarget && onClose()}
					className="fixed inset-x-0 bottom-0 z-40 flex max-h-[90dvh] flex-col outline-none wide:inset-0 wide:max-h-none wide:items-center wide:justify-center"
				>
					<div className="flex max-h-[90dvh] w-full flex-col rounded-t-[14px] border border-rule-soft bg-panel text-ink shadow-lift wide:max-h-[80dvh] wide:max-w-md wide:rounded-card">
						<div className="shrink-0 pt-2 wide:hidden">
							<Drawer.Handle />
						</div>
						<header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-2">
							<Drawer.Title className="font-bold text-xl">{title}</Drawer.Title>
							<Drawer.Close
								aria-label="Close"
								className="flex size-11 items-center justify-center font-mono text-2xl text-muted"
							>
								×
							</Drawer.Close>
						</header>
						<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
						{footer ? (
							<footer className="flex shrink-0 gap-3 border-rule-soft border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
								{footer}
							</footer>
						) : null}
					</div>
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	);
}
