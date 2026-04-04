"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LearnerProfile } from "@/hooks/useWorkflowChat";
import {
  LEARNER_PROFILE_STORAGE_KEY,
  personalizedDashboardStarters,
  readStoredLearnerProfile,
} from "@/lib/promptLibraryFromProfile";

export function StudioDashboard() {
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

  const starters = useMemo(() => personalizedDashboardStarters(profile), [profile]);

  return (
    <div className="overflow-y-auto px-4 py-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-extrabold tracking-tight text-white">
          Welcome to Study Coach
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-[#9caaa0]">
          Your workspace for coaching, prompts, and notes—same engine as the marketing site, styled to match. Open{" "}
          <Link className="font-semibold text-sc-gold underline hover:text-sc-mist" href="/studio/chat">
            Coach
          </Link>{" "}
          anytime.
        </p>

        <p className="mt-8 text-center text-sm font-medium text-[#8c9a90]">
          {profile?.education_level ? (
            <>
              Starters below use your assessment (level, subject focus, goals). Refresh them anytime via the{" "}
              <Link href="/assessment" className="text-sc-gold underline hover:text-sc-mist">
                assessment
              </Link>{" "}
              or browse the full{" "}
              <Link href="/studio/library" className="text-sc-gold underline hover:text-sc-mist">
                prompt library
              </Link>
              .
            </>
          ) : (
            <>
              Not sure where to start? Complete the{" "}
              <Link href="/assessment" className="text-sc-gold underline hover:text-sc-mist">
                assessment
              </Link>{" "}
              for tailored prompts, try the{" "}
              <Link href="/studio/library" className="text-sc-gold underline hover:text-sc-mist">
                prompt library
              </Link>
              , or use the generic starters below.
            </>
          )}
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {starters.map((s) => (
            <Link
              key={s.title}
              href={`/studio/chat?prompt=${encodeURIComponent(s.prompt)}`}
              className="group flex flex-col rounded-2xl border border-sc-line bg-sc-elev p-6 transition hover:-translate-y-0.5 hover:border-sc-gold/35"
            >
              <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">{s.title}</h2>
              <p className="mt-2 text-sm italic text-[#8c9a90]">&ldquo;{s.prompt.slice(0, 72)}…&rdquo;</p>
              <span className="mt-4 text-xs font-bold uppercase tracking-wide text-sc-gold opacity-90 group-hover:opacity-100">
                Start in coach →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
