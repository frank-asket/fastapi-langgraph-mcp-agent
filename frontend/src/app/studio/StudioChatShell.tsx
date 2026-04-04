"use client";

import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StudioChatWorkspace } from "@/components/studio/StudioChatWorkspace";
import type { GetTokenFn } from "@/hooks/useWorkflowChat";

function StudioWithClerk({ initialPrompt }: { initialPrompt: string | null }) {
  const { getToken } = useAuth();
  const getTokenSafe: GetTokenFn = () => getToken();
  return <StudioChatWorkspace getToken={getTokenSafe} initialPrompt={initialPrompt} />;
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
    <Suspense
      fallback={<div className="flex flex-1 items-center justify-center text-slate-500">Loading…</div>}
    >
      <StudioChatInner />
    </Suspense>
  );
}
