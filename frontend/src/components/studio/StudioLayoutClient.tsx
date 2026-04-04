"use client";

import type { ReactNode } from "react";
import { StudioSidebar } from "@/components/studio/StudioSidebar";

export function StudioLayoutClient({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh bg-sc-bg text-sc-mist antialiased">
      <StudioSidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
