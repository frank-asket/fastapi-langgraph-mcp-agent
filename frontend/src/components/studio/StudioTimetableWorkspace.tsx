"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLogo } from "@/components/brand/AppLogo";
import { syncTimetableGoalsFromAssessment } from "@/lib/timetableGoalsSync";
import { emitTimetableChanged, timetableGetMe, timetableImportFile, type GetTokenFn } from "@/lib/timetableApi";

const hasClerkPk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function StudioTimetableWorkspaceInner({ getToken }: { getToken?: GetTokenFn }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      await syncTimetableGoalsFromAssessment(getToken);
      emitTimetableChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onImportSelected(file: File | null) {
    if (!file) return;
    setSaving(true);
    setErr(null);
    setImportMsg(null);
    try {
      const r = await timetableImportFile(file, getToken);
      setImportMsg(r.message);
      await timetableGetMe(getToken);
      emitTimetableChanged();
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
            <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold text-white">Timetable</h1>
            <p className="mt-1 max-w-xl text-sm text-[#9caaa0]">
              Upload your class schedule (PDF, Word, or photo). The model uses an internal layout guide to structure
              your week. Your <strong className="text-sc-mist">goals come from your assessment</strong> — update them on
              the{" "}
              <Link href="/assessment" className="text-sc-gold underline hover:text-sc-mist">
                assessment
              </Link>
              . Classes show in the week calendar beside{" "}
              <Link href="/studio/chat" className="text-sc-gold underline hover:text-sc-mist">
                Coach
              </Link>
              . Nudges and account options are under <strong className="text-sc-mist">Account</strong> in the sidebar.
            </p>
          </div>
        </div>

        {err && (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {err}
          </div>
        )}

        <section className="mt-10 rounded-2xl border border-sc-line bg-sc-elev p-5">
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
      </div>
    </div>
  );
}

function WithClerkUser() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenSafe: GetTokenFn = useCallback(() => {
    const template = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE?.trim();
    if (!isLoaded || !isSignedIn) return Promise.resolve(null);
    if (template) return getToken({ template });
    return getToken();
  }, [getToken, isLoaded, isSignedIn]);
  return <StudioTimetableWorkspaceInner getToken={getTokenSafe} />;
}

export function StudioTimetableWorkspace() {
  if (hasClerkPk) {
    return <WithClerkUser />;
  }
  return <StudioTimetableWorkspaceInner getToken={undefined} />;
}
