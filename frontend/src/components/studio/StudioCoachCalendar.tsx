"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  emitTimetableChanged,
  TIMETABLE_CHANGED_EVENT,
  timetableDeleteSlot,
  timetableGetMe,
  type GetTokenFn,
  type TimetableSlot,
} from "@/lib/timetableApi";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_COUNT = END_HOUR - START_HOUR;

/** Category tints — aligned with app chrome (sc-*) + distinct exam / lecture / lab hues */
const SLOT_STYLES = [
  "border-violet-400/50 bg-violet-950/55 text-sc-mist shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "border-blue-500/45 bg-blue-950/40 text-sc-mist shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "border-sc-gold/35 bg-amber-950/35 text-amber-50/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
] as const;

export type CalendarViewMode = "month" | "week" | "day";

function slotVisualClass(title: string): (typeof SLOT_STYLES)[number] {
  const t = title.toLowerCase();
  if (/\b(exam|test|quiz|midterm|final|control)\b/.test(t)) return SLOT_STYLES[0];
  if (/\b(lab|laboratory|practical|workshop|studio)\b/.test(t)) return SLOT_STYLES[2];
  return SLOT_STYLES[1];
}

function isExamSlot(title: string): boolean {
  const t = title.toLowerCase();
  return /\b(exam|test|quiz|midterm|final|control)\b/.test(t);
}

function examSubtitle(title: string): string {
  const t = title.toLowerCase();
  if (/\boral\b/.test(t)) return "Oral exam";
  if (/\bproject\b/.test(t)) return "Final project";
  if (/\bquiz\b/.test(t)) return "Quiz";
  return "Written exam";
}

function formatDayHeader(d: Date): string {
  const day = d.toLocaleDateString(undefined, { weekday: "long" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${day} ${dd}.${mm}`;
}

function formatExamWhen(d: Date, startTime: string): string {
  const short = d.toLocaleDateString(undefined, { weekday: "short" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${short}, ${dd}.${mm} ${startTime.slice(0, 5)}`;
}

/** API weekday: Mon=0 … Sun=6 */
export function apiWeekdayFromDate(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const js = x.getDay();
  const delta = js === 0 ? -6 : 1 - js;
  x.setDate(x.getDate() + delta);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function parseHm(t: string): number {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function slotPosition(slot: TimetableSlot): { top: number; height: number } {
  const startMin = parseHm(slot.start_time);
  const endMin = parseHm(slot.end_time);
  const windowStart = START_HOUR * 60;
  const windowEnd = END_HOUR * 60;
  const windowLen = windowEnd - windowStart;
  const s = Math.max(startMin, windowStart);
  const e = Math.min(endMin, windowEnd);
  if (e <= s) return { top: 0, height: 0 };
  return {
    top: ((s - windowStart) / windowLen) * 100,
    height: Math.max(((e - s) / windowLen) * 100, 3),
  };
}

function monthGrid(anchor: Date): { date: Date; inMonth: boolean }[][] {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const first = new Date(y, m, 1);
  const start = startOfWeekMonday(first);
  const rows: { date: Date; inMonth: boolean }[][] = [];
  const cur = new Date(start);
  for (let r = 0; r < 6; r++) {
    const row: { date: Date; inMonth: boolean }[] = [];
    for (let c = 0; c < 7; c++) {
      row.push({
        date: new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()),
        inMonth: cur.getMonth() === m,
      });
      cur.setDate(cur.getDate() + 1);
    }
    rows.push(row);
  }
  return rows;
}

type Props = { getToken?: GetTokenFn };

function ViewModeTabs({
  view,
  setView,
}: {
  view: CalendarViewMode;
  setView: (v: CalendarViewMode) => void;
}) {
  const tabs: { id: CalendarViewMode; label: string }[] = [
    { id: "month", label: "Month" },
    { id: "week", label: "Week" },
    { id: "day", label: "Day" },
  ];
  return (
    <div className="flex rounded-lg border border-sc-line/50 p-0.5">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setView(id)}
          className={`min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-[0.62rem] font-bold uppercase tracking-wide transition sm:px-2 ${
            view === id ? "bg-sc-gold/20 text-sc-gold shadow-sm" : "text-[#7a8a80] hover:text-sc-mist"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function StudioCoachCalendar({ getToken }: Props) {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<CalendarViewMode>("week");
  const [cursorDate, setCursorDate] = useState(() => new Date());

  const refresh = useCallback(async () => {
    try {
      setErr(null);
      const me = await timetableGetMe(getToken);
      setSlots(me.slots);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Calendar unavailable");
      setSlots([]);
    }
  }, [getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(TIMETABLE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(TIMETABLE_CHANGED_EVENT, onChange);
  }, [refresh]);

  const removeSlot = useCallback(
    async (id: string) => {
      try {
        await timetableDeleteSlot(id, getToken);
        emitTimetableChanged();
        await refresh();
      } catch {
        setErr("Could not remove slot");
      }
    },
    [getToken, refresh],
  );

  const byDay = useMemo(() => {
    const m: TimetableSlot[][] = Array.from({ length: 7 }, () => []);
    for (const s of slots) {
      if (s.weekday >= 0 && s.weekday <= 6) m[s.weekday]!.push(s);
    }
    for (const arr of m) arr.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return m;
  }, [slots]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) out.push(h);
    return out;
  }, []);

  const weekStart = useMemo(() => startOfWeekMonday(cursorDate), [cursorDate]);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const monthCells = useMemo(() => monthGrid(cursorDate), [cursorDate]);

  const dailySlots = useMemo(() => byDay[apiWeekdayFromDate(cursorDate)] ?? [], [byDay, cursorDate]);

  const goToday = () => setCursorDate(new Date());

  return (
    <aside className="flex max-h-[min(48dvh,520px)] min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden border-t border-sc-line bg-sc-bg xl:max-h-full xl:max-w-[min(520px,50%)] xl:self-stretch xl:border-l xl:border-t-0 sm:min-w-0">
      <div className="shrink-0 space-y-2 border-b border-sc-line/80 px-2 py-2 sm:px-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-[family-name:var(--font-syne)] text-[0.7rem] font-bold uppercase tracking-wide text-sc-gold sm:text-xs">
            Calendar
          </p>
          <button
            type="button"
            onClick={goToday}
            className="shrink-0 rounded-md border border-sc-line/60 px-2 py-0.5 text-[0.6rem] font-semibold text-sc-mist hover:border-sc-gold/40 hover:text-sc-gold"
          >
            Today
          </button>
        </div>
        <ViewModeTabs view={view} setView={setView} />
        <p className="text-[0.62rem] leading-snug text-[#6a756d]">
          <Link href="/studio/timetable" className="text-sc-gold/90 hover:underline">
            Import timetable
          </Link>
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {err && <p className="shrink-0 px-2 py-1.5 text-[0.65rem] text-amber-400/90">{err}</p>}

        {view === "month" && (
          <MonthView
            cursorDate={cursorDate}
            setCursorDate={setCursorDate}
            monthCells={monthCells}
            byDay={byDay}
            removeSlot={removeSlot}
          />
        )}

        {view === "week" && (
          <WeekDashboardView
            weekStart={weekDates[0]!}
            weekDates={weekDates}
            slots={slots}
            byDay={byDay}
            hours={hours}
            cursorDate={cursorDate}
            setCursorDate={setCursorDate}
            removeSlot={removeSlot}
          />
        )}

        {view === "day" && (
          <DayTimeGridView
            cursorDate={cursorDate}
            setCursorDate={setCursorDate}
            slots={dailySlots}
            hours={hours}
            removeSlot={removeSlot}
          />
        )}

        {view !== "week" && (
          <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-t border-sc-line/50 px-2 py-1.5 text-[0.52rem] text-[#5c6b62]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-violet-500/70" /> Exam
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-blue-500/70" /> Lecture
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-sc-gold/80" /> Lab
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavArrows({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-1 border-b border-sc-line/40 px-1 py-1.5 sm:px-2">
      <button
        type="button"
        onClick={onPrev}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sc-line/50 text-sc-mist hover:border-sc-gold/40 hover:text-sc-gold"
        aria-label="Previous"
      >
        ‹
      </button>
      <span className="min-w-0 flex-1 truncate text-center text-[0.65rem] font-semibold text-sc-mist sm:text-[0.7rem]">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sc-line/50 text-sc-mist hover:border-sc-gold/40 hover:text-sc-gold"
        aria-label="Next"
      >
        ›
      </button>
    </div>
  );
}

function MonthView({
  cursorDate,
  setCursorDate,
  monthCells,
  byDay,
  removeSlot,
}: {
  cursorDate: Date;
  setCursorDate: (d: Date) => void;
  monthCells: { date: Date; inMonth: boolean }[][];
  byDay: TimetableSlot[][];
  removeSlot: (id: string) => void;
}) {
  const label = cursorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const prev = () => setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() - 1, 1));
  const next = () => setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 1));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <NavArrows label={label} onPrev={prev} onNext={next} />
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-px overflow-auto bg-sc-line/20 p-0.5 [grid-template-rows:auto_repeat(6,minmax(2.75rem,1fr))]">
        {DAY_SHORT.map((d) => (
          <div
            key={d}
            className="bg-[#0b0e14] py-1 text-center text-[0.55rem] font-bold uppercase tracking-wide text-[#6a756d]"
          >
            {d}
          </div>
        ))}
        {monthCells.flatMap((row, ri) =>
          row.map(({ date, inMonth }, ci) => {
            const wd = apiWeekdayFromDate(date);
            const daySlots = byDay[wd] ?? [];
            const isToday = sameMonth(date, new Date()) && date.toDateString() === new Date().toDateString();
            return (
              <button
                key={`${ri}-${ci}`}
                type="button"
                onClick={() => {
                  setCursorDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
                }}
                className={`flex h-full min-h-0 min-w-0 flex-col items-start border border-transparent bg-sc-bg/50 p-0.5 text-left transition hover:border-sc-gold/25 hover:bg-sc-bg/80 ${
                  inMonth ? "" : "opacity-40"
                } ${isToday ? "ring-1 ring-sc-gold/50" : ""}`}
              >
                <span className={`text-[0.65rem] font-bold ${inMonth ? "text-sc-mist" : "text-[#5c6b62]"}`}>
                  {date.getDate()}
                </span>
                <div className="mt-0.5 flex w-full min-w-0 flex-col gap-0.5">
                  {daySlots.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className={`w-full truncate rounded px-0.5 text-[0.5rem] font-medium leading-tight sm:text-[0.55rem] ${slotVisualClass(s.title)}`}
                      title={`${s.start_time} ${s.title}`}
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeSlot(s.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            void removeSlot(s.id);
                          }
                        }}
                        className="float-right ml-0.5 text-[0.55rem] opacity-70 hover:opacity-100"
                        aria-label="Remove"
                      >
                        ×
                      </span>
                      {s.start_time} {s.title}
                    </div>
                  ))}
                  {daySlots.length > 3 && (
                    <span className="text-[0.5rem] text-[#6a756d]">+{daySlots.length - 3}</span>
                  )}
                </div>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function DashboardLegend() {
  return (
      <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-t border-sc-line/40 px-2 py-2 text-[0.55rem] text-[#7a8a80]">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-violet-500/85 shadow-sm" /> Exam
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/85 shadow-sm" /> Lecture
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-sc-gold/90 shadow-sm" /> Laboratory
      </span>
    </div>
  );
}

function ExamsSidebar({ weekStart, examSlots }: { weekStart: Date; examSlots: TimetableSlot[] }) {
  return (
    <div className="flex w-[148px] shrink-0 flex-col border-l border-sc-line/60 bg-sc-elev/90 sm:w-[168px]">
      <div className="shrink-0 border-b border-sc-line/50 px-2.5 py-2">
        <h3 className="font-[family-name:var(--font-syne)] text-[0.72rem] font-bold tracking-wide text-sc-mist sm:text-[0.8rem]">
          Exams
        </h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {examSlots.length === 0 ? (
          <p className="px-2.5 py-3 text-[0.58rem] leading-snug text-[#6a756d]">
            No exam-style slots yet. Titles with <span className="text-sc-mist/90">exam</span>,{" "}
            <span className="text-sc-mist/90">quiz</span>, or <span className="text-sc-mist/90">midterm</span> appear here.
          </p>
        ) : (
          <ul className="divide-y divide-sc-line/40">
            {examSlots.map((slot) => {
              const d = addDays(weekStart, slot.weekday);
              return (
                <li key={slot.id} className="px-2.5 py-2.5">
                  <p className="text-[0.55rem] leading-tight text-[#7a8a80]">{formatExamWhen(d, slot.start_time)}</p>
                  <p className="mt-1 line-clamp-2 text-[0.66rem] font-bold text-sc-mist">{slot.title}</p>
                  <p className="mt-0.5 text-[0.58rem] text-[#7a8a80]">{examSubtitle(slot.title)}</p>
                  <p className="mt-1.5 font-[family-name:var(--font-syne)] text-lg font-bold tabular-nums text-[#6a756d]">
                    —
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function MaterialsStrip({ weekStart, slots }: { weekStart: Date; slots: TimetableSlot[] }) {
  const items = useMemo(() => {
    const study = slots.filter((s) => !isExamSlot(s.title));
    study.sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
    return study.slice(0, 8);
  }, [slots]);

  return (
    <div className="shrink-0 border-t border-sc-line/60 bg-sc-bg/95 px-2 py-2 sm:px-2.5">
      <h3 className="mb-1.5 font-[family-name:var(--font-syne)] text-[0.68rem] font-bold text-sc-mist sm:text-[0.75rem]">
        Materials to review
      </h3>
      {items.length === 0 ? (
        <p className="text-[0.58rem] text-[#6a756d]">Add lectures or labs to your timetable to see review cards.</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {items.map((s) => {
            const d = addDays(weekStart, s.weekday);
            const dd = String(d.getDate()).padStart(2, "0");
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            return (
              <div
                key={s.id}
                className="flex w-[132px] shrink-0 flex-col rounded-lg border border-sc-line/55 bg-sc-elev/95 px-2 py-1.5 shadow-sm sm:w-[148px]"
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[0.55rem] text-[#7a8a80]">
                    {dd}.{mm}
                  </span>
                  <IconPlay className="h-3 w-3 shrink-0 text-[#7a8a80]" />
                </div>
                <p className="mt-1 line-clamp-2 text-[0.62rem] font-semibold text-sc-mist">{s.title}</p>
                <p className="mt-auto pt-1 text-[0.52rem] text-[#6a756d]">
                  {s.start_time.slice(0, 5)} · {DAY_SHORT[s.weekday] ?? "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekDashboardView({
  weekStart,
  weekDates,
  slots,
  byDay,
  hours,
  cursorDate,
  setCursorDate,
  removeSlot,
}: {
  weekStart: Date;
  weekDates: Date[];
  slots: TimetableSlot[];
  byDay: TimetableSlot[][];
  hours: number[];
  cursorDate: Date;
  setCursorDate: (d: Date) => void;
  removeSlot: (id: string) => void;
}) {
  const workWeekDates = weekDates.slice(0, 5);
  const end = workWeekDates[workWeekDates.length - 1]!;
  const label = `${workWeekDates[0]!.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  const prev = () => setCursorDate(addDays(cursorDate, -7));
  const next = () => setCursorDate(addDays(cursorDate, 7));

  const examSlots = useMemo(() => {
    const ex = slots.filter((s) => isExamSlot(s.title));
    ex.sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
    return ex;
  }, [slots]);

  const weekEmpty = byDay.slice(0, 5).every((d) => d.length === 0);
  const timeLaneMinPx = HOUR_COUNT * 22;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <NavArrows label={label} onPrev={prev} onNext={next} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
  {weekEmpty && (
            <p className="shrink-0 px-2 py-1.5 text-center text-[0.62rem] text-[#6a756d]">
              No classes this week — import a timetable.
            </p>
          )}
          <div className="flex min-h-0 min-w-0 flex-1 overflow-auto">
            <div
              className="sticky left-0 z-[3] flex w-7 shrink-0 flex-col bg-sc-bg pt-9 text-[0.5rem] text-[#5c6b62] sm:w-8 sm:pt-10 sm:text-[0.55rem]"
              style={{ minHeight: `max(100%, ${timeLaneMinPx}px)` }}
            >
              <div className="flex min-h-0 flex-1 flex-col" style={{ minHeight: `${timeLaneMinPx}px` }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="min-h-0 flex-1 border-t border-sc-line/15 pt-0.5 leading-none"
                    style={{ flexBasis: 0, minHeight: "1.2rem" }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>

            <div
              className="grid min-h-0 min-w-0 flex-1 grid-cols-5 gap-px bg-sc-line/20"
              style={{ minHeight: `max(100%, ${timeLaneMinPx}px)` }}
            >
              {workWeekDates.map((date, di) => {
                const isToday =
                  date.getFullYear() === new Date().getFullYear() &&
                  date.getMonth() === new Date().getMonth() &&
                  date.getDate() === new Date().getDate();
                return (
                  <div key={di} className="flex min-h-full min-w-0 flex-col bg-sc-bg">
                    <div
                      className={`shrink-0 border-b border-sc-line/35 px-0.5 py-1.5 text-center leading-tight ${
                        isToday ? "text-sc-gold" : "text-[#8c9a90]"
                      }`}
                    >
                      <div className="line-clamp-2 text-[0.5rem] font-semibold uppercase tracking-wide text-[#6a756d] sm:text-[0.52rem]">
                        {formatDayHeader(date)}
                      </div>
                    </div>
                    <div
                      className="relative min-h-0 flex-1 bg-sc-bg/50"
                      style={{ minHeight: `${timeLaneMinPx}px` }}
                    >
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="pointer-events-none absolute left-0 right-0 border-t border-sc-line/12"
                          style={{ top: `${((h - START_HOUR) / HOUR_COUNT) * 100}%` }}
                        />
                      ))}
                      {byDay[di]!.map((slot) => {
                        const { top, height } = slotPosition(slot);
                        if (height <= 0) return null;
                        const cls = slotVisualClass(slot.title);
                        return (
                          <div
                            key={slot.id}
                            className={`absolute left-0.5 right-0.5 z-[1] overflow-hidden rounded-md border px-1 py-0.5 pr-3 shadow-sm ${cls}`}
                            style={{ top: `${top}%`, height: `${height}%` }}
                            title={`${slot.start_time}–${slot.end_time} ${slot.title}`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeSlot(slot.id);
                              }}
                              className="absolute right-0 top-0 z-[2] flex h-3.5 w-3.5 items-center justify-center rounded-bl text-[0.6rem] font-bold text-white/85 hover:bg-black/30 sm:h-4 sm:w-4"
                              aria-label={`Remove ${slot.title}`}
                            >
                              ×
                            </button>
                            <span className="font-mono text-[0.45rem] text-sc-mist/75 sm:text-[0.48rem]">
                              {slot.start_time.slice(0, 5)}
                            </span>
                            <p className="line-clamp-2 text-[0.52rem] font-bold leading-tight text-sc-mist sm:text-[0.55rem]">
                              {slot.title}
                            </p>
                            {slot.location ? (
                              <p className="line-clamp-2 text-[0.48rem] leading-snug text-[#8c9a90] sm:text-[0.5rem]">
                                {slot.location}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DashboardLegend />
        </div>

        <ExamsSidebar weekStart={weekStart} examSlots={examSlots} />
      </div>

      <MaterialsStrip weekStart={weekStart} slots={slots} />
    </div>
  );
}

function DayTimeGridView({
  cursorDate,
  setCursorDate,
  slots: daySlots,
  hours,
  removeSlot,
}: {
  cursorDate: Date;
  setCursorDate: (d: Date) => void;
  slots: TimetableSlot[];
  hours: number[];
  removeSlot: (id: string) => void;
}) {
  const label = cursorDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const prev = () => setCursorDate(addDays(cursorDate, -1));
  const next = () => setCursorDate(addDays(cursorDate, 1));

  const dayLaneMinPx = HOUR_COUNT * 26;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <NavArrows label={label} onPrev={prev} onNext={next} />
      <div className="flex min-h-0 flex-1 overflow-auto">
        <div
          className="sticky left-0 z-[3] flex w-8 shrink-0 flex-col bg-[#0b0e14] pt-5 text-[0.55rem] text-[#5c6b62] sm:w-10 sm:text-[0.6rem]"
          style={{ minHeight: `max(100%, ${dayLaneMinPx}px)` }}
        >
          <div className="flex min-h-0 flex-1 flex-col" style={{ minHeight: `${dayLaneMinPx}px` }}>
            {hours.map((h) => (
              <div
                key={h}
                className="min-h-0 flex-1 border-t border-sc-line/20 pt-0.5 leading-none"
                style={{ flexBasis: 0, minHeight: "1.35rem" }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>
        <div
          className="relative min-h-0 min-w-0 flex-1 bg-sc-bg/35"
          style={{ minHeight: `max(100%, ${dayLaneMinPx}px)` }}
        >
          {daySlots.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center p-2 text-center text-[0.65rem] text-[#6a756d]">
              No recurring classes on this weekday — try Week or Month, or import your timetable.
            </p>
          )}
          {daySlots.map((slot) => {
            const { top, height } = slotPosition(slot);
            if (height <= 0) return null;
            const cls = slotVisualClass(slot.title);
            return (
              <div
                key={slot.id}
                className={`absolute left-1 right-1 z-[1] overflow-hidden rounded-md border px-2 py-1 pr-7 text-[0.65rem] leading-snug shadow-sm sm:text-[0.7rem] ${cls}`}
                style={{ top: `${top}%`, height: `${height}%` }}
              >
                <button
                  type="button"
                  onClick={() => void removeSlot(slot.id)}
                  className="absolute right-1 top-1 z-[2] flex h-5 w-5 items-center justify-center rounded text-sm font-bold text-white/80 hover:bg-black/25"
                  aria-label={`Remove ${slot.title}`}
                >
                  ×
                </button>
                <p className="font-bold">{slot.title}</p>
                <p className="font-mono text-[0.6rem] opacity-90">
                  {slot.start_time} – {slot.end_time}
                </p>
                {slot.location ? <p className="text-[0.6rem] opacity-85">{slot.location}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
