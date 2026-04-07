"use client";

import { SignInButton, SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";

export function SiteNavClerkAuth() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <span className="flex shrink-0 items-center gap-2 sm:ml-auto">
        <Link
          href="/sign-in"
          className="rounded-full border border-sc-line px-3.5 py-1.5 text-sm font-semibold text-sc-mist hover:border-sc-gold hover:text-sc-gold"
        >
          Sign in
        </Link>
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2 sm:ml-auto">
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-full border border-sc-line px-3.5 py-1.5 text-sm font-semibold text-sc-mist hover:border-sc-gold hover:text-sc-gold"
          >
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </span>
  );
}
