/**
 * Calendar dates as ISO `YYYY-MM-DD` strings (REWRITE_PLAN §5.6). They sort and
 * compare as plain strings. "Today" is never read here: the UI passes it in.
 */

/** A valid `YYYY-MM-DD` date. Compare with `<`, `===`. */
export type IsoDate = string;

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const MONTH_SHORT = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

const DAY_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** Days since 1970-01-01. Only call with a valid date. */
function dayNumber(date: IsoDate): number {
	const [y, m, d] = ymd(date);
	// Built in a leap year, then moved: Date.UTC reads years 0–99 as 1900–1999.
	const utc = new Date(Date.UTC(2000, m - 1, d));
	utc.setUTCFullYear(y);
	return Math.round(utc.getTime() / DAY_MS);
}

function fromDayNumber(n: number): IsoDate {
	const d = new Date(n * DAY_MS);
	return fromYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function fromYmd(year: number, month: number, day: number): IsoDate {
	return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** `[year, month (1–12), day]`. */
export function ymd(date: IsoDate): [number, number, number] {
	const m = ISO.exec(date);
	if (!m) throw new Error(`not an ISO date: ${date}`);
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isIsoDate(s: string): s is IsoDate {
	const m = ISO.exec(s);
	if (!m) return false;
	const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (month < 1 || month > 12 || day < 1) return false;
	// Built in a leap year, then moved: Date.UTC reads years 0–99 as 1900–1999.
	const d = new Date(Date.UTC(2000, month - 1, day));
	d.setUTCFullYear(year);
	return d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** The date moved by `days` (negative goes back). */
export function addDays(date: IsoDate, days: number): IsoDate {
	return fromDayNumber(dayNumber(date) + days);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysUntil(from: IsoDate, to: IsoDate): number {
	return dayNumber(to) - dayNumber(from);
}

/** Day of the week, Monday = 0 … Sunday = 6. */
export function weekday(date: IsoDate): number {
	// 1970-01-01 was a Thursday (3).
	return (((dayNumber(date) + 3) % 7) + 7) % 7;
}

/**
 * The local calendar date of a JS Date. The UI calls this with `new Date()` to
 * get "today"; nothing in src/lib reads the clock itself.
 */
export function localIsoDate(now: Date): IsoDate {
	return fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * The days the planner shows: 14 from today, or through the last planned day
 * if that is later.
 */
export function planDays(today: IsoDate, lastPlanned: IsoDate | null): IsoDate[] {
	const span = Math.max(14, lastPlanned ? daysUntil(today, lastPlanned) + 1 : 0);
	return Array.from({ length: span }, (_, i) => addDays(today, i));
}
