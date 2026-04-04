"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppLogo } from "@/components/brand/AppLogo";
import { NotificationSettingsPanel } from "@/components/studio/NotificationSettingsPanel";
import { syncTimetableGoalsFromAssessment } from "@/lib/timetableGoalsSync";
import {
  emitTimetableChanged,
  timetableGetMe,
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setErr(null);
      await syncTimetableGoalsFromAssessment(getToken);
      const me = await timetableGetMe(getToken);
      setData(me);
      if (!me.preferences.notification_email && clerkUserEmail) {
        await timetablePutPreferences({ notification_email: clerkUserEmail }, getToken);
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

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#8c9a90]">Loading settings…</div>
    );
  }

  return (
    <div className="overflow-y-auto px-4 py-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start gap-4">
          <AppLogo className="bg-sc-bg" size={56} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sc-gold">Workspace</p>
            <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold text-white">Settings</h1>
            <p className="mt-1 max-w-xl text-sm text-[#9caaa0]">
              General preferences and how Study Coach reaches you. Import your weekly grid on the{' '}
              <Link href="/studio/timetable" className="text-sc-gold underline hover:text-sc-mist">
                Timetable
              </Link>{' '}
              page.
            </p>
          </div>
        </div>

        {err && (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {err}
          </div>
        )}

        <section className="mt-10 rounded-2xl border border-sc-line bg-sc-elev p-5">
          <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">General</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#8c9a90]">
            Your learning profile and subject focus come from the{' '}
            <Link href="/assessment" className="font-semibold text-sc-gold underline hover:text-sc-mist">
              assessment
            </Link>
            . Coach threads and the prompt library use that context. These fields do not replace your school’s official
            calendar—use timetable import for class times.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-[#9caaa0]">
            <li>
              <Link href="/studio/chat" className="text-sc-gold underline hover:text-sc-mist">
                Coach
              </Link>{' '}
              — main chat workspace
            </li>
            <li>
              <Link href="/studio/timetable" className="text-sc-gold underline hover:text-sc-mist">
                Timetable
              </Link>{' '}
              — import schedule and view recent in-app nudges
            </li>
          </ul>
        </section>

        {prefs && (
          <div className="mt-6">
            <NotificationSettingsPanel
              prefs={prefs}
              patchPrefs={patchPrefs}
              savePrefs={savePrefs}
              saving={saving}
              heading="Notifications"
            />
          </div>
        )}
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
