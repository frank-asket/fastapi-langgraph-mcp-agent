import { readStoredLearnerProfile } from "@/lib/promptLibraryFromProfile";
import { timetableGetMe, timetablePutPreferences, type GetTokenFn } from "@/lib/timetableApi";

/** Push assessment `goals` into timetable prefs so nudges stay personalised without re-prompting the learner. */
export async function syncTimetableGoalsFromAssessment(getToken?: GetTokenFn): Promise<void> {
  const profile = readStoredLearnerProfile();
  const g = profile?.goals?.trim();
  if (!g) return;
  try {
    const me = await timetableGetMe(getToken);
    const current = (me.preferences.goals_summary || "").trim();
    if (g === current) return;
    await timetablePutPreferences({ goals_summary: g }, getToken);
  } catch {
    /* ignore when offline or unauthenticated */
  }
}
