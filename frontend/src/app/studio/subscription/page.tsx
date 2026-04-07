"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { SubscriptionSettingsPanel } from "@/components/studio/SubscriptionSettingsPanel";
import type { GetTokenFn } from "@/hooks/useWorkflowChat";

const hasClerkPk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function StudioSubscriptionPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenSafe: GetTokenFn = useCallback(() => {
    const template = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE?.trim();
    if (!isLoaded || !isSignedIn) return Promise.resolve(null);
    if (template) return getToken({ template });
    return getToken();
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <div className="overflow-y-auto px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom,0px))] sm:py-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/studio/settings"
          className="text-xs font-semibold text-sc-gold/90 hover:underline"
        >
          ← Settings
        </Link>
        <header className="mt-4">
          <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold tracking-tight text-white">
            Subscription & billing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#8c9a90]">
            See your plan status, open your billing portal when configured, and how this deployment checks access.
            Production should use{" "}
            <span className="text-sc-mist">pk_live</span> on this site and matching{" "}
            <span className="font-mono text-sc-gold/80">CLERK_JWT_ISSUER</span> on the API.
          </p>
        </header>
        <div className="mt-8">
          <SubscriptionSettingsPanel
            getToken={hasClerkPk ? getTokenSafe : undefined}
            hasClerk={hasClerkPk}
            embedded={false}
          />
        </div>
      </div>
    </div>
  );
}
