"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  timetableListNotifications,
  timetableMarkAllRead,
  timetableMarkRead,
  type GetTokenFn,
  type TimetableInAppNotification,
} from "@/lib/timetableApi";

const hasClerkPk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function BellPanel({ getToken }: { getToken?: GetTokenFn }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TimetableInAppNotification[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setErr(null);
      const list = await timetableListNotifications(getToken, true);
      setItems(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Notifications unavailable");
      setItems([]);
    }
  }, [getToken]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 45_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unread = items.length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            if (!o) void refresh();
            return !o;
          });
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-sc-line bg-sc-bg text-lg text-sc-mist hover:border-sc-gold/40 hover:text-sc-gold"
        aria-label="Timetable notifications"
        title="Timetable nudges"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sc-gold px-1 text-[0.65rem] font-bold text-sc-bg">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(90vw,320px)] rounded-xl border border-sc-line bg-sc-elev py-2 shadow-xl">
          <div className="flex items-center justify-between border-b border-sc-line px-3 pb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-sc-gold">Coach nudges</span>
            <div className="flex gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  className="text-[0.65rem] font-semibold text-[#8c9a90] hover:text-sc-gold"
                  onClick={() => {
                    void timetableMarkAllRead(getToken).then(() => refresh());
                  }}
                >
                  Mark all read
                </button>
              )}
              <Link
                href="/studio/timetable"
                className="text-[0.65rem] font-semibold text-sc-gold hover:underline"
                onClick={() => setOpen(false)}
              >
                Timetable
              </Link>
            </div>
          </div>
          {err && <p className="px-3 py-2 text-xs text-amber-400">{err}</p>}
          <ul className="max-h-72 overflow-y-auto text-sm">
            {items.length === 0 && !err ? (
              <li className="px-3 py-6 text-center text-xs text-[#6a756d]">
                No unread nudges. Add classes on Timetable.
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id} className="border-b border-sc-line/60 px-3 py-2 last:border-0">
                  <p className="font-semibold text-sc-mist">{n.title}</p>
                  <p className="mt-1 text-xs leading-snug text-[#8c9a90]">{n.body}</p>
                  <button
                    type="button"
                    className="mt-1 text-[0.65rem] font-bold text-sc-gold hover:underline"
                    onClick={() => void timetableMarkRead(n.id, getToken).then(() => refresh())}
                  >
                    Mark read
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function BellWithClerk() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenSafe: GetTokenFn = useCallback(() => {
    const template = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE?.trim();
    if (!isLoaded || !isSignedIn) return Promise.resolve(null);
    if (template) return getToken({ template });
    return getToken();
  }, [getToken, isLoaded, isSignedIn]);
  return <BellPanel getToken={getTokenSafe} />;
}

/** In-app timetable nudges; polls API. Safe without Clerk (session / open deploy). */
export function TimetableNotificationsBell() {
  if (hasClerkPk) {
    return <BellWithClerk />;
  }
  return <BellPanel />;
}
