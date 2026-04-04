"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLogo } from "@/components/brand/AppLogo";
import { NotificationSettingsPanel } from "@/components/studio/NotificationSettingsPanel";
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
  type TimetablePreferences,
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

  function patchPrefs(partial: Partial<TimetablePreferences>) {
    setData((d) => (d ? { ...d, preferences: { ...d.preferences, ...partial } } : d));
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
          <AppLogo className="bg-sc-bg" size={64} priority />
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
              . Notification channels and timing also live under{" "}
              <Link href="/studio/settings" className="text-sc-gold underline hover:text-sc-mist">
                Settings
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

        {prefs && (
          <div className="mt-10">
            <NotificationSettingsPanel
              prefs={prefs}
              patchPrefs={patchPrefs}
              savePrefs={savePrefs}
              saving={saving}
            />
          </div>
        )}

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
