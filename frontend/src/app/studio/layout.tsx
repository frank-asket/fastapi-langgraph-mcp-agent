import type { ReactNode } from "react";
import { StudioSidebar } from "@/components/studio/StudioSidebar";
import { StudioTopBar } from "@/components/studio/StudioTopBar";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh bg-sc-bg text-sc-mist antialiased">
      <StudioSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StudioTopBar />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
