"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs";

/**
 * Clerk's `<SignedOut>` only renders children when `userId === null`. While auth is loading,
 * `userId` is undefined, so neither SignedIn nor SignedOut show — navbar CTAs disappear.
 * Fallback links keep Log in / Get started usable (same routes as modal targets).
 */
export function MarketingHeaderClerkActions() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <>
        <Link
          href="/sign-in"
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-sc-mist transition hover:text-sc-lime"
        >
          Log in
        </Link>
        <Link
          href="/sign-up"
          className="sc-lime-glow-soft rounded-full bg-sc-lime px-4 py-2 text-sm font-bold text-sc-void shadow-lg transition hover:bg-sc-lime-hover"
        >
          Get started
        </Link>
      </>
    );
  }

  return (
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
        <SignUpButton mode="modal">
          <button
            type="button"
            className="sc-lime-glow-soft rounded-full bg-sc-lime px-4 py-2 text-sm font-bold text-sc-void shadow-lg transition hover:bg-sc-lime-hover"
          >
            Get started
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <div className="flex items-center gap-2 pl-1">
          <Link href="/studio" className="hidden text-sm font-semibold text-sc-lime sm:inline">
            Studio
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </SignedIn>
    </>
  );
}
