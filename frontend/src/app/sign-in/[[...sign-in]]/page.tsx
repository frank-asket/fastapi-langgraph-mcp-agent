import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-sc-bg px-4 py-10">
      <Link href="/" className="font-[family-name:var(--font-syne)] text-sm font-bold text-sc-gold hover:underline">
        ← Home
      </Link>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}
