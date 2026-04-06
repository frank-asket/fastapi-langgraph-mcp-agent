"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  emitTimetableChanged,
  timetableCreateSlot,
  type GetTokenFn,
} from "@/lib/timetableApi";
import type { DraftTimetableSlot } from "@/lib/studyPlanParser";

const DAY_OPTIONS: { wd: number; label: string }[] = [
  { wd: 0, label: "Mon" },
  { wd: 1, label: "Tue" },
  { wd: 2, label: "Wed" },
  { wd: 3, label: "Thu" },
  { wd: 4, label: "Fri" },
  { wd: 5, label: "Sat" },
  { wd: 6, label: "Sun" },
];

type Row = DraftTimetableSlot & { key: string };

function minutesFromHHMM(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

type Props = {
  open: boolean;
  /** Parsed slots from the coach message (re-seeded when `open` becomes true). */
  initialSlots: DraftTimetableSlot[];
  getToken?: GetTokenFn;
  onClose: () => void;
};

export function AddStudyPlanToCalendarModal({ open, initialSlots, getToken, onClose }: Props) {
  const titleId = useId();
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(
      initialSlots.map((s, i) => ({
        ...s,
        key: `sp-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      })),
    );
    setErr(null);
  }, [open, initialSlots]);

  const updateRow = useCallback((key: string, patch: Partial<DraftTimetableSlot>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const onConfirm = useCallback(async () => {
    if (rows.length === 0) return;
    setSaving(true);
    setErr(null);
    try {
      for (const r of rows) {
        const s = minutesFromHHMM(r.start_time);
        const e = minutesFromHHMM(r.end_time);
        if (s === null || e === null || s >= e) {
          throw new Error("Each row needs valid start and end times, with end after start.");
        }
      }
      for (const r of rows) {
        const title = r.title.trim() || "Study block";
        const loc = r.location?.trim() || null;
        await timetableCreateSlot(
          {
            weekday: r.weekday,
            start_time: r.start_time,
            end_time: r.end_time,
            title,
            location: loc,
          },
          getToken,
        );
      }
      emitTimetableChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [rows, getToken, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={() => !saving && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex max-h-[min(90dvh,720px)] w-full max-w-2xl flex-col rounded-2xl border border-sc-line bg-sc-elev shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      >
        <div className="border-b border-sc-line px-4 py-3 sm:px-5">
          <h2 id={titleId} className="font-[family-name:var(--font-syne)] text-base font-bold text-white sm:text-lg">
            Add study plan to timetable
          </h2>
          <p className="mt-1.5 text-[0.7rem] leading-snug text-[#8c9a90] sm:text-xs">
            Review or edit each row, then save. Blocks are{" "}
            <strong className="font-semibold text-sc-mist">weekly recurring</strong> (same weekday &amp; time every week)
            in Studio → Timetable — not one-off calendar dates.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {rows.length === 0 ? (
            <p className="text-sm text-[#6a756d]">No rows to import. Close and try a message with day + time lines.</p>
          ) : (
            <div className="space-y-2">
              <div className="hidden grid-cols-[minmax(0,4.5rem)_minmax(0,5rem)_minmax(0,5rem)_1fr_minmax(0,6rem)_auto] gap-2 text-[0.6rem] font-bold uppercase tracking-wide text-[#6a756d] sm:grid">
                <span>Day</span>
                <span>Start</span>
                <span>End</span>
                <span>Title</span>
                <span>Place</span>
                <span className="sr-only">Remove</span>
              </div>
              {rows.map((r) => (
                <div
                  key={r.key}
                  className="grid grid-cols-1 gap-2 rounded-xl border border-sc-line/70 bg-sc-bg/50 p-2 sm:grid-cols-[minmax(0,4.5rem)_minmax(0,5rem)_minmax(0,5rem)_1fr_minmax(0,6rem)_auto] sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0"
                >
                  <label className="flex flex-col gap-0.5 sm:contents">
                    <span className="text-[0.6rem] font-bold uppercase text-[#6a756d] sm:sr-only">Day</span>
                    <select
                      value={r.weekday}
                      onChange={(e) => updateRow(r.key, { weekday: Number(e.target.value) })}
                      disabled={saving}
                      className="rounded-lg border border-sc-line bg-sc-bg px-1.5 py-1.5 text-xs text-sc-mist disabled:opacity-50"
                    >
                      {DAY_OPTIONS.map((d) => (
                        <option key={d.wd} value={d.wd}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5 sm:contents">
                    <span className="text-[0.6rem] font-bold uppercase text-[#6a756d] sm:sr-only">Start</span>
                    <input
                      type="time"
                      value={r.start_time.slice(0, 5)}
                      onChange={(e) => updateRow(r.key, { start_time: e.target.value })}
                      disabled={saving}
                      className="rounded-lg border border-sc-line bg-sc-bg px-1 py-1 font-mono text-xs text-sc-mist disabled:opacity-50"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 sm:contents">
                    <span className="text-[0.6rem] font-bold uppercase text-[#6a756d] sm:sr-only">End</span>
                    <input
                      type="time"
                      value={r.end_time.slice(0, 5)}
                      onChange={(e) => updateRow(r.key, { end_time: e.target.value })}
                      disabled={saving}
                      className="rounded-lg border border-sc-line bg-sc-bg px-1 py-1 font-mono text-xs text-sc-mist disabled:opacity-50"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-0.5 sm:contents">
                    <span className="text-[0.6rem] font-bold uppercase text-[#6a756d] sm:sr-only">Title</span>
                    <input
                      type="text"
                      value={r.title}
                      onChange={(e) => updateRow(r.key, { title: e.target.value })}
                      disabled={saving}
                      className="min-w-0 rounded-lg border border-sc-line bg-sc-bg px-2 py-1.5 text-xs text-sc-mist disabled:opacity-50"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-0.5 sm:contents">
                    <span className="text-[0.6rem] font-bold uppercase text-[#6a756d] sm:sr-only">Place</span>
                    <input
                      type="text"
                      value={r.location ?? ""}
                      onChange={(e) => updateRow(r.key, { location: e.target.value.trim() || null })}
                      placeholder="Optional"
                      disabled={saving}
                      className="min-w-0 rounded-lg border border-sc-line bg-sc-bg px-2 py-1.5 text-xs text-sc-mist placeholder:text-[#5a665e] disabled:opacity-50"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => removeRow(r.key)}
                    className="rounded-lg border border-sc-line/80 px-2 py-1.5 text-[0.65rem] font-semibold text-[#9caaa0] transition hover:border-red-400/50 hover:text-red-200 disabled:opacity-40"
                    title="Remove row"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {err ? (
          <div className="border-t border-red-500/25 bg-red-950/35 px-4 py-2 text-[0.75rem] text-red-100/95">{err}</div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-sc-line px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={saving}
            onClick={() => onClose()}
            className="rounded-lg border border-sc-line bg-sc-bg px-4 py-2 text-xs font-semibold text-sc-mist transition hover:border-sc-gold/40 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || rows.length === 0}
            onClick={() => void onConfirm()}
            className="rounded-lg border border-sc-gold/45 bg-sc-leaf/90 px-4 py-2 text-xs font-semibold text-[#f4faf7] shadow-[0_8px_24px_rgba(61,122,95,0.25)] transition hover:bg-sc-leaf disabled:opacity-50"
          >
            {saving ? "Saving…" : `Add ${rows.length} to timetable`}
          </button>
        </div>
      </div>
    </div>
  );
}
