import { Suspense } from "react";
import Link from "next/link";
import { SignUpView } from "./SignUpView";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-sc-bg px-4 py-10">
      <Link href="/" className="font-[family-name:var(--font-syne)] text-sm font-bold text-sc-gold hover:underline">
        ← Home
      </Link>
      <Suspense fallback={<p className="text-center text-sm text-sc-mist">Loading sign-up…</p>}>
        <SignUpView />
      </Suspense>
    </div>
  );
}
