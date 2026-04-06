"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { UserButton, SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { AppLogo } from "@/components/brand/AppLogo";
import { TimetableNotificationsBell } from "@/components/studio/TimetableNotificationsBell";
import {
  LEARNER_PROFILE_STORAGE_KEY,
  LEARNER_PROFILE_UPDATED_EVENT,
  readStoredLearnerProfile,
} from "@/lib/promptLibraryFromProfile";

function useAssessmentCompleted(hasClerk: boolean): boolean {
  const { user, isLoaded } = useUser();
  const [storageDone, setStorageDone] = useState(false);

  const refresh = useCallback(() => {
    const p = readStoredLearnerProfile();
    setStorageDone(Boolean(p?.education_level));
  }, []);

  useEffect(() => {
    refresh();
    const onProfileEvent = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LEARNER_PROFILE_STORAGE_KEY || e.key === null) refresh();
    };
    window.addEventListener(LEARNER_PROFILE_UPDATED_EVENT, onProfileEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LEARNER_PROFILE_UPDATED_EVENT, onProfileEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  if (hasClerk && isLoaded && user) {
    const meta = user.unsafeMetadata as { assessmentCompleted?: boolean } | undefined;
    if (meta?.assessmentCompleted === true) return true;
  }
  return storageDone;
}

const nav = [
  { href: "/studio", label: "Dashboard", icon: "◆" },
  { href: "/studio/chat", label: "Coach", icon: "💬" },
  { href: "/studio/timetable", label: "Timetable", icon: "🗓️" },
];

const promptKids = [
  { href: "/studio/library", label: "Prompt library", icon: "📚" },
  { href: "/assessment", label: "Assessment", icon: "✏️" },
];

type StudioSidebarProps = {
  id?: string;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

export function StudioSidebar({ id = "studio-sidebar", mobileOpen = false, onCloseMobile }: StudioSidebarProps) {
  const pathname = usePathname();
  const closeMobile = () => onCloseMobile?.();
  const [promptsOpen, setPromptsOpen] = useState(true);
  const [accountOpen, setAccountOpen] = useState(true);
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const assessmentCompleted = useAssessmentCompleted(hasClerk);
  const settingsActive = pathname === "/studio/settings" || pathname.startsWith("/studio/settings/");
  const [hash, setHash] = useState("");
  useEffect(() => {
    const sync = () => setHash(typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);
  const notificationsSettingsActive = settingsActive && hash === "notifications";
  const subscriptionSettingsActive = settingsActive && hash === "subscription";
  const generalSettingsActive =
    settingsActive && !notificationsSettingsActive && !subscriptionSettingsActive;

  const asideClass =
    "flex shrink-0 flex-col border-r border-sc-line bg-sc-elev shadow-[4px_0_24px_rgba(0,0,0,0.2)] " +
    "fixed bottom-0 left-0 z-50 w-[min(20rem,92vw)] max-w-[100vw] " +
    "top-[calc(3.5rem+env(safe-area-inset-top,0px))] " +
    "transition-transform duration-200 ease-out motion-reduce:transition-none " +
    "lg:static lg:bottom-auto lg:left-auto lg:top-auto lg:z-auto lg:h-full lg:w-56 lg:max-w-none lg:translate-x-0 " +
    "xl:w-64 " +
    (mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0");

  return (
    <aside id={id} className={asideClass}>
      <div className="border-b border-sc-line px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/studio"
            onClick={closeMobile}
            className="flex min-w-0 flex-1 items-center gap-2.5 font-[family-name:var(--font-syne)] font-bold tracking-tight text-white"
          >
            <AppLogo size={36} />
            <span className="min-w-0 truncate text-[1.05rem] leading-tight">
              Study <span className="text-sc-gold">Coach</span>
            </span>
          </Link>
          <TimetableNotificationsBell />
        </div>
        <p className="mt-1 text-xs text-[#8c9a90]">Workspace</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4 text-sm">
        {nav.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/studio" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-2.5 font-medium transition ${active ? "bg-sc-line text-sc-gold" : "text-sc-mist hover:bg-sc-line/60 hover:text-sc-gold"}`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setPromptsOpen((o) => !o)}
          className="mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left font-medium text-sc-mist hover:bg-sc-line/60 hover:text-sc-gold"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden>⚡</span>
            Flows
          </span>
          <span className="text-xs text-[#6a756d]">{promptsOpen ? "▾" : "▸"}</span>
        </button>
        {promptsOpen && (
          <div className="ml-2 border-l border-sc-line pl-2">
            {promptKids.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                className="mb-0.5 flex items-center gap-2 rounded-lg px-2 py-2 text-[0.85rem] text-[#9caaa0] hover:bg-sc-line/50 hover:text-sc-mist"
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        )}

        <Link
          href="/"
          onClick={closeMobile}
          className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[#6a756d] hover:bg-sc-line/50 hover:text-sc-gold"
        >
          ← Marketing home
        </Link>
      </nav>

      <div className="p-3">
        {assessmentCompleted ? (
          <div className="relative overflow-hidden rounded-2xl border border-sc-gold/35 bg-gradient-to-br from-[#3d3020] to-[#2d5f49] p-4 shadow-lg">
            <div className="pointer-events-none absolute -right-2 -top-2 text-4xl opacity-35" aria-hidden>
              💳
            </div>
            <p className="relative font-[family-name:var(--font-syne)] text-sm font-bold text-white">Subscription</p>
            <p className="relative mt-1 text-xs text-[#e8e0d4]">
              View your plan, billing link, and how this app checks access.
            </p>
            <Link
              href="/studio/settings#subscription"
              onClick={closeMobile}
              className="relative mt-3 inline-flex rounded-full border border-sc-gold/40 bg-sc-gold/15 px-3 py-1.5 text-xs font-bold text-sc-gold backdrop-blur hover:bg-sc-gold/25"
            >
              Open subscription
            </Link>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-sc-gold/25 bg-gradient-to-br from-sc-leaf to-[#2d5f49] p-4 shadow-lg">
            <div className="pointer-events-none absolute -right-2 -top-2 text-4xl opacity-35" aria-hidden>
              🚀
            </div>
            <p className="relative font-[family-name:var(--font-syne)] text-sm font-bold text-white">Go further</p>
            <p className="relative mt-1 text-xs text-[#c4cfc7]">Personalise with assessment and full API access.</p>
            <Link
              href="/assessment"
              onClick={closeMobile}
              className="relative mt-3 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-white/20"
            >
              Start assessment
            </Link>
          </div>
        )}
      </div>

      <div className="border-t border-sc-line p-3">
        <button
          type="button"
          onClick={() => setAccountOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold text-sc-mist transition hover:bg-sc-line/50 hover:text-sc-gold"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden>👤</span>
            Account
          </span>
          <span className="text-xs text-[#6a756d]">{accountOpen ? "▾" : "▸"}</span>
        </button>
        {accountOpen && (
          <div className="mt-1 space-y-0.5 border-l border-sc-line/80 pl-3">
            <Link
              href="/studio/settings#general"
              onClick={closeMobile}
              className={`block rounded-lg px-2 py-2 text-[0.85rem] font-medium transition ${
                generalSettingsActive
                  ? "bg-sc-line text-sc-gold"
                  : "text-[#9caaa0] hover:bg-sc-line/50 hover:text-sc-mist"
              }`}
            >
              ⚙️ Settings
            </Link>
            <Link
              href="/studio/settings#subscription"
              onClick={closeMobile}
              className={`block rounded-lg px-2 py-2 text-[0.85rem] font-medium transition ${
                subscriptionSettingsActive
                  ? "bg-sc-line text-sc-gold"
                  : "text-[#9caaa0] hover:bg-sc-line/50 hover:text-sc-mist"
              }`}
            >
              💳 Subscription
            </Link>
            <Link
              href="/studio/settings#notifications"
              onClick={closeMobile}
              className={`block rounded-lg px-2 py-2 text-[0.85rem] font-medium transition ${
                notificationsSettingsActive
                  ? "bg-sc-line text-sc-gold"
                  : "text-[#9caaa0] hover:bg-sc-line/50 hover:text-sc-mist"
              }`}
            >
              🔔 Notification settings
            </Link>
          </div>
        )}
        {hasClerk ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-sc-line bg-sc-bg px-2 py-2">
            <SignedIn>
              <UserButton afterSignOutUrl="/studio" appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
              <span className="truncate text-xs text-sc-mist">Signed in</span>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="w-full rounded-lg border border-sc-gold/40 bg-sc-gold/10 px-3 py-2 text-xs font-semibold text-sc-gold hover:bg-sc-gold/20"
                >
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        ) : (
          <p className="mt-2 text-center text-[0.65rem] text-[#6a756d]">Configure Clerk for protected routes</p>
        )}
      </div>
    </aside>
  );
}
