"use client";

import { SignIn } from "@clerk/nextjs";

export function SignInView() {
  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/studio"
      fallback={<p className="text-center text-sm text-sc-mist">Loading sign-in…</p>}
    />
  );
}
