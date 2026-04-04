import { getApiUrl } from "@/lib/api";

/** Fired after import or slot edits so the studio timetable rail refetches. */
export const TIMETABLE_CHANGED_EVENT = "study-coach-timetable-changed";

export function emitTimetableChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TIMETABLE_CHANGED_EVENT));
}

export type GetTokenFn = () => Promise<string | null>;

export type TimetablePreferences = {
  timezone: string;
  notify_email: boolean;
  notify_in_app: boolean;
  study_prep_minutes: number;
  rest_after_minutes: number;
  focus_reminder_local: string | null;
  goals_summary: string | null;
  notification_email: string | null;
};

export type TimetableSlot = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  title: string;
  location: string | null;
};

export type TimetableMe = {
  preferences: TimetablePreferences;
  slots: TimetableSlot[];
};

export type TimetableInAppNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  created_at: string;
  read_at: string | null;
};

async function headers(getToken?: GetTokenFn): Promise<HeadersInit> {
  const h: Record<string, string> = {};
  if (getToken) {
    const t = await getToken();
    if (t) h.Authorization = `Bearer ${t}`;
  }
  return h;
}

async function parseErr(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    return JSON.stringify(j.detail ?? j);
  } catch {
    return await res.text();
  }
}

export async function timetableGetMe(getToken?: GetTokenFn): Promise<TimetableMe> {
  const res = await fetch(`${getApiUrl()}/timetable/me`, {
    credentials: "include",
    headers: await headers(getToken),
  });
  if (!res.ok) throw new Error(await parseErr(res));
  return (await res.json()) as TimetableMe;
}

export async function timetablePutPreferences(
  body: Partial<TimetablePreferences>,
  getToken?: GetTokenFn,
): Promise<TimetablePreferences> {
  const res = await fetch(`${getApiUrl()}/timetable/preferences`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(await headers(getToken)) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseErr(res));
  return (await res.json()) as TimetablePreferences;
}

export async function timetableCreateSlot(
  slot: Omit<TimetableSlot, "id">,
  getToken?: GetTokenFn,
): Promise<TimetableSlot> {
  const res = await fetch(`${getApiUrl()}/timetable/slots`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(await headers(getToken)) },
    body: JSON.stringify(slot),
  });
  if (!res.ok) throw new Error(await parseErr(res));
  return (await res.json()) as TimetableSlot;
}

export async function timetableUpdateSlot(
  id: string,
  slot: Omit<TimetableSlot, "id">,
  getToken?: GetTokenFn,
): Promise<TimetableSlot> {
  const res = await fetch(`${getApiUrl()}/timetable/slots/${encodeURIComponent(id)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(await headers(getToken)) },
    body: JSON.stringify(slot),
  });
  if (!res.ok) throw new Error(await parseErr(res));
  return (await res.json()) as TimetableSlot;
}

export type TimetableImportResult = {
  added: TimetableSlot[];
  message: string;
};

export async function timetableImportFile(file: File, getToken?: GetTokenFn): Promise<TimetableImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  const h = await headers(getToken);
  const res = await fetch(`${getApiUrl()}/timetable/import`, {
    method: "POST",
    credentials: "include",
    headers: h,
    body: fd,
  });
  if (!res.ok) throw new Error(await parseErr(res));
  return (await res.json()) as TimetableImportResult;
}

export async function timetableDeleteSlot(id: string, getToken?: GetTokenFn): Promise<void> {
  const res = await fetch(`${getApiUrl()}/timetable/slots/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: await headers(getToken),
  });
  if (!res.ok) throw new Error(await parseErr(res));
}

export async function timetableListNotifications(
  getToken?: GetTokenFn,
  unreadOnly?: boolean,
): Promise<TimetableInAppNotification[]> {
  const q = new URLSearchParams();
  if (unreadOnly) q.set("unread_only", "true");
  const res = await fetch(`${getApiUrl()}/timetable/notifications?${q.toString()}`, {
    credentials: "include",
    headers: await headers(getToken),
  });
  if (!res.ok) throw new Error(await parseErr(res));
  const data = (await res.json()) as { notifications: TimetableInAppNotification[] };
  return data.notifications;
}

export async function timetableMarkRead(id: string, getToken?: GetTokenFn): Promise<void> {
  const res = await fetch(`${getApiUrl()}/timetable/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
    credentials: "include",
    headers: await headers(getToken),
  });
  if (!res.ok) throw new Error(await parseErr(res));
}

export async function timetableMarkAllRead(getToken?: GetTokenFn): Promise<void> {
  const res = await fetch(`${getApiUrl()}/timetable/notifications/read-all`, {
    method: "POST",
    credentials: "include",
    headers: await headers(getToken),
  });
  if (!res.ok) throw new Error(await parseErr(res));
}
