"use client";

import Link from "next/link";

const starters = [
  {
    title: "Explore your topic",
    prompt:
      "I'm studying for school in Ghana. Suggest three ways to break down today's topic and one practice question for each.",
  },
  {
    title: "Ask the better way",
    prompt: "What is a simple revision plan I can use this week for core subjects, with 30-minute blocks?",
  },
  {
    title: "Make it simple",
    prompt: "Explain the difference between memorizing and understanding, with a small example from math or science.",
  },
];

export function StudioDashboard() {
  return (
    <div className="overflow-y-auto px-4 py-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-extrabold tracking-tight text-white">
          Welcome to Study Coach
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-[#9caaa0]">
          Your workspace for coaching, prompts, and notes—same engine as the marketing site, styled to match. Open{" "}
          <Link className="font-semibold text-sc-gold underline hover:text-sc-mist" href="/studio/chat">
            Coach
          </Link>{" "}
          anytime.
        </p>

        <p className="mt-8 text-center text-sm font-medium text-[#8c9a90]">
          Not sure where to start? Try the{" "}
          <Link href="/studio/library" className="text-sc-gold underline hover:text-sc-mist">
            prompt library
          </Link>{" "}
          or the{" "}
          <Link href="/assessment" className="text-sc-gold underline hover:text-sc-mist">
            assessment
          </Link>
          .
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {starters.map((s) => (
            <Link
              key={s.title}
              href={`/studio/chat?prompt=${encodeURIComponent(s.prompt)}`}
              className="group flex flex-col rounded-2xl border border-sc-line bg-sc-elev p-6 transition hover:-translate-y-0.5 hover:border-sc-gold/35"
            >
              <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">{s.title}</h2>
              <p className="mt-2 text-sm italic text-[#8c9a90]">&ldquo;{s.prompt.slice(0, 72)}…&rdquo;</p>
              <span className="mt-4 text-xs font-bold uppercase tracking-wide text-sc-gold opacity-90 group-hover:opacity-100">
                Start in coach →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
