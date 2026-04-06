/** Parsed row → POST /timetable/slots (weekday 0=Mon … 6=Sun, recurring weekly). */

export type DraftTimetableSlot = {
  weekday: number;
  start_time: string;
  end_time: string;
  title: string;
  location: string | null;
};

const DAY_TO_WD: Record<string, number> = {
  monday: 0,
  mon: 0,
  tuesday: 1,
  tue: 1,
  tues: 1,
  wednesday: 2,
  wed: 2,
  thursday: 3,
  thu: 3,
  thur: 3,
  thurs: 3,
  friday: 4,
  fri: 4,
  saturday: 5,
  sat: 5,
  sunday: 6,
  sun: 6,
};

const DAY_PATTERN =
  "(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toHHMM(h: number, m: number): string {
  const hh = Math.max(0, Math.min(23, h));
  const mm = Math.max(0, Math.min(59, m));
  return `${pad2(hh)}:${pad2(mm)}`;
}

function addMinutesHHMM(start: string, deltaMin: number): string {
  const [h, m] = start.split(":").map(Number);
  let t = h * 60 + m + deltaMin;
  t = Math.max(0, Math.min(23 * 60 + 59, t));
  return toHHMM(Math.floor(t / 60), t % 60);
}

function normalizeBulletLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|#{1,6}\s+)/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
}

/** Parse "4", "30", "pm" → 24h hour, minute */
function clock24(h: number, min: number, ampm?: string): [number, number] | null {
  if (Number.isNaN(h) || Number.isNaN(min) || min < 0 || min > 59) return null;
  const ap = (ampm || "").toLowerCase();
  let H = h;
  if (ap === "pm" && H < 12) H += 12;
  if (ap === "am" && H === 12) H = 0;
  if (H < 0 || H > 23) return null;
  return [H, min];
}

/** "4:30pm" / "16:30" / "4 pm" */
function parseClockToken(s: string): [number, number] | null {
  const t = s.trim().toLowerCase();
  const m12 = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(t);
  if (m12) {
    const h = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    return clock24(h, min, m12[3]);
  }
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    return clock24(h, min, undefined);
  }
  return null;
}

function lookupDay(key: string): number | undefined {
  return DAY_TO_WD[key.toLowerCase().replace(/\.$/, "")];
}

function tryParseLine(norm: string): DraftTimetableSlot | null {
  if (norm.length < 5) return null;

  const CLOCK = String.raw`\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?`;

  // Monday … 16:00 – 17:30 … optional title
  const reDayFirst = new RegExp(`^${DAY_PATTERN}\\b[:\\s,.\\-–—]+(.+)$`, "i");
  const dm = reDayFirst.exec(norm);
  if (dm) {
    const weekday = lookupDay(dm[1]);
    if (weekday === undefined) return null;
    const rest = dm[2].trim();
    const rangeRe = new RegExp(
      `^(${CLOCK})\\s*[-–—to]+\\s*(${CLOCK})(?:\\s+(.+))?$`,
      "i",
    );
    const oneRe = new RegExp(`^(${CLOCK})(?:\\s+(.+))?$`, "i");
    let startRaw: string;
    let endRaw: string;
    let titleRest: string;
    const rm = rangeRe.exec(rest);
    if (rm) {
      startRaw = rm[1].trim();
      endRaw = rm[2].trim();
      titleRest = (rm[3] || "").trim();
    } else {
      const om = oneRe.exec(rest);
      if (!om) return null;
      startRaw = om[1].trim();
      titleRest = (om[2] || "").trim();
      endRaw = "";
    }
    const t0 = parseClockToken(startRaw.replace(/\s+/g, ""));
    if (!t0) return null;
    let start = toHHMM(t0[0], t0[1]);
    let end: string;
    if (endRaw) {
      const t1 = parseClockToken(endRaw.replace(/\s+/g, ""));
      if (!t1) return null;
      end = toHHMM(t1[0], t1[1]);
    } else {
      end = addMinutesHHMM(start, 60);
    }
    let title = titleRest.replace(/^[,:\-–—|]+\s*/, "").slice(0, 200);
    if (!title) title = "Study block";
    if (start >= end) end = addMinutesHHMM(start, 30);
    return { weekday, start_time: start, end_time: end, title, location: null };
  }

  // 16:00–17:30 Monday … title
  const reTimeFirst = new RegExp(
    `^(\\d{1,2}(?::\\d{2})?(?:\\s*(?:am|pm))?)\\s*[-–—to]+\\s*(\\d{1,2}(?::\\d{2})?(?:\\s*(?:am|pm))?)\\s*,?\\s*${DAY_PATTERN}\\b\\s*[:\\-–—|]?\\s*(.*)$`,
    "i",
  );
  const tm = reTimeFirst.exec(norm);
  if (tm) {
    const t0 = parseClockToken(tm[1].replace(/\s+/g, ""));
    const t1 = parseClockToken(tm[2].replace(/\s+/g, ""));
    if (!t0 || !t1) return null;
    const weekday = lookupDay(tm[3]);
    if (weekday === undefined) return null;
    let start = toHHMM(t0[0], t0[1]);
    let end = toHHMM(t1[0], t1[1]);
    let title = (tm[4] || "").trim().replace(/^[,:\-–—|]+\s*/, "").slice(0, 200);
    if (!title) title = "Study block";
    if (start >= end) end = addMinutesHHMM(start, 30);
    return { weekday, start_time: start, end_time: end, title, location: null };
  }

  return null;
}

/** Extract recurring weekly slots from coach markdown/plain text (best-effort). */
export function parseStudyPlanFromText(raw: string): DraftTimetableSlot[] {
  const out: DraftTimetableSlot[] = [];
  const seen = new Set<string>();

  for (const line of raw.split("\n")) {
    const norm = normalizeBulletLine(line);
    if (!norm) continue;
    const slot = tryParseLine(norm);
    if (!slot) continue;
    const key = `${slot.weekday}|${slot.start_time}|${slot.end_time}|${slot.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(slot);
    if (out.length >= 32) break;
  }

  return out;
}
