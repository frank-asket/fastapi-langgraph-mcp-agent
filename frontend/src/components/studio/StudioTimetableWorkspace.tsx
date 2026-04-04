"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { syncTimetableGoalsFromAssessment } from "@/lib/timetableGoalsSync";
import {
  emitTimetableChanged,
  timetableGetMe,
  timetableImportFile,
  timetablePutPreferences,
  timetableListNotifications,
  timetableMarkRead,
  type GetTokenFn,
  type TimetableMe,
} from "@/lib/timetableApi";

const hasClerkPk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function StudioTimetableWorkspaceInner({
  getToken,
  clerkUserEmail,
}: {
  getToken?: GetTokenFn;
  clerkUserEmail?: string | null;
}) {
  const [data, setData] = useState<TimetableMe | null>(null);
  const [notifs, setNotifs] = useState<Awaited<ReturnType<typeof timetableListNotifications>>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      await syncTimetableGoalsFromAssessment(getToken);
      const me = await timetableGetMe(getToken);
      setData(me);
      const recent = await timetableListNotifications(getToken, false);
      setNotifs(recent.slice(0, 12));
      if (!me.preferences.notification_email && clerkUserEmail) {
        await timetablePutPreferences({ notification_email: clerkUserEmail }, getToken);
        setData(await timetableGetMe(getToken));
      }
      emitTimetableChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load timetable");
    } finally {
      setLoading(false);
    }
  }, [getToken, clerkUserEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const prefs = data?.preferences;

  async function savePrefs(patch: Parameters<typeof timetablePutPreferences>[0]) {
    if (!data) return;
    setSaving(true);
    try {
      const next = await timetablePutPreferences(patch, getToken);
      setData({ ...data, preferences: next });
      emitTimetableChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onImportSelected(file: File | null) {
    if (!file) return;
    setSaving(true);
    setErr(null);
    setImportMsg(null);
    try {
      const r = await timetableImportFile(file, getToken);
      setImportMsg(r.message);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSaving(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#8c9a90]">Loading timetable…</div>
    );
  }

  return (
    <div className="overflow-y-auto px-4 py-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-sc-line bg-[#0f172a]">
            <Image
              src="/images/landing/kifinal.png"
              alt="Klingbo"
              width={64}
              height={64}
              className="object-cover"
              priority
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sc-gold">Schedule intelligence</p>
            <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold text-white">Timetable & nudges</h1>
            <p className="mt-1 max-w-xl text-sm text-[#9caaa0]">
              Upload your class schedule (PDF, Word, or photo). The model uses an internal layout guide to structure
              your week. Your <strong className="text-sc-mist">goals come from your assessment</strong> automatically
              for personalised nudges — update them anytime on the{" "}
              <Link href="/assessment" className="text-sc-gold underline hover:text-sc-mist">
                assessment
              </Link>
              . Imported classes appear in the <strong className="text-sc-mist">week calendar</strong> beside{" "}
              <Link href="/studio/chat" className="text-sc-gold underline hover:text-sc-mist">
                Coach
              </Link>
              .
            </p>
          </div>
        </div>

        {err && (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {err}
          </div>
        )}

        <section className="mt-10 rounded-2xl border border-sc-line bg-sc-elev p-5">
          <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">Notification settings</h2>
          <p className="mt-1 text-sm text-[#8c9a90]">
            Times use your timezone. Email requires <code className="text-sc-gold">SENDGRID_API_KEY</code> on the API.
          </p>
          {prefs && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="text-[#8c9a90]">Goals (from assessment)</span>
                <p className="mt-1 rounded-lg border border-sc-line/80 bg-sc-bg/60 px-3 py-2 text-sm text-sc-mist">
                  {prefs.goals_summary?.trim() ? (
                    prefs.goals_summary
                  ) : (
                    <span className="text-[#6a756d]">
                      No goals in your saved assessment yet. Complete the{" "}
                      <Link href="/assessment" className="text-sc-gold underline">
                        assessment
                      </Link>{" "}
                      to personalise nudges.
                    </span>
                  )}
                </p>
              </label>
              <label className="block text-sm">
                <span className="text-[#8c9a90]">Timezone (IANA)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-sc-line bg-sc-bg px-3 py-2 text-sc-mist"
                  value={prefs.timezone}
                  onChange={(e) => setData((d) => (d ? { ...d, preferences: { ...d.preferences, timezone: e.target.value } } : d))}
                  onBlur={() => savePrefs({ timezone: prefs.timezone })}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[#8c9a90]">Email for SendGrid</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-sc-line bg-sc-bg px-3 py-2 text-sc-mist"
                  value={prefs.notification_email ?? ""}
                  onChange={(e) =>
                    setData((d) =>
                      d ? { ...d, preferences: { ...d.preferences, notification_email: e.target.value || null } } : d,
                    )
                  }
                  onBlur={() => savePrefs({ notification_email: prefs.notification_email })}
                  placeholder="you@school.edu"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[#8c9a90]">Study prep (minutes before class)</span>
                <input
                  type="number"
                  min={5}
                  max={180}
                  className="mt-1 w-full rounded-lg border border-sc-line bg-sc-bg px-3 py-2 text-sc-mist"
                  value={prefs.study_prep_minutes}
                  onChange={(e) =>
                    setData((d) =>
                      d
                        ? {
                            ...d,
                            preferences: { ...d.preferences, study_prep_minutes: Number(e.target.value) || 45 },
                          }
                        : d,
                    )
                  }
                  onBlur={() => savePrefs({ study_prep_minutes: prefs.study_prep_minutes })}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[#8c9a90]">Rest after class (minutes)</span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  className="mt-1 w-full rounded-lg border border-sc-line bg-sc-bg px-3 py-2 text-sc-mist"
                  value={prefs.rest_after_minutes}
                  onChange={(e) =>
                    setData((d) =>
                      d
                        ? {
                            ...d,
                            preferences: { ...d.preferences, rest_after_minutes: Number(e.target.value) || 15 },
                          }
                        : d,
                    )
                  }
                  onBlur={() => savePrefs({ rest_after_minutes: prefs.rest_after_minutes })}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-[#8c9a90]">Daily focus reminder (local HH:MM, optional)</span>
                <input
                  className="mt-1 w-full max-w-xs rounded-lg border border-sc-line bg-sc-bg px-3 py-2 text-sc-mist"
                  value={prefs.focus_reminder_local ?? ""}
                  onChange={(e) =>
                    setData((d) =>
                      d
                        ? { ...d, preferences: { ...d.preferences, focus_reminder_local: e.target.value || null } }
                        : d,
                    )
                  }
                  onBlur={() =>
                    savePrefs({
                      focus_reminder_local: prefs.focus_reminder_local?.trim() || null,
                    })
                  }
                  placeholder="07:00"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.notify_email}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setData((d) => (d ? { ...d, preferences: { ...d.preferences, notify_email: v } } : d));
                    void savePrefs({ notify_email: v });
                  }}
                />
                <span className="text-sc-mist">Email nudges (SendGrid)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.notify_in_app}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setData((d) => (d ? { ...d, preferences: { ...d.preferences, notify_in_app: v } } : d));
                    void savePrefs({ notify_in_app: v });
                  }}
                />
                <span className="text-sc-mist">In-app nudges</span>
              </label>
            </div>
          )}
          {saving && <p className="mt-3 text-xs text-[#6a756d]">Saving…</p>}
        </section>

        <section className="mt-6 rounded-2xl border border-sc-line bg-sc-elev p-5">
          <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">Import timetable</h2>
          <p className="mt-1 text-sm text-[#8c9a90]">
            PDF, Word (.docx), or image (PNG, JPG, WebP, GIF). Your week view updates beside Coach; use × on a block
            there to drop a bad row, or import again to add more.
          </p>
          <div className="mt-4 rounded-xl border border-dashed border-sc-gold/35 bg-sc-bg/50 p-4">
            <input
              ref={importRef}
              type="file"
              accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp,image/gif"
              className="block w-full max-w-md text-xs text-sc-mist file:mr-3 file:rounded-lg file:border file:border-sc-line file:bg-sc-bg file:px-3 file:py-2 file:text-sc-gold"
              disabled={saving}
              onChange={(e) => void onImportSelected(e.target.files?.[0] ?? null)}
            />
            {importMsg && (
              <p className="mt-2 text-xs leading-relaxed text-[#9caaa0]">
                <span className="text-sc-gold">✓</span> {importMsg}
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-sc-line bg-sc-elev p-5">
          <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">Recent in-app nudges</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {notifs.length === 0 && <li className="text-[#6a756d]">None yet — nudges appear when times match.</li>}
            {notifs.map((n) => (
              <li key={n.id} className="rounded-lg border border-sc-line/80 bg-sc-bg/50 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sc-mist">{n.title}</p>
                    <p className="mt-1 text-xs text-[#8c9a90]">{n.body}</p>
                    <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-[#6a756d]">
                      {n.kind} · {n.created_at}
                      {n.read_at ? " · read" : ""}
                    </p>
                  </div>
                  {!n.read_at && (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-bold text-sc-gold hover:underline"
                      onClick={() => void timetableMarkRead(n.id, getToken).then(() => load())}
                    >
                      Read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function WithClerkUser() {
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenSafe: GetTokenFn = useCallback(() => {
    const template = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE?.trim();
    if (!isLoaded || !isSignedIn) return Promise.resolve(null);
    if (template) return getToken({ template });
    return getToken();
  }, [getToken, isLoaded, isSignedIn]);
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  return <StudioTimetableWorkspaceInner getToken={getTokenSafe} clerkUserEmail={email} />;
}

export function StudioTimetableWorkspace() {
  if (hasClerkPk) {
    return <WithClerkUser />;
  }
  return <StudioTimetableWorkspaceInner getToken={undefined} clerkUserEmail={null} />;
}
