import type { ReactNode } from "react";
import { StudioLayoutClient } from "@/components/studio/StudioLayoutClient";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <StudioLayoutClient>{children}</StudioLayoutClient>;
}
