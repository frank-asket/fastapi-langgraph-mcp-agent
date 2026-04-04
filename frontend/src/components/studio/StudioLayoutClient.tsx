"use client";

import { useState, type ReactNode } from "react";
import { StudioSidebar } from "@/components/studio/StudioSidebar";

function IconMenu() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

export function StudioLayoutClient({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-dvh max-h-dvh bg-sc-bg text-sc-mist antialiased">
      <header className="fixed left-0 right-0 top-0 z-30 border-b border-sc-line bg-sc-elev/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-3 px-3">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sc-line text-sc-mist transition hover:border-sc-gold hover:text-sc-gold active:scale-[0.98]"
            aria-expanded={mobileNavOpen}
            aria-controls="studio-sidebar"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? <IconClose /> : <IconMenu />}
          </button>
          <span className="min-w-0 truncate font-[family-name:var(--font-syne)] text-sm font-bold text-white">
            Study <span className="text-sc-gold">Coach</span>
          </span>
        </div>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <StudioSidebar
        id="studio-sidebar"
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pt-0">
        {children}
      </main>
    </div>
  );
}
