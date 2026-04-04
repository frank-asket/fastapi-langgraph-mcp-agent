import Link from "next/link";
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { apiDocsUrl, serviceMapUrl } from "@/lib/api";

export function SiteNav() {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <nav className="-mx-1 flex max-w-full gap-2 overflow-x-auto overflow-y-visible px-1 pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      <Link
        href="/assessment"
        className="shrink-0 rounded-full border border-sc-line px-3.5 py-2 text-sm font-semibold text-sc-mist hover:border-sc-gold hover:text-sc-gold sm:py-1.5"
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
        className="shrink-0 rounded-full border border-sc-gold/25 px-3.5 py-2 text-sm font-semibold text-sc-gold hover:border-sc-gold sm:py-1.5"
      >
        Coach
      </Link>
      <a
        href={apiDocsUrl()}
        className="shrink-0 rounded-full border border-sc-gold/25 px-3.5 py-2 text-sm font-semibold text-sc-gold hover:border-sc-gold sm:py-1.5"
        target="_blank"
        rel="noreferrer"
      >
        API docs
      </a>
      <a
        href={serviceMapUrl()}
        className="shrink-0 rounded-full border border-sc-line px-3.5 py-2 text-sm font-semibold text-sc-mist hover:border-sc-gold hover:text-sc-gold sm:py-1.5"
        target="_blank"
        rel="noreferrer"
      >
        Service map
      </a>
      {hasClerk && (
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
      )}
    </nav>
  );
}
