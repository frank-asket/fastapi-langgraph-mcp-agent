"use client";

import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StudioChatWorkspace } from "@/components/studio/StudioChatWorkspace";
import type { GetTokenFn } from "@/hooks/useWorkflowChat";

function StudioWithClerk({ initialPrompt }: { initialPrompt: string | null }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const clerkSessionReady = isLoaded && isSignedIn;
  const getTokenSafe: GetTokenFn = () => {
    const template = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE?.trim();
    if (template) return getToken({ template });
    return getToken();
  };
  return (
    <StudioChatWorkspace
      getToken={getTokenSafe}
      clerkSessionReady={clerkSessionReady}
      initialPrompt={initialPrompt}
    />
  );
}

function StudioChatInner() {
  const params = useSearchParams();
  const initialPrompt = params.get("prompt");
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (hasClerk) {
    return <StudioWithClerk initialPrompt={initialPrompt} />;
  }
  return <StudioChatWorkspace initialPrompt={initialPrompt} />;
}

export function StudioChatShell() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="flex min-h-0 flex-1 items-center justify-center text-slate-500">Loading…</div>
        }
      >
        <StudioChatInner />
      </Suspense>
    </div>
  );
}
