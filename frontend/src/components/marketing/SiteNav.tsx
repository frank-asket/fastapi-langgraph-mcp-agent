import Link from "next/link";
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { apiDocsUrl, serviceMapUrl } from "@/lib/api";

export function SiteNav() {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <nav className="flex flex-wrap gap-3">
      <Link
        href="/assessment"
        className="rounded-full border border-sc-line px-3.5 py-1.5 text-sm font-semibold text-sc-mist hover:border-sc-gold hover:text-sc-gold"
      >
        Assessment
      </Link>
      <Link
        href="/studio"
        className="rounded-full border border-sc-line px-3.5 py-1.5 text-sm font-semibold text-sc-mist hover:border-sc-gold hover:text-sc-gold"
      >
        Workspace
      </Link>
      <Link
        href="/studio/chat"
        className="rounded-full border border-sc-gold/25 px-3.5 py-1.5 text-sm font-semibold text-sc-gold hover:border-sc-gold"
      >
        Coach
      </Link>
      <a
        href={apiDocsUrl()}
        className="rounded-full border border-sc-gold/25 px-3.5 py-1.5 text-sm font-semibold text-sc-gold hover:border-sc-gold"
        target="_blank"
        rel="noreferrer"
      >
        API docs
      </a>
      <a
        href={serviceMapUrl()}
        className="rounded-full border border-sc-line px-3.5 py-1.5 text-sm font-semibold text-sc-mist hover:border-sc-gold hover:text-sc-gold"
        target="_blank"
        rel="noreferrer"
      >
        Service map
      </a>
      {hasClerk && (
        <span className="ml-auto flex items-center gap-2">
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
      )}
    </nav>
  );
}
