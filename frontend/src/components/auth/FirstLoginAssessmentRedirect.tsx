"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const PROFILE_KEY = "ghana_learner_profile";

/**
 * After Clerk sign-in, send users who have not finished the learning assessment to `/assessment`.
 * Completion is stored on `user.unsafeMetadata.assessmentCompleted` (set when they finish the flow).
 * If they already have a profile in this browser only, we migrate metadata once and skip redirect.
 */
export function FirstLoginAssessmentRedirect() {
  const { isLoaded, user } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const migratedRef = useRef(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return;
    if (!isLoaded || !user) return;
    if (!pathname) return;

    if (
      pathname === "/assessment" ||
      pathname.startsWith("/assessment/") ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up")
    ) {
      return;
    }

    const meta = user.unsafeMetadata as { assessmentCompleted?: boolean } | undefined;
    if (meta?.assessmentCompleted === true) return;

    let hasLocalProfile = false;
    try {
      hasLocalProfile = !!localStorage.getItem(PROFILE_KEY);
    } catch {
      /* ignore */
    }

    if (hasLocalProfile) {
      if (!migratedRef.current && !meta?.assessmentCompleted) {
        migratedRef.current = true;
        const base =
          user.unsafeMetadata && typeof user.unsafeMetadata === "object"
            ? (user.unsafeMetadata as Record<string, unknown>)
            : {};
        void user
          .update({
            unsafeMetadata: { ...base, assessmentCompleted: true },
          })
          .catch(() => {
            migratedRef.current = false;
          });
      }
      return;
    }

    router.replace("/assessment");
  }, [isLoaded, user, pathname, router]);

  return null;
}
