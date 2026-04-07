"use client";

import Link from "next/link";
import { useState } from "react";

const tiers = [
  {
    name: "Learner",
    desc: "Individual students — assessment, coach chat, and timetable nudges.",
    monthly: 9,
    yearly: 89,
    highlight: true,
    feats: ["Personal learning thread", "Document-aware coach", "Weekly timetable context", "Email nudges (optional)"],
    cta: null as string | null,
    href: null as string | null,
  },
  {
    name: "Campus pilot",
    desc: "Departments and cohorts — shared guardrails, usage clarity, and onboarding support.",
    monthly: null,
    yearly: null,
    highlight: false,
    feats: ["Volume-friendly routing", "CORS + Clerk alignment guide", "Webhook hooks for roster sync", "Operator office hours"],
    cta: "Talk to us",
    href: "mailto:hello@klingbo.com?subject=Study%20Coach%20Campus%20pilot",
  },
] as const;

export function LandingPricing() {
  const [annual, setAnnual] = useState(true);
  const signupHref = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "/sign-up" : "/assessment";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
        <span className={`text-sm font-semibold ${!annual ? "text-white" : "text-[#6a756d]"}`}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual((a) => !a)}
          className="relative h-9 w-[3.25rem] shrink-0 rounded-full border border-sc-line bg-sc-elev transition hover:border-sc-lime/35"
        >
          <span
            className={`absolute top-1 h-7 w-7 rounded-full bg-sc-lime shadow-md transition-all duration-300 ${
              annual ? "left-7" : "left-1"
            }`}
          />
        </button>
        <span className={`text-sm font-semibold ${annual ? "text-white" : "text-[#6a756d]"}`}>
          Yearly <span className="text-sc-lime">(save ~18%)</span>
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-sc-line bg-sc-surface/90 p-6 ring-1 ring-white/[0.04]">
          <p className="font-[family-name:var(--font-syne)] text-xs font-bold uppercase tracking-widest text-sc-lime">
            Starter
          </p>
          <h3 className="mt-2 font-[family-name:var(--font-syne)] text-xl font-bold text-white">Try the flow</h3>
          <p className="mt-2 text-sm text-[#8c9a90]">Assessment + a taste of the coach. Ideal before you commit.</p>
          <p className="mt-6 font-[family-name:var(--font-syne)] text-3xl font-extrabold text-white">
            Free <span className="text-base font-semibold text-[#6a756d]">/ learner</span>
          </p>
          <Link
            href="/assessment"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-sc-line py-3 text-sm font-bold text-sc-mist transition hover:border-sc-lime/45 hover:text-sc-lime"
          >
            Start assessment
          </Link>
          <ul className="mt-6 space-y-2.5 text-sm text-[#9caaa0]">
            {["Level-aware intake", "One saved thread preview", "Honest citations to official sources"].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-sc-lime" aria-hidden>
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {tiers.map((tier) => {
          const price =
            tier.monthly == null
              ? null
              : annual
                ? Math.round(tier.yearly / 12)
                : tier.monthly;
          return (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-6 ${
                tier.highlight
                  ? "border-sc-lime/50 bg-sc-elev sc-lime-glow ring-1 ring-sc-lime/20 md:-translate-y-1 md:scale-[1.02]"
                  : "border-sc-line bg-sc-surface/90 ring-1 ring-white/[0.04]"
              }`}
            >
              {tier.highlight ? (
                <p className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sc-lime px-3 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-sc-void">
                  Most popular
                </p>
              ) : null}
              <p className="font-[family-name:var(--font-syne)] text-xs font-bold uppercase tracking-widest text-sc-lime">
                {tier.name}
              </p>
              <p className="mt-2 text-sm text-[#8c9a90]">{tier.desc}</p>
              {price != null ? (
                <p className="mt-6 font-[family-name:var(--font-syne)] text-3xl font-extrabold text-white">
                  ${price}
                  <span className="text-base font-semibold text-[#6a756d]">/mo</span>
                </p>
              ) : (
                <p className="mt-6 font-[family-name:var(--font-syne)] text-2xl font-extrabold text-white">Custom</p>
              )}
              {tier.href && tier.cta ? (
                <a
                  href={tier.href}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-sc-lime py-3 text-sm font-bold text-sc-void transition hover:bg-sc-lime-hover"
                >
                  {tier.cta}
                </a>
              ) : (
                <Link
                  href={signupHref}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-sc-lime py-3 text-sm font-bold text-sc-void transition hover:bg-sc-lime-hover"
                >
                  Start now
                </Link>
              )}
              <ul className="mt-6 space-y-2.5 text-sm text-[#9caaa0]">
                {tier.feats.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="text-sc-lime" aria-hidden>
                      ✓
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-[#5c665f]">
        Prices are illustrative for pilots; your deployment may bill through your institution or Clerk/Stripe as you wire it
        up.
      </p>
    </div>
  );
}
