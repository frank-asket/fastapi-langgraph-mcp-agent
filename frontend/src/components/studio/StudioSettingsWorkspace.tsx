"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppLogo } from "@/components/brand/AppLogo";
import { NotificationSettingsPanel } from "@/components/studio/NotificationSettingsPanel";
import { SubscriptionSettingsPanel } from "@/components/studio/SubscriptionSettingsPanel";
import { syncTimetableGoalsFromAssessment } from "@/lib/timetableGoalsSync";
import {
  emitTimetableChanged,
  timetableGetMe,
  timetableListNotifications,
  timetableMarkRead,
  timetablePutPreferences,
  type GetTokenFn,
  type TimetableMe,
  type TimetablePreferences,
} from "@/lib/timetableApi";

const hasClerkPk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function StudioSettingsWorkspaceInner({
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

  const load = useCallback(async () => {
    try {
      setErr(null);
      await syncTimetableGoalsFromAssessment(getToken);
      const me = await timetableGetMe(getToken);
      setData(me);
      const recent = await timetableListNotifications(getToken, false);
      setNotifs(recent.slice(0, 12));
      if (!me.preferences.notification_email && clerkUserEmail) {
        await timetablePutPreferences({ ...me.preferences, notification_email: clerkUserEmail }, getToken);
        setData(await timetableGetMe(getToken));
      }
      emitTimetableChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load settings");
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
      const next = await timetablePutPreferences({ ...data.preferences, ...patch }, getToken);
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

  const [settingsHash, setSettingsHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "",
  );
  useEffect(() => {
    const sync = () => setSettingsHash(window.location.hash.replace(/^#/, ""));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const subscriptionOnly = settingsHash === "subscription";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#8c9a90]">Loading settings…</div>
    );
  }

  return (
    <div className="overflow-y-auto px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom,0px))] sm:py-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4">
          <AppLogo className="bg-sc-bg" size={56} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sc-gold">Account</p>
            <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold text-white">Settings</h1>
            <p className="mt-1 max-w-xl text-sm text-[#9caaa0]">
              Workspace preferences and notifications. Import your schedule on the{" "}
              <Link href="/studio/timetable" className="text-sc-gold underline hover:text-sc-mist">
                Timetable
              </Link>{" "}
              page.
            </p>
          </div>
        </div>

        {err && (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {err}
          </div>
        )}

        <section
          id="general"
          className="mt-10 scroll-mt-8 rounded-2xl border border-sc-line bg-sc-elev p-5"
        >
          <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">General</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#8c9a90]">
            Your learning profile and subject focus come from the{" "}
            <Link href="/assessment" className="font-semibold text-sc-gold underline hover:text-sc-mist">
              assessment
            </Link>
            . Coach threads and the prompt library use that context. Class times come from your{" "}
            <Link href="/studio/timetable" className="text-sc-gold underline hover:text-sc-mist">
              timetable import
            </Link>
            .
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-[#9caaa0]">
            <li>
              <Link href="/studio/chat" className="text-sc-gold underline hover:text-sc-mist">
                Coach
              </Link>{" "}
              — main chat workspace
            </li>
            <li>
              <Link href="/studio/timetable" className="text-sc-gold underline hover:text-sc-mist">
                Timetable
              </Link>{" "}
              — import weekly class grid
            </li>
          </ul>
        </section>

        <div className="mt-6 space-y-6">
          <SubscriptionSettingsPanel getToken={getToken} hasClerk={Boolean(hasClerkPk)} />
        </div>

        {!subscriptionOnly ? (
          <div id="notifications" className="mt-6 scroll-mt-8 space-y-6">
            {prefs && (
              <NotificationSettingsPanel
                prefs={prefs}
                patchPrefs={patchPrefs}
                savePrefs={savePrefs}
                saving={saving}
                heading="Notification settings"
              />
            )}

            <section className="rounded-2xl border border-sc-line bg-sc-elev p-5">
              <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">Recent in-app nudges</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {notifs.length === 0 && (
                  <li className="text-[#6a756d]">None yet — nudges appear when times match your timetable.</li>
                )}
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
        ) : null}
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
  return <StudioSettingsWorkspaceInner getToken={getTokenSafe} clerkUserEmail={email} />;
}

export function StudioSettingsWorkspace() {
  if (hasClerkPk) {
    return <WithClerkUser />;
  }
  return <StudioSettingsWorkspaceInner getToken={undefined} clerkUserEmail={null} />;
}
