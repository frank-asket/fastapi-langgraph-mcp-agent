"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppLogo } from "@/components/brand/AppLogo";
import type { LearnerProfile } from "@/hooks/useWorkflowChat";
import {
  LEARNER_PROFILE_STORAGE_KEY,
  personalizedPromptLibrary,
  readStoredLearnerProfile,
} from "@/lib/promptLibraryFromProfile";

export default function StudioLibraryPage() {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);

  useEffect(() => {
    setProfile(readStoredLearnerProfile());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LEARNER_PROFILE_STORAGE_KEY || e.key === null) {
        setProfile(readStoredLearnerProfile());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const entries = useMemo(() => personalizedPromptLibrary(profile), [profile]);

  return (
    <div className="overflow-y-auto px-4 py-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <AppLogo size={48} />
          <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold text-white">Prompt library</h1>
        </div>
        <p className="mt-2 text-[#9caaa0]">
          Starters open <strong className="text-sc-mist">Coach</strong> with a filled prompt (same{" "}
          <code className="text-sc-gold">/workflow</code> API).{" "}
          {profile?.education_level ? (
            <>
              Yours are tailored from your{" "}
              <Link href="/assessment" className="text-sc-gold underline hover:text-sc-mist">
                assessment
              </Link>
              .
            </>
          ) : (
            <>
              Run the{" "}
              <Link href="/assessment" className="text-sc-gold underline hover:text-sc-mist">
                assessment
              </Link>{" "}
              for prompts matched to your level, track, and subject focus.
            </>
          )}
        </p>
        <div className="mt-8 space-y-3">
          {entries.map((t) => (
            <Link
              key={t.slug}
              href={`/studio/chat?prompt=${encodeURIComponent(t.prompt)}`}
              className="flex gap-4 rounded-2xl border border-sc-line bg-sc-elev p-4 transition hover:-translate-y-0.5 hover:border-sc-gold/35"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sc-line bg-sc-bg text-xl">
                {t.icon}
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-syne)] font-bold text-white">{t.title}</h2>
                <p className="mt-1 text-sm text-[#8c9a90]">{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
