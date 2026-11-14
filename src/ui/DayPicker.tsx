import type { IsoDate } from "../lib/dates";
import { planDays } from "../lib/dates";
import { formatCount, formatDay } from "../lib/format";
import { day, lastDate, type Plan } from "../lib/plan";
import { rowButton } from "./styles";

type Props = {
	plan: Plan;
	today: IsoDate;
	onPick: (date: IsoDate) => void;
	/** A day left out of the list (the day a meal is being moved from). */
	exclude?: IsoDate;
};

/** The rolling days with how many meals each already has; pick one. */
export function DayPicker({ plan, today, onPick, exclude }: Props) {
	return (
		<ul>
			{planDays(today, lastDate(plan))
				.filter((date) => date !== exclude)
				.map((date) => {
					const meals = day(plan, date).length;
					return (
						<li key={date}>
							<button type="button" onClick={() => onPick(date)} className={rowButton}>
								<span className={date === today ? "font-bold" : ""}>{formatDay(date, today)}</span>
								<span className="font-mono text-muted text-xs">
									{meals === 0 ? "—" : formatCount(meals, "meal")}
								</span>
							</button>
						</li>
					);
				})}
		</ul>
	);
}
