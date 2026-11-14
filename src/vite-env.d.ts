interface ImportMetaEnv {
	/** Set in pull-request preview builds, e.g. "pr-12". */
	readonly VITE_PREVIEW?: string;
	/** "1" includes the phase 1 design lab (#/lab) in a build that is not a preview. */
	readonly VITE_LAB?: string;
}
