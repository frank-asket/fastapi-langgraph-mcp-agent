"use client";

import Link from "next/link";
import { serviceMapUrl } from "@/lib/api";
import type { TimetablePreferences } from "@/lib/timetableApi";
import type { timetablePutPreferences } from "@/lib/timetableApi";

type SavePatch = Parameters<typeof timetablePutPreferences>[0];

export type NotificationSettingsPanelProps = {
  prefs: TimetablePreferences;
  patchPrefs: (partial: Partial<TimetablePreferences>) => void;
  savePrefs: (patch: SavePatch) => Promise<void>;
  saving: boolean;
  /** Optional section heading (default: Notification settings) */
  heading?: string;
};

export function NotificationSettingsPanel({
  prefs,
  patchPrefs,
  savePrefs,
  saving,
  heading = "Notification settings",
}: NotificationSettingsPanelProps) {
  return (
    <div className="rounded-2xl border border-sc-line bg-sc-elev p-5">
      <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">{heading}</h2>
      <p className="mt-1 text-sm text-[#8c9a90]">
        Nudges follow your saved timetable: prep before class, rest when a block ends, and an optional daily focus.
        Times use your timezone. Email needs <code className="text-sc-gold">SENDGRID_API_KEY</code> on the{' '}
        <a href={serviceMapUrl()} className="text-sc-gold underline hover:text-sc-mist" target="_blank" rel="noreferrer">
          API
        </a>
        . The address below is also used when you tap <strong className="text-sc-mist">Email to me</strong> on a coach
        reply in chat.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="text-[#8c9a90]">Goals (from assessment)</span>
          <p className="mt-1 rounded-lg border border-sc-line/80 bg-sc-bg/60 px-3 py-2 text-sm text-sc-mist">
            {prefs.goals_summary?.trim() ? (
              prefs.goals_summary
            ) : (
              <span className="text-[#6a756d]">
                No goals in your saved assessment yet. Complete the{' '}
                <Link href="/assessment" className="text-sc-gold underline">
                  assessment
                </Link>{' '}
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
            onChange={(e) => patchPrefs({ timezone: e.target.value })}
            onBlur={() => void savePrefs({ timezone: prefs.timezone })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#8c9a90]">Email for SendGrid</span>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-sc-line bg-sc-bg px-3 py-2 text-sc-mist"
            value={prefs.notification_email ?? ''}
            onChange={(e) => patchPrefs({ notification_email: e.target.value || null })}
            onBlur={() => void savePrefs({ notification_email: prefs.notification_email })}
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
            onChange={(e) => patchPrefs({ study_prep_minutes: Number(e.target.value) || 45 })}
            onBlur={() => void savePrefs({ study_prep_minutes: prefs.study_prep_minutes })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#8c9a90]">Rest break length (minutes)</span>
          <input
            type="number"
            min={0}
            max={120}
            className="mt-1 w-full rounded-lg border border-sc-line bg-sc-bg px-3 py-2 text-sc-mist"
            value={prefs.rest_after_minutes}
            onChange={(e) => patchPrefs({ rest_after_minutes: Number(e.target.value) || 15 })}
            onBlur={() => void savePrefs({ rest_after_minutes: prefs.rest_after_minutes })}
          />
        </label>
        <p className="text-[0.65rem] leading-snug text-[#6a756d] sm:col-span-2">
          Rest reminders fire when class ends; this value is how long we suggest you unplug (not a delay before the
          reminder).
        </p>
        <label className="block text-sm sm:col-span-2">
          <span className="text-[#8c9a90]">Daily focus reminder (local HH:MM, optional)</span>
          <input
            className="mt-1 w-full max-w-xs rounded-lg border border-sc-line bg-sc-bg px-3 py-2 text-sc-mist"
            value={prefs.focus_reminder_local ?? ''}
            onChange={(e) => patchPrefs({ focus_reminder_local: e.target.value || null })}
            onBlur={() =>
              void savePrefs({
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
              patchPrefs({ notify_email: v });
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
              patchPrefs({ notify_in_app: v });
              void savePrefs({ notify_in_app: v });
            }}
          />
          <span className="text-sc-mist">In-app nudges</span>
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={prefs.include_timetable_in_coach ?? true}
            onChange={(e) => {
              const v = e.target.checked;
              patchPrefs({ include_timetable_in_coach: v });
              void savePrefs({ include_timetable_in_coach: v });
            }}
          />
          <span className="text-sc-mist">
            Include my saved timetable in Coach messages (plans, workload). Turn off for more privacy or shorter
            prompts.
          </span>
        </label>
      </div>
      {saving && <p className="mt-3 text-xs text-[#6a756d]">Saving…</p>}
    </div>
  );
}
