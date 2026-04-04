import Link from "next/link";

const topics = [
  { icon: "📱", title: "Exam skills", desc: "WASSCE-style planning and past-paper habits (no fake aggregates).", slug: "exam" },
  { icon: "✍️", title: "Writing & essays", desc: "Structure, thesis, and clarity for English and social studies.", slug: "writing" },
  { icon: "🔢", title: "Math & science", desc: "Worked examples and intuition, step by step.", slug: "stem" },
  { icon: "🌐", title: "ICT & digital", desc: "Safe online habits and basic computing ideas.", slug: "ict" },
];

const prompts: Record<string, string> = {
  exam:
    "Help me build a two-week revision timetable for SHS finals. I can study about 90 minutes on weekdays and 3 hours on Saturday.",
  writing:
    "I need to write a short essay on renewable energy in Ghana. Give me an outline and one paragraph starter.",
  stem:
    "Explain solving linear equations in one variable with one full example, then give me two practice problems.",
  ict:
    "List five ways to spot phishing messages on WhatsApp or email, in plain language.",
};

export default function StudioLibraryPage() {
  return (
    <div className="overflow-y-auto px-4 py-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold text-white">Prompt library</h1>
        <p className="mt-2 text-[#9caaa0]">
          Starters open <strong className="text-sc-mist">Coach</strong> with a filled prompt (same{" "}
          <code className="text-sc-gold">/workflow</code> API).
        </p>
        <div className="mt-8 space-y-3">
          {topics.map((t) => {
            const p = prompts[t.slug];
            if (!p) return null;
            return (
              <Link
                key={t.slug}
                href={`/studio/chat?prompt=${encodeURIComponent(p)}`}
                className="flex gap-4 rounded-2xl border border-sc-line bg-sc-elev p-4 transition hover:-translate-y-0.5 hover:border-sc-gold/35"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sc-line bg-sc-bg text-xl">
                  {t.icon}
                </span>
                <div>
                  <h2 className="font-[family-name:var(--font-syne)] font-bold text-white">{t.title}</h2>
                  <p className="mt-1 text-sm text-[#8c9a90]">{t.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
