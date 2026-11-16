import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { DATA } from "../dataset";
import { type IsoDate, planDays, WEEKDAY_SHORT, weekday, ymd } from "../lib/dates";
import {
	formatAddedTo,
	formatDate,
	formatDay,
	formatDayInline,
	formatExtra,
	formatMealDetails,
	formatMovedTo,
	formatPlanCaption,
	formatTotalTime,
	formatUnknownRecipe,
} from "../lib/format";
import { day, isEmpty, isItem, lastDate, type MealEntry, mealCount } from "../lib/plan";
import { useApp } from "../state/app";
import { DayPicker } from "../ui/DayPicker";
import { ExtraInput } from "../ui/ExtraInput";
import { ItemEditor } from "../ui/ItemEditor";
import { MealChanges } from "../ui/MealChanges";
import { PageTitle } from "../ui/PageTitle";
import { RecipePicker } from "../ui/RecipePicker";
import { Sheet } from "../ui/Sheet";
import { Stamp } from "../ui/Stamp";
import { Stepper } from "../ui/Stepper";
import { buttonDanger, buttonPaper, rowButton } from "../ui/styles";
import { copyText, toast } from "../ui/toast";
import { Underline } from "../ui/Underline";

/** A meal's place in the plan, and its id for dragging. */
type Place = { date: IsoDate; index: number };
const mealId = ({ date, index }: Place) => `${date}|${index}`;
const dayId = (date: IsoDate) => `day:${date}`;
function placeOf(id: string): Place | null {
	const [date, index] = id.split("|");
	return date && index !== undefined ? { date, index: Number(index) } : null;
}

const mealTitle = (entry: MealEntry) =>
	isItem(entry)
		? formatExtra(entry.item, DATA.dictionary).name
		: (DATA.recipeById.get(entry.recipe)?.title ?? formatUnknownRecipe(entry.recipe));

function MealLine({ entry, children }: { entry: MealEntry; children?: ReactNode }) {
	return (
		<>
			{/* A recipe is a filled dot; an extra is a ring. */}
			<span
				className={`size-1.5 shrink-0 rounded-full ${isItem(entry) ? "ring-[1.5px] ring-sienna" : "bg-sienna"}`}
			/>
			<span className="min-w-0 flex-1 truncate font-medium">{mealTitle(entry)}</span>
			{formatMealDetails(entry, DATA.dictionary).length > 0 ? (
				<span className="max-w-[55%] shrink-0 truncate font-mono text-muted text-xs">
					{formatMealDetails(entry, DATA.dictionary).join(" · ")}
				</span>
			) : null}
			{children}
		</>
	);
}

/** A meal on its ruled line: tap to open its sheet, or drag it by the handle. */
function Meal({ place, entry, onOpen }: { place: Place; entry: MealEntry; onOpen: () => void }) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: mealId(place) });
	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={`flex h-line items-center ${isDragging ? "opacity-30" : ""}`}
		>
			<button
				type="button"
				onClick={onOpen}
				className="flex h-full min-w-0 flex-1 items-center gap-2.5 text-left"
			>
				<MealLine entry={entry} />
			</button>
			<button
				type="button"
				ref={setActivatorNodeRef}
				{...attributes}
				{...listeners}
				aria-label={`Move ${mealTitle(entry)}`}
				className="-mr-2 flex h-full w-11 shrink-0 cursor-grab touch-none items-center justify-center font-mono text-muted"
			>
				⋮⋮
			</button>
		</div>
	);
}

type DayProps = {
	date: IsoDate;
	today: IsoDate;
	meals: readonly MealEntry[];
	onAdd: () => void;
	onExtra: () => void;
	onOpen: (index: number) => void;
};

/** One day: a notebook page when it is today or has meals, else a single ruled row. */
function Day({ date, today, meals, onAdd, onExtra, onOpen }: DayProps) {
	const { setNodeRef, isOver } = useDroppable({ id: dayId(date) });
	const isToday = date === today;
	const label = formatDay(date, today);
	const over = isOver ? "outline-2 outline-sienna outline-dashed outline-offset-2" : "";

	if (!isToday && meals.length === 0) {
		return (
			<button
				type="button"
				ref={setNodeRef}
				onClick={onAdd}
				aria-label={`Add a meal on ${formatDate(date)}`}
				className={`flex min-h-11 w-full items-center border-rule-soft border-b font-mono text-muted text-xs ${over}`}
			>
				<span className="w-16 shrink-0 text-center">
					{WEEKDAY_SHORT[weekday(date)]} {ymd(date)[2]}
				</span>
				<span className="flex-1 pl-3 text-left text-faint">—</span>
				<span className="px-3 text-base text-sienna">+</span>
			</button>
		);
	}
	return (
		<section
			ref={setNodeRef}
			aria-label={formatDate(date)}
			className={`flex overflow-hidden rounded-card border border-rule-soft bg-inset shadow-card ${over}`}
		>
			<div
				className={`plan-margin flex w-16 shrink-0 flex-col items-center justify-center py-3 ${isToday ? "bg-sienna text-on-sienna" : ""}`}
			>
				<span className="font-mono text-[0.65rem] uppercase tracking-widest">
					{WEEKDAY_SHORT[weekday(date)]}
				</span>
				<span className="font-bold font-mono text-2xl leading-none">{ymd(date)[2]}</span>
			</div>
			<div className="plan-lines min-w-0 flex-1 px-3">
				{label !== formatDate(date) ? (
					<p className="flex h-line items-center">
						<span className="font-bold">
							{label}
							<Underline className="-mt-1 block h-1.5 w-full text-sienna" />
						</span>
					</p>
				) : null}
				{meals.length === 0 ? (
					<p className="flex h-line items-center text-muted">Nothing pinned yet</p>
				) : null}
				<SortableContext
					items={meals.map((_, index) => mealId({ date, index }))}
					strategy={verticalListSortingStrategy}
				>
					<ul>
						<AnimatePresence initial={false} mode="popLayout">
							{meals.map((entry, index) => (
								// Meals have no identity of their own: the nth carbonara of the day is the key.
								<motion.li
									key={`${mealTitle(entry)}#${meals.slice(0, index).filter((m) => mealTitle(m) === mealTitle(entry)).length}`}
									initial={{ opacity: 0, x: -12 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: 12 }}
									transition={{ duration: 0.18, ease: "easeOut" }}
								>
									<Meal place={{ date, index }} entry={entry} onOpen={() => onOpen(index)} />
								</motion.li>
							))}
						</AnimatePresence>
					</ul>
				</SortableContext>
				<div className="flex h-line items-center gap-5 font-mono text-sienna text-xs">
					<button
						type="button"
						onClick={onAdd}
						aria-label={`Add a meal on ${formatDate(date)}`}
						className="flex h-full items-center"
					>
						+ add a meal
					</button>
					<button
						type="button"
						onClick={onExtra}
						aria-label={`Add an extra on ${formatDate(date)}`}
						className="flex h-full items-center"
					>
						+ add an extra
					</button>
				</div>
			</div>
		</section>
	);
}

/** The sheet of one meal: servings, order, another day, its recipe, remove. */
function MealSheet({
	place,
	onClose,
	onPlace,
}: {
	place: Place;
	onClose: () => void;
	onPlace: (p: Place) => void;
}) {
	const plan = useApp((s) => s.plan);
	const today = useApp((s) => s.today);
	const { setServings, reorderMeal, moveMeal, removeMeal, setItem, changeMeal, resetChange } =
		useApp((s) => s);
	const [moving, setMoving] = useState(false);
	const meals = day(plan, place.date);
	const entry = meals[place.index];
	if (!entry) return null;
	const recipe = isItem(entry) ? undefined : DATA.recipeById.get(entry.recipe);
	const step = (by: number) => {
		reorderMeal(place.date, place.index, place.index + by);
		onPlace({ date: place.date, index: place.index + by });
	};

	if (moving) {
		return (
			<Sheet open onClose={onClose} title="Move to…">
				<DayPicker
					plan={plan}
					today={today}
					exclude={place.date}
					onPick={(date) => {
						if (moveMeal(place.date, place.index, date) !== null) toast(formatMovedTo(date, today));
						onClose();
					}}
				/>
			</Sheet>
		);
	}

	/** What can be done with the meal as a whole: under everything there is to read. */
	const actions = (
		<div className="mt-5 border-rule-soft border-t">
			{recipe ? (
				<Link
					to="/recipe/$id"
					params={{ id: recipe.id }}
					// The recipe as this meal has it: its servings and its changes.
					search={(prev) => ({ ...prev, meal: `${place.date}.${place.index}` })}
					className={rowButton}
				>
					View recipe and steps <span className="font-mono text-muted">›</span>
				</Link>
			) : null}
			<button
				type="button"
				disabled={place.index === 0}
				onClick={() => step(-1)}
				className={rowButton}
			>
				Move up <span className="font-mono text-muted">↑</span>
			</button>
			<button
				type="button"
				disabled={place.index >= meals.length - 1}
				onClick={() => step(1)}
				className={rowButton}
			>
				Move down <span className="font-mono text-muted">↓</span>
			</button>
			<button type="button" onClick={() => setMoving(true)} className={rowButton}>
				Move to… <span className="font-mono text-muted">›</span>
			</button>
			<button
				type="button"
				onClick={() => {
					removeMeal(place.date, place.index);
					onClose();
				}}
				className={`${buttonDanger} mt-4 w-full`}
			>
				Remove
			</button>
		</div>
	);
	const when = formatDay(place.date, today);

	// A recipe: what it is, for how many, and its ingredients (each one tappable to change it).
	if (recipe && !isItem(entry)) {
		return (
			<Sheet open onClose={onClose} title={recipe.title}>
				<MealChanges
					recipe={recipe}
					meal={entry}
					onChange={(change) => changeMeal(place.date, place.index, change)}
					onReset={(key) => resetChange(place.date, place.index, key)}
					header={
						<>
							<p className="font-mono text-muted text-xs">
								{[when, formatTotalTime(recipe), recipe.cuisine].filter(Boolean).join(" · ")}
							</p>
							{recipe.description ? <p className="mt-2">{recipe.description}</p> : null}
							<div className="mt-3 flex min-h-14 items-center justify-between gap-3 border-rule-soft border-y">
								<span>Servings</span>
								<Stepper
									value={entry.servings ?? recipe.servings}
									onChange={(n) => setServings(place.date, place.index, n)}
									label="Servings"
								/>
							</div>
						</>
					}
					footer={actions}
				/>
			</Sheet>
		);
	}

	// An extra, or a recipe this build doesn't know.
	return (
		<Sheet open onClose={onClose} title={mealTitle(entry)}>
			<p className="font-mono text-muted text-xs">{when}</p>
			{isItem(entry) ? (
				<ItemEditor
					// A fresh form when the item changes (it was saved, or another one was opened).
					key={`${place.date}.${place.index}.${JSON.stringify(entry.item)}`}
					meal={entry}
					onChange={(change) => setItem(place.date, place.index, change)}
				/>
			) : null}
			{actions}
		</Sheet>
	);
}

/** The coming days and what is pinned on them. */
export function PlannerPage() {
	const plan = useApp((s) => s.plan);
	const today = useApp((s) => s.today);
	const { addMeal, addItem, moveMeal, reorderMeal, clearPlan } = useApp((s) => s);
	const [adding, setAdding] = useState<IsoDate | null>(null);
	// The day an extra is being added to, and whether it will go on the grocery list.
	const [extraFor, setExtraFor] = useState<IsoDate | null>(null);
	const [buyExtra, setBuyExtra] = useState(true);
	const openExtra = (date: IsoDate) => {
		setBuyExtra(true); // every extra starts on the grocery list
		setExtraFor(date);
	};
	const [open, setOpen] = useState<Place | null>(null);
	const [clearing, setClearing] = useState(false);
	const [dragging, setDragging] = useState<Place | null>(null);
	const days = planDays(today, lastDate(plan));

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const drop = ({ active, over }: DragEndEvent) => {
		setDragging(null);
		navigator.vibrate?.(10);
		const from = placeOf(String(active.id));
		if (!from || !over) return;
		const target = String(over.id);
		const onMeal = placeOf(target);
		const to = onMeal?.date ?? target.replace(/^day:/, "");
		if (to === from.date) {
			// Dropped on its own day: to that meal's position, or to the end.
			reorderMeal(from.date, from.index, onMeal?.index ?? day(plan, to).length - 1);
		} else if (moveMeal(from.date, from.index, to, onMeal?.index) !== null) {
			toast(formatMovedTo(to, today));
		}
	};
	const draggedEntry = dragging ? day(plan, dragging.date)[dragging.index] : undefined;

	return (
		<>
			<PageTitle caption={formatPlanCaption(mealCount(plan), days.length)}>Plan</PageTitle>
			<div className="mb-4 flex gap-2">
				<button
					type="button"
					onClick={() => copyText(window.location.href, "Link copied")}
					className={`${buttonPaper} flex-1`}
				>
					Share
				</button>
				<button
					type="button"
					disabled={isEmpty(plan)}
					onClick={() => setClearing(true)}
					className={`${buttonPaper} flex-1`}
				>
					Clear plan
				</button>
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={({ active }) => setDragging(placeOf(String(active.id)))}
				onDragEnd={drop}
				onDragCancel={() => setDragging(null)}
			>
				<ol className="space-y-2.5">
					{days.map((date) => (
						<li key={date}>
							{date !== today && weekday(date) === 0 ? (
								<p className="mt-6 mb-3 w-fit font-mono text-[0.65rem] text-sienna uppercase tracking-[0.2em]">
									next week
									<Underline className="block h-1.5 w-full" />
								</p>
							) : null}
							<Day
								date={date}
								today={today}
								meals={day(plan, date)}
								onAdd={() => setAdding(date)}
								onExtra={() => openExtra(date)}
								onOpen={(index) => setOpen({ date, index })}
							/>
						</li>
					))}
				</ol>
				<DragOverlay>
					{draggedEntry ? (
						<div className="flex h-line -rotate-1 scale-[1.03] items-center gap-2.5 rounded-card border border-rule-soft bg-inset px-3 shadow-lift">
							<MealLine entry={draggedEntry} />
						</div>
					) : null}
				</DragOverlay>
			</DndContext>

			<Sheet
				open={adding !== null}
				onClose={() => setAdding(null)}
				title={adding ? `Add to ${formatDay(adding, today)}` : "Add a meal"}
			>
				<RecipePicker
					recipes={DATA.recipes}
					onExtra={() => {
						// The same day, the other sheet.
						if (adding) openExtra(adding);
						setAdding(null);
					}}
					onPick={(recipe) => {
						if (!adding) return;
						addMeal(adding, recipe.id);
						toast(formatAddedTo(adding, today));
						setAdding(null);
					}}
				/>
			</Sheet>

			<Sheet
				open={extraFor !== null}
				onClose={() => setExtraFor(null)}
				title={extraFor ? `Extra for ${formatDayInline(extraFor, today)}` : "Add an extra"}
			>
				<p className="mb-3 text-muted">
					Anything that is not a recipe: an ingredient from the list, or whatever you type.
				</p>
				<ExtraInput
					autoFocus
					onAdd={(item) => {
						if (!extraFor) return;
						addItem(extraFor, item, buyExtra);
						toast(formatAddedTo(extraFor, today));
						setExtraFor(null);
					}}
				/>
				<button
					type="button"
					aria-pressed={buyExtra}
					onClick={() => setBuyExtra(!buyExtra)}
					className={`${rowButton} mt-4`}
				>
					On the grocery list
					<Stamp on={buyExtra} />
				</button>
				<p className="mt-2 font-mono text-muted text-xs">
					Switch it off for something you already have (leftovers): it stays on the plan only.
				</p>
			</Sheet>

			{open ? <MealSheet place={open} onClose={() => setOpen(null)} onPlace={setOpen} /> : null}

			<Sheet open={clearing} onClose={() => setClearing(false)} title="Clear plan">
				<p className="mb-3 text-muted">Both also untick the grocery list.</p>
				<div className="space-y-3">
					<button
						type="button"
						onClick={() => {
							clearPlan("meals");
							setClearing(false);
						}}
						className={`${buttonPaper} w-full`}
					>
						Meals only (keep the extras)
					</button>
					<button
						type="button"
						onClick={() => {
							clearPlan("everything");
							setClearing(false);
						}}
						className={`${buttonDanger} w-full`}
					>
						Everything
					</button>
				</div>
			</Sheet>
		</>
	);
}
