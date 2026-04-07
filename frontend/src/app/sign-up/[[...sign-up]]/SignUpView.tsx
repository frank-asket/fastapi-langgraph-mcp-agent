"use client";

import { SignUp } from "@clerk/nextjs";

export function SignUpView() {
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/studio"
      fallback={<p className="text-center text-sm text-sc-mist">Loading sign-up…</p>}
    />
  );
}
