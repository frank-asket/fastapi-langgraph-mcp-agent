"use client";

import Link from "next/link";
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { AppLogo } from "@/components/brand/AppLogo";

const nav = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#stack", label: "Stack" },
  { href: "#faq", label: "FAQ" },
] as const;

export function MarketingHeader({ apiServiceUrl }: { apiServiceUrl: string }) {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <header className="sticky top-0 z-50 border-b border-sc-line/80 bg-sc-void/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 transition hover:opacity-95">
          <AppLogo size={38} priority />
          <span className="font-[family-name:var(--font-syne)] text-base font-extrabold tracking-tight text-white sm:text-lg">
            Study <span className="text-sc-lime">Coach</span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Primary"
        >
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-semibold text-[#9caaa0] transition hover:bg-sc-line/50 hover:text-sc-lime"
            >
              {item.label}
            </a>
          ))}
          <a
            href={apiServiceUrl}
            className="rounded-full px-3 py-2 text-sm font-semibold text-[#9caaa0] transition hover:bg-sc-line/50 hover:text-sc-lime"
          >
            API
          </a>
          <Link
            href="/studio"
            className="rounded-full px-3 py-2 text-sm font-semibold text-[#9caaa0] transition hover:bg-sc-line/50 hover:text-sc-lime"
          >
            Workspace
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/studio/chat"
            className="hidden rounded-full border border-sc-line px-3 py-1.5 text-xs font-semibold text-sc-mist transition hover:border-sc-lime/40 hover:text-sc-lime sm:inline-flex sm:text-sm"
          >
            Live coach
          </Link>
          {hasClerk ? (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="rounded-full px-3 py-1.5 text-sm font-semibold text-sc-mist transition hover:text-sc-lime"
                  >
                    Log in
                  </button>
                </SignInButton>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="sc-lime-glow-soft rounded-full bg-sc-lime px-4 py-2 text-sm font-bold text-sc-void shadow-lg transition hover:bg-sc-lime-hover"
                  >
                    Get started
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center gap-2 pl-1">
                  <Link
                    href="/studio"
                    className="hidden text-sm font-semibold text-sc-lime sm:inline"
                  >
                    Studio
                  </Link>
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
            </>
          ) : (
            <Link
              href="/assessment"
              className="sc-lime-glow-soft rounded-full bg-sc-lime px-4 py-2 text-sm font-bold text-sc-void transition hover:bg-sc-lime-hover"
            >
              Get started
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
